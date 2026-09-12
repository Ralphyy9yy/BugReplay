import chalk from 'chalk';
import type { FilePatch } from '../../types/index.js';

/**
 * Render a colored diff for terminal display.
 */
export function renderDiff(patch: FilePatch): void {
  console.log('');
  console.log(chalk.bold(`File: ${patch.file}`));
  console.log(chalk.gray('─'.repeat(60)));

  const origLines = patch.originalContent.split('\n');
  const patchLines = patch.patchedContent.split('\n');

  for (const line of origLines) {
    if (line.trim()) {
      console.log(chalk.red('- ' + line));
    }
  }

  for (const line of patchLines) {
    if (line.trim()) {
      console.log(chalk.green('+ ' + line));
    }
  }

  console.log('');
}

/**
 * Print a full patch proposal with all file patches.
 */
export function renderPatchProposal(
  patches: FilePatch[],
  explanation: string,
  confidence: number,
  warnings: string[],
): void {
  console.log(chalk.bold.white('PROPOSED PATCH'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log('');
  console.log(chalk.white(explanation));
  console.log('');

  for (const patch of patches) {
    renderDiff(patch);
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow('⚠ Warnings:'));
    for (const w of warnings) {
      console.log(chalk.yellow('  ' + w));
    }
    console.log('');
  }
}

