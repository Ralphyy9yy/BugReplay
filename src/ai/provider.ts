import type { AIProvider, BugReplayConfig } from '../types/index.js';
import { GeminiProvider } from './providers/gemini.js';

/**
 * Factory function — returns the configured AI provider.
 * Adding a new provider: implement AIProvider interface, add a case here.
 */
export function createProvider(config: BugReplayConfig): AIProvider {
  switch (config.provider) {
    case 'gemini':
      return new GeminiProvider(config.apiKey, config.model, config.apiBaseUrl, config.apiTimeoutMs, config.aiRetries);

    case 'openai':
      throw new Error(
        'OpenAI provider is not yet implemented. Use BUGREPLAY_AI_PROVIDER=gemini.',
      );

    case 'anthropic':
      throw new Error(
        'Anthropic provider is not yet implemented. Use BUGREPLAY_AI_PROVIDER=gemini.',
      );

    default:
      throw new Error(
        `Unknown AI provider: "${config.provider}". Supported: gemini`,
      );
  }
}

export type { AIProvider };
