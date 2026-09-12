import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
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

  const provider = VALID_PROVIDERS.includes(providerRaw as typeof VALID_PROVIDERS[number])
    ? (providerRaw as BugReplayConfig['provider'])
    : 'gemini';

  const logLevel = VALID_LOG_LEVELS.includes(logLevelRaw as typeof VALID_LOG_LEVELS[number])
    ? (logLevelRaw as BugReplayConfig['logLevel'])
    : 'info';

  const contextLines = Math.max(5, Math.min(100, parseInt(contextLinesRaw, 10) || 30));

  return {
    apiKey,
    provider,
    model,
    apiBaseUrl,
    logLevel,
    contextLines,
  };
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

