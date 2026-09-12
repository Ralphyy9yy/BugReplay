import type { AnalysisContext } from '../../types/index.js';

// Prompt version: v1
export const PROMPT_VERSION = 'analyze-v1';

export const SYSTEM_PROMPT = `You are a senior software engineer performing a precise incident root-cause analysis.

RULES:
1. Use ONLY the evidence provided. Do NOT invent files, log lines, stack traces, or code that is not shown.
2. Explicitly label each claim as FACT, HYPOTHESIS, or ASSUMPTION.
   - FACT: directly observable in the provided evidence
   - HYPOTHESIS: plausible inference from evidence but not directly observed
   - ASSUMPTION: required to make sense of the evidence but not verifiable from it
3. If evidence is insufficient to determine root cause, state that explicitly and lower confidence accordingly.
4. Do NOT claim certainty you do not have. A lower confidence score is better than false certainty.
5. Do NOT suggest fixes based on guessing — only suggest fixes grounded in the evidence.
6. Do NOT expose, mention, or reference any [REDACTED] values.

OUTPUT FORMAT: Valid JSON matching the schema provided.`;

export function buildAnalysisPrompt(ctx: AnalysisContext): string {
  const { incident, evidence, logSample } = ctx;

  const stackTraceText = incident.primaryFrame
    ? `File: ${incident.primaryFrame.file}:${incident.primaryFrame.line}${incident.primaryFrame.functionName ? ` (in ${incident.primaryFrame.functionName})` : ''}`
    : 'No stack trace available';

  const sourceSnippets = evidence.sourceSnippets
    .map(
      (s) =>
        `--- ${s.file} (lines ${s.startLine}–${s.endLine}) ---\n${s.code}`,
    )
    .join('\n\n');

  const recentLogs = logSample
    .slice(0, 20)
    .map((e) => `[${e.level.toUpperCase()}] ${e.message}`)
    .join('\n');

  const gitSection = evidence.gitInfo?.blame?.length
    ? evidence.gitInfo.blame
        .map(
          (b) =>
            `File: ${b.file}:${b.line}\nLast modified: ${b.commit.daysAgo} days ago\nAuthor: ${b.commit.author}\nCommit: ${b.commit.shortHash} — "${b.commit.message}"\nCorrelation score (heuristic): ${b.correlationScore ?? 'N/A'}%`,
        )
        .join('\n\n')
    : 'No git blame information available.';

  const testFiles = evidence.testFiles.length
    ? evidence.testFiles.join('\n')
    : 'No related test files found.';

  return `Analyze this software incident and return a JSON response.

## INCIDENT
ID: ${incident.id}
Title: ${incident.title}
Error Type: ${incident.errorType}
Occurrences: ${incident.occurrences}
First seen: ${incident.firstSeen?.toISOString() ?? 'unknown'}
Last seen: ${incident.lastSeen?.toISOString() ?? 'unknown'}

## PRIMARY LOCATION
${stackTraceText}

## AFFECTED FILES
${incident.affectedFiles.join('\n') || 'Unknown'}

## RECENT LOG SAMPLE (${logSample.length} events)
${recentLogs}

## SOURCE CODE
${sourceSnippets || 'No source code available.'}

## GIT CORRELATION (HYPOTHESIS ONLY — not causation)
${gitSection}

## RELATED TEST FILES
${testFiles}

## REQUIRED JSON SCHEMA
Return ONLY valid JSON with this exact structure:
{
  "summary": "one-sentence summary of what failed",
  "rootCause": "detailed explanation of why it failed, with evidence references",
  "confidence": <0-100>,
  "facts": ["list of facts directly observable in evidence"],
  "hypotheses": ["list of plausible inferences"],
  "assumptions": ["list of assumptions required"],
  "affectedFiles": ["list of file paths involved"],
  "reproductionConditions": ["step 1", "step 2", ...],
  "suggestedFix": "optional: brief description of fix if evidence supports it",
  "uncertainty": "explicit statement of what is unknown or unverifiable"
}`;
}

