import chalk, { type ChalkInstance } from 'chalk';

/** Render a color-coded confidence bar. */
export function renderConfidence(score: number, width = 20): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;

  let color: ChalkInstance;
  if (clamped >= 80) color = chalk.green;
  else if (clamped >= 60) color = chalk.yellow;
  else color = chalk.red;

  return `${color('\u2588'.repeat(filled))}${chalk.gray('\u2591'.repeat(empty))} ${color(`${clamped}%`)}`;
}

export function confidenceLabel(score: number): string {
  if (score >= 80) return chalk.green('HIGH');
  if (score >= 60) return chalk.yellow('MEDIUM');
  return chalk.red('LOW');
}
