import type { ReproductionContext } from '../../types/index.js';

// Prompt version: v1
export const PROMPT_VERSION = 'reproduce-v1';

export const SYSTEM_PROMPT = `You are a senior software engineer generating a reproducible test case for a confirmed software incident.

RULES:
1. Use ONLY the evidence provided. Do NOT invent files, functions, or behaviors not shown.
2. Generate a REAL vitest test that will ACTUALLY FAIL when the bug is present.
3. The test must import from real files in the project — use relative paths as shown in the evidence.
4. The test must assert the EXPECTED (correct) behavior, so it fails with the current buggy code.
5. Do NOT write a test that always passes. The test must reproduce the actual failure.
6. Keep the test focused and minimal — one clear failure case.
7. Do NOT use external dependencies not present in the project.
8. Return valid JSON only.`;

export function buildReproductionPrompt(ctx: ReproductionContext): string {
  const { incident, analysis, evidence } = ctx;

  const sourceSnippets = evidence.sourceSnippets
    .map((s) => `--- ${s.file} (lines ${s.startLine}–${s.endLine}) ---\n${s.code}`)
    .join('\n\n');

  const steps = analysis.reproductionConditions
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  return `Generate a vitest regression test that reproduces this incident.

## INCIDENT
ID: ${incident.id}
Error Type: ${incident.errorType}
Title: ${incident.title}
Root Cause: ${analysis.rootCause}
Confidence: ${analysis.confidence}%

## REPRODUCTION CONDITIONS (from analysis)
${steps}

## SOURCE CODE (use these exact paths for imports)
${sourceSnippets || 'No source code available.'}

## AFFECTED FILES
${incident.affectedFiles.join('\n')}

## FACTS
${analysis.facts.map((f) => `- ${f}`).join('\n')}

## REQUIRED JSON SCHEMA
Return ONLY valid JSON:
{
  "summary": "one-sentence description of what this test reproduces",
  "steps": [
    { "order": 1, "description": "step description", "code": "optional code snippet" }
  ],
  "preconditions": ["what must be true before the test runs"],
  "expectedFailure": "exact error or assertion failure expected",
  "testCode": "complete vitest test file as a string — must be runnable",
  "testFileName": "incident-${String(incident.id).padStart(3, '0')}.test.ts"
}

IMPORTANT FOR testCode:
- Use 'import { describe, it, expect } from "vitest"' 
- Import from real project files using relative paths from 'tests/bugreplay/' directory
- The test MUST FAIL with current code (it reproduces the bug)
- Test for correct behavior — assert what SHOULD happen
- Keep it simple: one describe block, one or two it() calls`;
}

