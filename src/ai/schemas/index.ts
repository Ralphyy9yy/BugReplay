import { z } from 'zod';

// ── IncidentAnalysis schema ──────────────────────────────────

export const IncidentAnalysisSchema = z.object({
  summary: z.string().min(1).max(1000),
  rootCause: z.string().min(1).max(2000),
  confidence: z.number().min(0).max(100),
  facts: z.array(z.string()).min(1),
  hypotheses: z.array(z.string()),
  assumptions: z.array(z.string()),
  affectedFiles: z.array(z.string()),
  reproductionConditions: z.array(z.string()).min(1),
  suggestedFix: z.string().optional(),
  uncertainty: z.string().min(1),
});

export type IncidentAnalysisDTO = z.infer<typeof IncidentAnalysisSchema>;

// ── ReproductionPlan schema ──────────────────────────────────

export const ReproductionStepSchema = z.object({
  order: z.number().int().min(1),
  description: z.string().min(1),
  code: z.string().optional(),
});

export const ReproductionPlanSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(ReproductionStepSchema).min(1),
  preconditions: z.array(z.string()),
  expectedFailure: z.string().min(1),
  testCode: z.string().min(1),
  testFileName: z.string().min(1),
});

export type ReproductionPlanDTO = z.infer<typeof ReproductionPlanSchema>;

// ── PatchProposal schema ─────────────────────────────────────

export const FilePatchSchema = z.object({
  file: z.string().min(1),
  explanation: z.string().min(1),
  originalSnippet: z.string(),
  patchedSnippet: z.string(),
});

export const PatchProposalSchema = z.object({
  explanation: z.string().min(1),
  patches: z.array(FilePatchSchema).min(1),
  confidence: z.number().min(0).max(100),
  warnings: z.array(z.string()),
  regressionTestUpdate: z.string().optional(),
});

export type PatchProposalDTO = z.infer<typeof PatchProposalSchema>;

// ── Parse helpers (with error context) ──────────────────────

export function parseAnalysisResponse(raw: unknown): IncidentAnalysisDTO {
  const result = IncidentAnalysisSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `AI response validation failed (analysis):\n${result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')}\n\nReceived: ${JSON.stringify(raw, null, 2).slice(0, 500)}`,
    );
  }
  return result.data;
}

export function parseReproductionResponse(raw: unknown): ReproductionPlanDTO {
  const result = ReproductionPlanSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `AI response validation failed (reproduction):\n${result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')}\n\nReceived: ${JSON.stringify(raw, null, 2).slice(0, 500)}`,
    );
  }
  return result.data;
}

export function parsePatchResponse(raw: unknown): PatchProposalDTO {
  const result = PatchProposalSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `AI response validation failed (patch):\n${result.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n')}\n\nReceived: ${JSON.stringify(raw, null, 2).slice(0, 500)}`,
    );
  }
  return result.data;
}

