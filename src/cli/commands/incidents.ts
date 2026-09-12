import { loadIncidents } from '../../storage/store.js';
import { printBanner, printSection, printError } from '../ui/banner.js';
import { printIncidentTable } from '../ui/table.js';
import chalk from 'chalk';

export async function incidentsCommand(): Promise<void> {
  printBanner();

  const projectRoot = process.cwd();

  try {
    const incidents = await loadIncidents(projectRoot);

    if (incidents.length === 0) {
      printError('No incidents found.');
      console.log('');
      console.log('Run: bug-replay scan <path/to/server.log>');
      console.log('');
      return;
    }

    printSection('INCIDENTS');
    printIncidentTable(incidents);

    console.log('');
    console.log(chalk.gray('Commands:'));
    console.log(chalk.white('  bug-replay analyze <id>   — run AI root-cause analysis'));
    console.log(chalk.white('  bug-replay reproduce <id> — generate reproduction test'));
    console.log(chalk.white('  bug-replay fix <id>       — propose a patch'));
    console.log(chalk.white('  bug-replay verify <id>    — run regression test'));
    console.log('');
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

