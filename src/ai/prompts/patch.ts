import type { PatchContext } from '../../types/index.js';

// Prompt version: v1
export const PROMPT_VERSION = 'patch-v1';

export const SYSTEM_PROMPT = `You are a senior software engineer proposing a minimal, safe code patch for a confirmed software incident.

RULES:
1. Propose the MINIMAL change that fixes the root cause. Do not refactor unrelated code.
2. Use ONLY evidence provided. Do not invent new files, functions, or dependencies.
3. Show the exact original snippet and the exact patched snippet.
4. If the fix is not safe or clear from the evidence, set confidence low and explain.
5. Do NOT change test files.
6. Return valid JSON only.`;

export function buildPatchPrompt(ctx: PatchContext): string {
  const { incident, analysis, evidence, reproduction } = ctx;

  const sourceSnippets = evidence.sourceSnippets
    .map((s) => `--- ${s.file} (lines ${s.startLine}–${s.endLine}) ---\n${s.code}`)
    .join('\n\n');

  const reproSteps = reproduction?.steps
    .map((s) => `${s.order}. ${s.description}`)
    .join('\n') ?? 'No reproduction plan available.';

  return `Propose a minimal patch for this confirmed software incident.

## INCIDENT
ID: ${incident.id}
Error Type: ${incident.errorType}
Title: ${incident.title}

## ROOT CAUSE (${analysis.confidence}% confidence)
${analysis.rootCause}

## SUGGESTED FIX (from analysis)
${analysis.suggestedFix ?? 'No specific fix suggested — use your judgment based on evidence.'}

## REPRODUCTION STEPS
${reproSteps}

## SOURCE CODE (these are the files you may patch)
${sourceSnippets}

## AFFECTED FILES
${analysis.affectedFiles.join('\n')}

## REQUIRED JSON SCHEMA
Return ONLY valid JSON:
{
  "explanation": "why this patch fixes the root cause",
  "patches": [
    {
      "file": "exact/file/path.ts",
      "explanation": "what this specific change does",
      "originalSnippet": "exact lines to replace (must match source exactly)",
      "patchedSnippet": "replacement lines"
    }
  ],
  "confidence": <0-100>,
  "warnings": ["any caveats or things to verify after applying"],
  "regressionTestUpdate": "optional: if the reproduction test needs updating after the fix"
}

IMPORTANT:
- originalSnippet must EXACTLY match text in the source (whitespace included)
- Keep the patch minimal — change only what is necessary
- If multiple files need changes, include all in patches array`;
}

