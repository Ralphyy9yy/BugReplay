import chalk from 'chalk';

const VERSION = '0.1.0';
const DEFAULT_WIDTH = 68;
const MIN_WIDTH = 48;
const MAX_WIDTH = 76;

/** Remove terminal styling before measuring text. */
export function visibleLength(value: string): number {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').length;
}

/** Keep layouts usable in narrow terminals and stable in redirected output. */
export function terminalWidth(preferred = DEFAULT_WIDTH): number {
  const available = (process.stdout.columns ?? preferred + 4) - 4;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, available));
}

function padRow(content: string, width: number): string {
  const padding = Math.max(0, width - visibleLength(content));
  return chalk.cyan('  │  ') + content + ' '.repeat(padding) + chalk.cyan('  │');
}

export function printBanner(): void {
  const width = terminalWidth();
  const brand = chalk.bold.bgCyan.black(' BUGREPLAY ');
  const version = chalk.cyan(`v${VERSION}`);
  const descriptor = chalk.dim('AI-ASSISTED DEBUGGING');
  const gap = Math.max(2, width - visibleLength(brand) - visibleLength(version) - visibleLength(descriptor) - 2);

  console.log('');
  console.log(chalk.cyan(`  ╭${'─'.repeat(width + 4)}╮`));
  console.log(padRow(`${brand} ${version}${' '.repeat(gap)}${descriptor}`, width));
  console.log(padRow(chalk.white('Turn production failures into verified regression tests.'), width));
  console.log(chalk.cyan(`  ╰${'─'.repeat(width + 4)}╯`));
  console.log('');
}

export function printSeparator(char = '─', width = terminalWidth()): void {
  console.log(chalk.gray('  ' + char.repeat(width)));
}

export function printSection(title: string): void {
  console.log('');
  console.log(chalk.bold.cyan('  ◆ ') + chalk.bold.white(title.toUpperCase()));
  printSeparator();
}

export function printSuccess(message: string): void {
  console.log('  ' + chalk.green('✔') + ' ' + chalk.white(message));
}

export function printError(message: string): void {
  console.log('  ' + chalk.red('✖') + ' ' + chalk.red(message));
}

export function printWarning(message: string): void {
  console.log('  ' + chalk.yellow('⚠') + ' ' + chalk.yellow(message));
}

export function printInfo(message: string): void {
  console.log('  ' + chalk.cyan('ℹ') + ' ' + chalk.white(message));
}

export function printLabel(label: string, value: string): void {
  console.log('  ' + chalk.gray(label.padEnd(16)) + chalk.white(value));
}

export function printFact(fact: string): void {
  console.log('  ' + chalk.bold.bgGreen.black(' FACT ') + ' ' + chalk.white(fact));
}

export function printHypothesis(hypothesis: string): void {
  console.log('  ' + chalk.bold.bgYellow.black(' HYPOTHESIS ') + ' ' + chalk.white(hypothesis));
}

export function printAssumption(assumption: string): void {
  console.log('  ' + chalk.bold.bgGray.black(' ASSUMPTION ') + ' ' + chalk.white(assumption));
}

export function statusBadge(status: string): string {
  switch (status) {
    case 'new': return chalk.bold.bgYellow.black(' NEW ');
    case 'analyzed': return chalk.bold.bgBlue.white(' ANALYZED ');
    case 'reproduced': return chalk.bold.bgMagenta.white(' REPRODUCED ');
    case 'fixed': return chalk.bold.bgCyan.black(' FIXED ');
    case 'verified': return chalk.bold.bgGreen.black(' VERIFIED ');
    case 'closed': return chalk.bold.bgGray.white(' CLOSED ');
    default: return chalk.gray('○ ' + status.toUpperCase());
  }
}

function printBoxHeading(prefix: string, label: string, color: (value: string) => string): void {
  const width = terminalWidth();
  const heading = `─ ${prefix}: ${label} `;
  console.log('');
  console.log(color(`  ╭${heading}${'─'.repeat(Math.max(1, width + 3 - heading.length))}╮`));
}

export function aiPredictionBox(label: string): void {
  printBoxHeading('AI', label, chalk.cyan);
}

export function systemVerificationBox(label: string): void {
  printBoxHeading('SYSTEM', label, chalk.green);
}

export function closedBox(): void {
  console.log(chalk.gray(`  ╰${'─'.repeat(terminalWidth() + 4)}╯`));
  console.log('');
}

export function printNextStep(command: string, description?: string): void {
  console.log('');
  console.log(chalk.bold.cyan('  NEXT') + chalk.gray('  Continue with:'));
  console.log('  ' + chalk.bgGray.white(` ${command} `));
  if (description) console.log('  ' + chalk.dim(description));
  console.log('');
}

export function printCommand(command: string, description: string): void {
  console.log('  ' + chalk.cyan(command.padEnd(31)) + chalk.gray(description));
}
