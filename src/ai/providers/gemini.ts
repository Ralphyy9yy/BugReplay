import type {
  AIProvider,
  AnalysisContext,
  ReproductionContext,
  PatchContext,
  IncidentAnalysis,
  ReproductionPlan,
  PatchProposal,
  FilePatch,
} from '../../types/index.js';
import {
  parseAnalysisResponse,
  parseReproductionResponse,
  parsePatchResponse,
} from '../schemas/index.js';
import {
  SYSTEM_PROMPT as ANALYZE_SYSTEM,
  buildAnalysisPrompt,
} from '../prompts/analyze.js';
import {
  SYSTEM_PROMPT as REPRODUCE_SYSTEM,
  buildReproductionPrompt,
} from '../prompts/reproduce.js';
import {
  SYSTEM_PROMPT as PATCH_SYSTEM,
  buildPatchPrompt,
} from '../prompts/patch.js';
import { redact } from '../../security/redaction.js';

// ── Gemini REST API types ────────────────────────────────────

interface GeminiContent {
  parts: Array<{ text: string }>;
  role: 'user' | 'model';
}

interface GeminiRequest {
  system_instruction?: { parts: Array<{ text: string }> };
  contents: GeminiContent[];
  generationConfig?: {
    responseMimeType?: string;
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message: string; code: number };
}

// ── Provider implementation ──────────────────────────────────

export class GeminiProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(apiKey: string, model = 'gemini-1.5-flash', baseUrl?: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl =
      baseUrl ??
      'https://generativelanguage.googleapis.com/v1beta/models';
  }

  private async callApi(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<unknown> {
    // Redact before sending to external API
    const { redacted: cleanSystem } = redact(systemPrompt);
    const { redacted: cleanUser } = redact(userPrompt);

    const url = `${this.baseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

    const body: GeminiRequest = {
      system_instruction: {
        parts: [{ text: cleanSystem }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: cleanUser }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1, // low temp for deterministic analysis
        maxOutputTokens: 8192,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000), // 60s timeout
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Gemini API error ${response.status}: ${errText.slice(0, 500)}`,
      );
    }

    const data = (await response.json()) as GeminiResponse;

    if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(
        `Gemini returned no content. FinishReason: ${data.candidates?.[0]?.finishReason ?? 'unknown'}`,
      );
    }

    // Parse JSON response
    try {
      return JSON.parse(text);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = /```(?:json)?\s*([\s\S]+?)\s*```/.exec(text);
      if (jsonMatch?.[1]) {
        return JSON.parse(jsonMatch[1]);
      }
      throw new Error(
        `AI response is not valid JSON:\n${text.slice(0, 500)}`,
      );
    }
  }

  async analyzeIncident(ctx: AnalysisContext): Promise<IncidentAnalysis> {
    const userPrompt = buildAnalysisPrompt(ctx);
    const raw = await this.callApi(ANALYZE_SYSTEM, userPrompt);
    const dto = parseAnalysisResponse(raw);

    return {
      incidentId: ctx.incident.id,
      summary: dto.summary,
      rootCause: dto.rootCause,
      confidence: dto.confidence,
      facts: dto.facts,
      hypotheses: dto.hypotheses,
      assumptions: dto.assumptions,
      affectedFiles: dto.affectedFiles,
      reproductionConditions: dto.reproductionConditions,
      suggestedFix: dto.suggestedFix,
      uncertainty: dto.uncertainty,
      generatedAt: new Date(),
      modelUsed: this.model,
    };
  }

  async generateReproduction(ctx: ReproductionContext): Promise<ReproductionPlan> {
    const userPrompt = buildReproductionPrompt(ctx);
    const raw = await this.callApi(REPRODUCE_SYSTEM, userPrompt);
    const dto = parseReproductionResponse(raw);

    return {
      incidentId: ctx.incident.id,
      summary: dto.summary,
      steps: dto.steps,
      preconditions: dto.preconditions,
      expectedFailure: dto.expectedFailure,
      testCode: dto.testCode,
      generatedAt: new Date(),
    };
  }

  async generatePatch(ctx: PatchContext): Promise<PatchProposal> {
    const userPrompt = buildPatchPrompt(ctx);
    const raw = await this.callApi(PATCH_SYSTEM, userPrompt);
    const dto = parsePatchResponse(raw);

    const patches: FilePatch[] = dto.patches.map((p) => ({
      file: p.file,
      originalContent: p.originalSnippet,
      patchedContent: p.patchedSnippet,
      diff: buildSimpleDiff(p.originalSnippet, p.patchedSnippet, p.file),
      linesChanged: countChangedLines(p.originalSnippet, p.patchedSnippet),
    }));

    return {
      incidentId: ctx.incident.id,
      explanation: dto.explanation,
      patches,
      confidence: dto.confidence,
      warnings: dto.warnings,
      generatedAt: new Date(),
    };
  }
}

// ── Diff utilities ───────────────────────────────────────────

function buildSimpleDiff(original: string, patched: string, file: string): string {
  const origLines = original.split('\n');
  const patchLines = patched.split('\n');
  const lines: string[] = [`--- a/${file}`, `+++ b/${file}`];

  for (const line of origLines) {
    lines.push(`- ${line}`);
  }
  for (const line of patchLines) {
    lines.push(`+ ${line}`);
  }

  return lines.join('\n');
}

function countChangedLines(original: string, patched: string): number {
  const origLines = new Set(original.split('\n'));
  const patchLines = patched.split('\n');
  return patchLines.filter((l) => !origLines.has(l)).length;
}

