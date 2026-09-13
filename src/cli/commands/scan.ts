import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import ora from 'ora';
import chalk from 'chalk';
import { parseLogFile } from '../../core/parser/logParser.js';
import { groupEvents } from '../../core/incidents/grouper.js';
import { saveIncidents, saveLogEvents } from '../../storage/store.js';
import { printBanner, printSection, printSuccess, printError, printNextStep } from '../ui/banner.js';
import { printIncidentTable } from '../ui/table.js';

export async function scanCommand(logFile: string): Promise<void> {
  printBanner();

  const resolved = resolve(process.cwd(), logFile);

  if (!existsSync(resolved)) {
    printError(`Log file not found: ${resolved}`);
    console.log('');
    console.log('Usage: bug-replay scan <path/to/server.log>');
    process.exit(1);
  }

  const spinner = ora(`Scanning ${logFile}...`).start();

  try {
    const { events, totalLines, errorCount, warnings } = await parseLogFile(resolved);
    spinner.text = 'Grouping incidents...';

    const projectRoot = process.cwd();
    const { incidents, ungroupedCount } = groupEvents(events, resolved, projectRoot);

    spinner.succeed('Scan complete');
    console.log('');

    printSuccess(`${totalLines.toLocaleString()} log lines parsed`);
    printSuccess(`${errorCount.toLocaleString()} errors detected`);
    printSuccess(`${incidents.length} incident${incidents.length !== 1 ? 's' : ''} identified`);

    if (warnings.length > 0 && process.env['BUGREPLAY_LOG_LEVEL'] === 'debug') {
      console.log(chalk.gray(`  (${warnings.length} parse warnings — set LOG_LEVEL=debug to see all)`));
    }

    // Save state
    await saveIncidents(incidents, resolved, projectRoot);
    await saveLogEvents(events, projectRoot);

    printSection('INCIDENTS');
    printIncidentTable(incidents);

    if (incidents.length > 0) {
      printNextStep(`bug-replay analyze ${incidents[0]?.id ?? 1}`, 'Inspect the most frequent incident and its likely root cause.');
    }
  } catch (err) {
    spinner.fail('Scan failed');
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
