import chalk from 'chalk';

const VERSION = '0.1.0';

/**
 * Strips ANSI escape sequences to compute true visible string length.
 */
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

export function printBanner(): void {
  const innerWidth = 56;
  const topBorder = chalk.cyan('  ╭' + '─'.repeat(innerWidth + 4) + '╮');
  const bottomBorder = chalk.cyan('  ╰' + '─'.repeat(innerWidth + 4) + '╯');

  function row(content: string): string {
    const visibleLen = stripAnsi(content).length;
    const padding = Math.max(0, innerWidth - visibleLen);
    return chalk.cyan('  │  ') + content + ' '.repeat(padding) + chalk.cyan('  │');
  }

  const line1 =
    chalk.bold.bgCyan.black(' BUGREPLAY ') +
    ' ' +
    chalk.cyan(`v${VERSION}`) +
    ' '.repeat(19) +
    chalk.dim('AI-ASSISTED DEBUG');

  const line2 = chalk.white('"Logs tell you what happened.');
  const line3 = chalk.cyanBright(' BugReplay tells you how to reproduce it."');

  console.log('');
  console.log(topBorder);
  console.log(row(line1));
  console.log(row(line2));
  console.log(row(line3));
  console.log(bottomBorder);
  console.log('');
}

export function printSeparator(char = '─', width = 64): void {
  console.log(chalk.gray('  ' + char.repeat(width)));
}

export function printSection(title: string): void {
  console.log('');
  console.log(chalk.bold.white('  ◆ ' + title.toUpperCase()));
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

export function printHypothesis(h: string): void {
  console.log('  ' + chalk.bold.bgYellow.black(' HYPOTHESIS ') + ' ' + chalk.white(h));
}

export function printAssumption(a: string): void {
  console.log('  ' + chalk.bold.bgGray.black(' ASSUMPTION ') + ' ' + chalk.white(a));
}

export function statusBadge(status: string): string {
  switch (status) {
    case 'new':
      return chalk.bold.bgYellow.black(' NEW ');
    case 'analyzed':
      return chalk.bold.bgBlue.white(' ANALYZED ');
    case 'reproduced':
      return chalk.bold.bgMagenta.white(' REPRODUCED ');
    case 'fixed':
      return chalk.bold.bgCyan.black(' FIXED ');
    case 'verified':
      return chalk.bold.bgGreen.black(' VERIFIED ');
    case 'closed':
      return chalk.bold.bgGray.white(' CLOSED ');
    default:
      return chalk.gray('○ ' + status.toUpperCase());
  }
}

export function aiPredictionBox(label: string): void {
  console.log('');
  console.log(chalk.cyan('  ╭─ AI ' + label + ' ' + '─'.repeat(Math.max(2, 50 - label.length)) + '╮'));
}

export function systemVerificationBox(label: string): void {
  console.log('');
  console.log(chalk.green('  ╭─ SYSTEM VERIFICATION: ' + label + ' ' + '─'.repeat(Math.max(2, 36 - label.length)) + '╮'));
}

export function closedBox(): void {
  console.log(chalk.gray('  ╰' + '─'.repeat(58) + '╯'));
  console.log('');
}
