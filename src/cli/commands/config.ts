import chalk from 'chalk';
import { loadConfig } from '../../config.js';
import { printBanner, printSection, printLabel } from '../ui/banner.js';

export function configCommand(): void {
  printBanner();

  const config = loadConfig();

  printSection('CONFIGURATION');
  console.log('');
  printLabel('Provider:', config.provider);
  printLabel('Model:', config.model);
  printLabel('API Key:', config.apiKey ? '****' + config.apiKey.slice(-4) : chalk.red('NOT SET'));
  printLabel('Log Level:', config.logLevel);
  printLabel('Context Lines:', String(config.contextLines));
  printLabel('API Timeout:', `${config.apiTimeoutMs}ms`);
  printLabel('AI Retries:', String(config.aiRetries));
  printLabel('Test Timeout:', `${config.testTimeoutMs}ms`);
  printLabel('Min Fix Confidence:', `${config.minFixConfidence}%`);
  printLabel('Telemetry:', config.telemetry ? 'enabled' : 'disabled');
  if (config.apiBaseUrl) {
    printLabel('Base URL:', config.apiBaseUrl);
  }

  console.log('');
  console.log(chalk.gray('Configure via environment variables or .env file:'));
  console.log(chalk.white('  BUGREPLAY_API_KEY         — your AI provider API key'));
  console.log(chalk.white('  BUGREPLAY_AI_PROVIDER     — gemini | openai | anthropic'));
  console.log(chalk.white('  BUGREPLAY_MODEL           — model name (e.g. gemini-1.5-flash)'));
  console.log(chalk.white('  BUGREPLAY_LOG_LEVEL       — debug | info | warn | error'));
  console.log(chalk.white('  BUGREPLAY_CONTEXT_LINES   — lines of code context (default: 30)'));
  console.log(chalk.white('  BUGREPLAY_API_TIMEOUT_MS  — AI request timeout (default: 60000)'));
  console.log(chalk.white('  BUGREPLAY_AI_RETRIES      — transient API retries (default: 3)'));
  console.log(chalk.white('  BUGREPLAY_TEST_TIMEOUT_MS — test command timeout (default: 120000)'));
  console.log(chalk.white('  BUGREPLAY_MIN_FIX_CONFIDENCE — automatic apply threshold (default: 75)'));
  console.log(chalk.white('  BUGREPLAY_TELEMETRY       — reserved; no telemetry is currently sent'));
  console.log('');

  if (!config.apiKey) {
    console.log(chalk.red('⚠ API key is not configured.'));
    console.log(chalk.yellow('  Get a Gemini API key: https://aistudio.google.com/app/apikey'));
    console.log(chalk.yellow('  Then: export BUGREPLAY_API_KEY=your_key'));
    console.log('');
  }
}
