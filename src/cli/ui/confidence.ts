import chalk, { type ChalkInstance } from 'chalk';

/**
 * Renders a confidence score as a progress bar.
 * e.g. confidence(91) → "██████████████████░░ 91%"
 */
export function renderConfidence(score: number, width = 20): string {
  const clamped = Math.max(0, Math.min(100, score));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  let color: ChalkInstance;
  if (clamped >= 80) color = chalk.green;
  else if (clamped >= 60) color = chalk.yellow;
  else color = chalk.red;

  const bar = color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  const pct = color(`${clamped}%`);
  return `${bar} ${pct}`;
}

/**
 * Returns a color-coded confidence label.
 */
export function confidenceLabel(score: number): string {
  if (score >= 80) return chalk.green('HIGH');
  if (score >= 60) return chalk.yellow('MEDIUM');
  return chalk.red('LOW');
}

