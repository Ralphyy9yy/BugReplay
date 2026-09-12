import chalk from 'chalk';
import type { Incident } from '../../types/index.js';
import { statusBadge } from './banner.js';

/**
 * Print a formatted incident table.
 */
function padVisible(str: string, width: number): string {
  const visible = str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  const diff = Math.max(0, width - visible.length);
  return str + ' '.repeat(diff);
}

export function printIncidentTable(incidents: Incident[]): void {
  if (incidents.length === 0) {
    console.log(chalk.gray('  No incidents found. Run: bug-replay scan <logfile>'));
    return;
  }

  const colWidths = { id: 6, type: 22, occ: 14, status: 16, location: 28 };

  // Header
  console.log(
    '  ' +
      chalk.bold.gray('#'.padEnd(colWidths.id)) +
      chalk.bold.white('ERROR TYPE'.padEnd(colWidths.type)) +
      chalk.bold.white('HITS'.padEnd(colWidths.occ)) +
      chalk.bold.white('STATUS'.padEnd(colWidths.status)) +
      chalk.bold.white('PRIMARY LOCATION'),
  );
  console.log(chalk.gray('  ' + '─'.repeat(84)));

  for (const incident of incidents) {
    const id = padVisible(chalk.cyan(`#${incident.id}`), colWidths.id);
    const errorType = padVisible(chalk.yellow.bold(truncate(incident.errorType, colWidths.type - 2)), colWidths.type);
    const occ = padVisible(chalk.white(String(incident.occurrences)), colWidths.occ);
    const status = padVisible(statusBadge(incident.status), colWidths.status);

    const location = incident.primaryFrame
      ? chalk.dim(
          truncate(
            `${incident.primaryFrame.file.replace(/\\/g, '/').split('/').slice(-2).join('/')}:${incident.primaryFrame.line}`,
            colWidths.location,
          ),
        )
      : chalk.gray('unknown');

    console.log('  ' + id + errorType + occ + status + location);
  }
}

/**
 * Print incident detail card.
 */
export function printIncidentCard(incident: Incident): void {
  console.log('');
  console.log(chalk.bold.white(`INCIDENT #${incident.id}`));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.bold.yellow(incident.errorType));
  console.log(chalk.white(incident.title.replace(`${incident.errorType}: `, '')));
  console.log('');

  if (incident.primaryFrame) {
    console.log(chalk.gray('Location:'));
    console.log(
      chalk.white(
        `  ${incident.primaryFrame.file}:${incident.primaryFrame.line}`,
      ),
    );
    console.log('');
  }

  console.log(chalk.gray('Occurrences:  ') + chalk.white(String(incident.occurrences)));

  if (incident.firstSeen) {
    console.log(chalk.gray('First seen:   ') + chalk.white(formatDate(incident.firstSeen)));
  }
  if (incident.lastSeen) {
    console.log(chalk.gray('Last seen:    ') + chalk.white(formatDate(incident.lastSeen)));
  }

  console.log(chalk.gray('Status:       ') + statusBadge(incident.status));
  console.log('');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function formatDate(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (mins > 0) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  return 'just now';
}

