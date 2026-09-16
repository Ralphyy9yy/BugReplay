import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
import type { BugReplayConfig } from './types/index.js';

// Load .env from CWD, parent directory, or workspace root
dotenvConfig({ path: resolve(process.cwd(), '.env') });
dotenvConfig({ path: resolve(process.cwd(), '..', '.env') });

const VALID_PROVIDERS = ['gemini', 'openai', 'anthropic'] as const;
const VALID_LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export function loadConfig(): BugReplayConfig {
  const apiKey =
    process.env['BUGREPLAY_API_KEY'] ??
    process.env['GEMINI_API_KEY'] ??
    process.env['OPENAI_API_KEY'] ??
    process.env['ANTHROPIC_API_KEY'] ??
    '';
  const providerRaw = process.env['BUGREPLAY_AI_PROVIDER'] ?? 'gemini';
  const model =
    process.env['BUGREPLAY_MODEL'] ??
    (providerRaw === 'gemini' ? 'gemini-flash-latest' : 'gpt-4o');
  const apiBaseUrl = process.env['BUGREPLAY_API_BASE_URL'] ?? undefined;
  const logLevelRaw = process.env['BUGREPLAY_LOG_LEVEL'] ?? 'info';
  const contextLinesRaw = process.env['BUGREPLAY_CONTEXT_LINES'] ?? '30';

  const provider = parseEnum('BUGREPLAY_AI_PROVIDER', providerRaw, VALID_PROVIDERS);
  const logLevel = parseEnum('BUGREPLAY_LOG_LEVEL', logLevelRaw, VALID_LOG_LEVELS);
  const contextLines = parseInteger('BUGREPLAY_CONTEXT_LINES', contextLinesRaw, 5, 100);
  const apiTimeoutMs = parseInteger('BUGREPLAY_API_TIMEOUT_MS', process.env['BUGREPLAY_API_TIMEOUT_MS'] ?? '60000', 1000, 300000);
  const aiRetries = parseInteger('BUGREPLAY_AI_RETRIES', process.env['BUGREPLAY_AI_RETRIES'] ?? '3', 0, 10);
  const testTimeoutMs = parseInteger('BUGREPLAY_TEST_TIMEOUT_MS', process.env['BUGREPLAY_TEST_TIMEOUT_MS'] ?? '120000', 1000, 600000);
  const minFixConfidence = parseInteger('BUGREPLAY_MIN_FIX_CONFIDENCE', process.env['BUGREPLAY_MIN_FIX_CONFIDENCE'] ?? '75', 0, 100);
  const telemetry = parseBoolean('BUGREPLAY_TELEMETRY', process.env['BUGREPLAY_TELEMETRY'] ?? 'false');

  return {
    apiKey,
    provider,
    model,
    apiBaseUrl,
    logLevel,
    contextLines,
    apiTimeoutMs,
    aiRetries,
    testTimeoutMs,
    minFixConfidence,
    telemetry,
  };
}

function parseEnum<T extends string>(name: string, value: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) {
    throw new Error(`Invalid ${name}: "${value}". Expected one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function parseInteger(name: string, value: string, min: number, max: number): number {
  if (!/^\d+$/.test(value)) throw new Error(`Invalid ${name}: "${value}". Expected an integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Invalid ${name}: "${value}". Expected ${min}-${max}.`);
  }
  return parsed;
}

function parseBoolean(name: string, value: string): boolean {
  if (value !== 'true' && value !== 'false') {
    throw new Error(`Invalid ${name}: "${value}". Expected true or false.`);
  }
  return value === 'true';
}

export function requireApiKey(config: BugReplayConfig): void {
  if (!config.apiKey || config.apiKey.trim() === '') {
    throw new Error(
      `AI provider is not configured.\n\n` +
        `Set the following environment variable:\n` +
        `  BUGREPLAY_API_KEY=your_api_key_here\n\n` +
        `Or create a .env file in your project root:\n` +
        `  cp .env.example .env\n  # then edit .env with your key\n\n` +
        `Current provider: ${config.provider}\n` +
        `Get a Gemini API key at: https://aistudio.google.com/app/apikey`,
    );
  }
}
