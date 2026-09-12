import chalk from 'chalk';

const VERSION = '0.1.0';

export function printBanner(): void {
  const width = 50;
  const title = `BUGREPLAY v${VERSION}`;
  const tagline = 'Logs tell you what happened.';
  const tagline2 = 'BugReplay tells you how to reproduce it.';

  console.log('');
  console.log(chalk.cyan('╔' + '═'.repeat(width - 2) + '╗'));
  console.log(chalk.cyan('║') + chalk.bold.white(title.padStart((width - 2 + title.length) / 2).padEnd(width - 2)) + chalk.cyan('║'));
  console.log(chalk.cyan('╚' + '═'.repeat(width - 2) + '╝'));
  console.log(chalk.gray(tagline));
  console.log(chalk.gray(tagline2));
  console.log('');
}

export function printSeparator(char = '─', width = 50): void {
  console.log(chalk.gray(char.repeat(width)));
}

export function printSection(title: string): void {
  console.log('');
  console.log(chalk.bold.white(title.toUpperCase()));
  printSeparator();
}

export function printSuccess(message: string): void {
  console.log(chalk.green('✓') + ' ' + message);
}

export function printError(message: string): void {
  console.log(chalk.red('✗') + ' ' + chalk.red(message));
}

export function printWarning(message: string): void {
  console.log(chalk.yellow('⚠') + ' ' + chalk.yellow(message));
}

export function printInfo(message: string): void {
  console.log(chalk.blue('ℹ') + ' ' + message);
}

export function printLabel(label: string, value: string): void {
  console.log(chalk.gray(label.padEnd(16)) + chalk.white(value));
}

export function printFact(fact: string): void {
  console.log(chalk.green('  [FACT]      ') + fact);
}

export function printHypothesis(h: string): void {
  console.log(chalk.yellow('  [HYPOTHESIS]') + ' ' + h);
}

export function printAssumption(a: string): void {
  console.log(chalk.gray('  [ASSUMPTION]') + ' ' + a);
}

export function statusBadge(status: string): string {
  switch (status) {
    case 'new': return chalk.yellow('● NEW');
    case 'analyzed': return chalk.blue('● ANALYZED');
    case 'reproduced': return chalk.magenta('● REPRODUCED');
    case 'fixed': return chalk.cyan('● FIXED');
    case 'verified': return chalk.green('✓ VERIFIED');
    case 'closed': return chalk.gray('○ CLOSED');
    default: return chalk.gray('○ ' + status.toUpperCase());
  }
}

export function aiPredictionBox(label: string): void {
  console.log('');
  console.log(chalk.blue('┌─ AI ' + label + ' ─────────────────────────────────'));
}

export function systemVerificationBox(label: string): void {
  console.log('');
  console.log(chalk.green('┌─ SYSTEM VERIFICATION: ' + label + ' ─────────────'));
}

export function closedBox(): void {
  console.log(chalk.gray('└──────────────────────────────────────────────────'));
  console.log('');
}

