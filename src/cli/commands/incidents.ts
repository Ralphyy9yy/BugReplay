import { loadIncidents } from '../../storage/store.js';
import { printBanner, printCommand, printError, printSection } from '../ui/banner.js';
import { printIncidentTable } from '../ui/table.js';
import chalk from 'chalk';

export async function incidentsCommand(): Promise<void> {
  printBanner();

  try {
    const incidents = await loadIncidents(process.cwd());

    if (incidents.length === 0) {
      printError('No incidents found.');
      console.log('');
      printCommand('bug-replay scan <logfile>', 'Scan a log file to get started');
      console.log('');
      return;
    }

    printSection(`${incidents.length} INCIDENT${incidents.length === 1 ? '' : 'S'}`);
    printIncidentTable(incidents);

    console.log('');
    console.log(chalk.bold.cyan('  AVAILABLE ACTIONS'));
    printCommand('bug-replay analyze <id>', 'Find the likely root cause');
    printCommand('bug-replay reproduce <id>', 'Generate a regression test');
    printCommand('bug-replay fix <id>', 'Propose a source patch');
    printCommand('bug-replay verify <id>', 'Verify reproduction or fix');
    console.log('');
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
