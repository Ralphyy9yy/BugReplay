import { describe, it, expect, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, rmSync, unlinkSync } from 'node:fs';
import { parseLogFile } from '../core/parser/logParser.js';
import { groupEvents } from '../core/incidents/grouper.js';
import { collectEvidence } from '../core/evidence/collector.js';
import { writeReproductionTest } from '../core/reproduction/generator.js';
import { runTestFile } from '../integrations/test-runner.js';
import { applyPatch, revertPatch } from '../core/patching/patcher.js';
import type {
  AIProvider,
  AnalysisContext,
  ReproductionContext,
  PatchContext,
  IncidentAnalysis,
  ReproductionPlan,
  PatchProposal,
} from '../types/index.js';

// Mock AI Provider that returns deterministic, schema-compliant responses
class MockAIProvider implements AIProvider {
  async analyzeIncident(ctx: AnalysisContext): Promise<IncidentAnalysis> {
    return {
      incidentId: ctx.incident.id,
      summary: "payment.id is accessed without checking if defined in checkout.ts",
      rootCause:
        "The processPayment function returns a response without an `id` property, but processCheckout attempts to access `payment.id!`, resulting in TypeError.",
      confidence: 94,
      facts: [
        "TypeError: Cannot read properties of undefined (reading 'id') at checkout.ts:84",
        "14 occurrences in server.log",
        "Source line accesses payment.id",
      ],
      hypotheses: [
        "Payment API refactor omitted the id field from the response mapper",
      ],
      assumptions: [
        "Payment should provide a transaction identifier or checkout should tolerate its absence",
      ],
      affectedFiles: ["src/checkout.ts", "src/payment.ts"],
      reproductionConditions: [
        "Create an order with valid items and card token",
        "Call processCheckout()",
        "Observe TypeError on payment.id",
      ],
      suggestedFix: "Use fallback or optional chaining: payment.id ?? `tx_${request.orderId}`",
      uncertainty: "External payment gateway response format outside this repo is unknown",
      generatedAt: new Date(),
    };
  }

  async generateReproduction(ctx: ReproductionContext): Promise<ReproductionPlan> {
    const testCode = `import { describe, it, expect } from 'vitest';
import { processCheckout } from '../../src/checkout.js';

describe('Incident #1 Reproduction', () => {
  it('should successfully complete checkout with valid payment id', async () => {
    const result = await processCheckout({
      orderId: 'ord_repro_001',
      customerId: 'cust_001',
      cardToken: 'tok_valid_test_card',
      items: [
        { productId: 'p1', name: 'Test Widget', quantity: 1, unitPrice: 1000 }
      ]
    });

    expect(result.success).toBe(true);
    expect(result.paymentId).toBeDefined();
    expect(typeof result.paymentId).toBe('string');
    expect(result.paymentId.length).toBeGreaterThan(0);
  });
});
`;

    return {
      incidentId: ctx.incident.id,
      summary: "Verify checkout process with mock valid order",
      steps: [
        { order: 1, description: "Invoke processCheckout with valid cart items" },
        { order: 2, description: "Expect successful checkout result with valid paymentId" },
      ],
      preconditions: ["Node environment with vitest"],
      expectedFailure: "TypeError or paymentId undefined",
      testCode,
      generatedAt: new Date(),
    };
  }

  async generatePatch(ctx: PatchContext): Promise<PatchProposal> {
    return {
      incidentId: ctx.incident.id,
      explanation: "Provide a fallback paymentId if payment.id is not returned by the payment gateway",
      patches: [
        {
          file: "src/checkout.ts",
          originalContent: "  const transaction = (payment as any).transaction;\n  const paymentId = transaction.id; // ← TypeError: Cannot read properties of undefined (reading 'id')",
          patchedContent: "  const transaction = (payment as any).transaction;\n  const paymentId = (payment as any).id ?? transaction?.id ?? `tx_${request.orderId}`;",
          diff: "- const paymentId = transaction.id;\n+ const paymentId = (payment as any).id ?? transaction?.id ?? `tx_${request.orderId}`;",
          linesChanged: 1,
        },
      ],
      confidence: 92,
      warnings: ["Verify that downstream systems accept the generated transaction format"],
      generatedAt: new Date(),
    };
  }
}

describe('End-to-End BugReplay Workflow', () => {
  const demoRoot = resolve(process.cwd(), 'demo');
  const logFilePath = resolve(demoRoot, 'logs', 'server.log');
  let generatedTestFile: string | null = null;
  let patchProposal: PatchProposal | null = null;

  afterAll(async () => {
    // Revert patch if applied
    if (patchProposal) {
      await revertPatch(patchProposal, demoRoot);
    }
    // Clean up generated test file
    if (generatedTestFile && existsSync(generatedTestFile)) {
      try {
        unlinkSync(generatedTestFile);
      } catch {}
    }
    // Clean up backup file if present
    const orig = resolve(demoRoot, 'src', 'checkout.ts.bugreplay.orig');
    if (existsSync(orig)) {
      try {
        unlinkSync(orig);
      } catch {}
    }
  });

  it('Step 1 & 2: parses log and identifies incidents', async () => {
    const parseResult = await parseLogFile(logFilePath);
    expect(parseResult.totalLines).toBeGreaterThan(500);
    expect(parseResult.errorCount).toBeGreaterThanOrEqual(20);

    const { incidents } = groupEvents(parseResult.events, logFilePath, demoRoot);
    expect(incidents.length).toBeGreaterThanOrEqual(3);

    // Primary incident must be TypeError in checkout.ts
    const primary = incidents[0]!;
    expect(primary.errorType).toBe('TypeError');
    expect(primary.occurrences).toBe(14);
    expect(primary.affectedFiles.some((f) => f.includes('checkout.ts'))).toBe(true);
  });

  it('Step 3 & 4: collects evidence and analyzes root cause', async () => {
    const parseResult = await parseLogFile(logFilePath);
    const { incidents } = groupEvents(parseResult.events, logFilePath, demoRoot);
    const incident = incidents[0]!;

    const evidence = await collectEvidence(incident, parseResult.events, demoRoot);
    expect(evidence.sourceSnippets.length).toBeGreaterThan(0);
    expect(evidence.relatedLogs.length).toBe(14);

    const ai = new MockAIProvider();
    const analysis = await ai.analyzeIncident({
      incident,
      evidence,
      logSample: parseResult.events.slice(0, 20),
    });

    expect(analysis.confidence).toBeGreaterThan(90);
    expect(analysis.facts.length).toBeGreaterThan(0);
    expect(analysis.rootCause).toContain('payment.id');
  });

  it('Step 5 & 6: generates reproduction test and confirms bug is reproduced (test FAILS)', async () => {
    const parseResult = await parseLogFile(logFilePath);
    const { incidents } = groupEvents(parseResult.events, logFilePath, demoRoot);
    const incident = incidents[0]!;
    const evidence = await collectEvidence(incident, parseResult.events, demoRoot);

    const ai = new MockAIProvider();
    const analysis = await ai.analyzeIncident({
      incident,
      evidence,
      logSample: parseResult.events.slice(0, 20),
    });

    const reproPlan = await ai.generateReproduction({ incident, analysis, evidence });
    expect(reproPlan.steps.length).toBe(2);

    // Write regression test
    generatedTestFile = await writeReproductionTest(reproPlan, incident, demoRoot, true);
    expect(existsSync(generatedTestFile)).toBe(true);

    // Run test on BUGGY code — must FAIL!
    const beforeResult = await runTestFile(generatedTestFile, demoRoot);
    expect(beforeResult.passed).toBe(false);
    expect(beforeResult.status).toBe('failed');
  });

  it('Step 7 & 8: applies patch and verifies regression test PASSES', async () => {
    expect(generatedTestFile).not.toBeNull();

    const parseResult = await parseLogFile(logFilePath);
    const { incidents } = groupEvents(parseResult.events, logFilePath, demoRoot);
    const incident = incidents[0]!;
    const evidence = await collectEvidence(incident, parseResult.events, demoRoot);

    const ai = new MockAIProvider();
    const analysis = await ai.analyzeIncident({
      incident,
      evidence,
      logSample: parseResult.events.slice(0, 20),
    });

    patchProposal = await ai.generatePatch({ incident, analysis, evidence });
    expect(patchProposal.patches.length).toBe(1);

    // Apply patch
    const patchResult = await applyPatch(patchProposal, demoRoot);
    expect(patchResult.success).toBe(true);
    expect(patchResult.backupFiles.length).toBe(1);
    expect(existsSync(patchResult.backupFiles[0]!)).toBe(true);

    // Run regression test on PATCHED code — must PASS!
    const afterResult = await runTestFile(generatedTestFile!, demoRoot);
    expect(afterResult.passed).toBe(true);
    expect(afterResult.status).toBe('passed');
  });
});
