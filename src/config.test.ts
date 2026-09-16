import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from './config.js';

afterEach(() => vi.unstubAllEnvs());

describe('loadConfig', () => {
  it('loads and parses runtime controls', () => {
    vi.stubEnv('BUGREPLAY_AI_PROVIDER', 'gemini');
    vi.stubEnv('BUGREPLAY_LOG_LEVEL', 'warn');
    vi.stubEnv('BUGREPLAY_CONTEXT_LINES', '40');
    vi.stubEnv('BUGREPLAY_API_TIMEOUT_MS', '45000');
    vi.stubEnv('BUGREPLAY_AI_RETRIES', '2');
    vi.stubEnv('BUGREPLAY_TEST_TIMEOUT_MS', '90000');
    vi.stubEnv('BUGREPLAY_MIN_FIX_CONFIDENCE', '80');
    vi.stubEnv('BUGREPLAY_TELEMETRY', 'false');

    expect(loadConfig()).toMatchObject({
      provider: 'gemini',
      logLevel: 'warn',
      contextLines: 40,
      apiTimeoutMs: 45000,
      aiRetries: 2,
      testTimeoutMs: 90000,
      minFixConfidence: 80,
      telemetry: false,
    });
  });

  it('rejects unsupported providers instead of silently falling back', () => {
    vi.stubEnv('BUGREPLAY_AI_PROVIDER', 'unknown');
    expect(() => loadConfig()).toThrow('Invalid BUGREPLAY_AI_PROVIDER');
  });

  it('rejects malformed and out-of-range settings', () => {
    vi.stubEnv('BUGREPLAY_CONTEXT_LINES', 'many');
    expect(() => loadConfig()).toThrow('Invalid BUGREPLAY_CONTEXT_LINES');
    vi.stubEnv('BUGREPLAY_CONTEXT_LINES', '30');
    vi.stubEnv('BUGREPLAY_MIN_FIX_CONFIDENCE', '101');
    expect(() => loadConfig()).toThrow('Invalid BUGREPLAY_MIN_FIX_CONFIDENCE');
  });
});
