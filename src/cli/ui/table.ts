import chalk from 'chalk';
import type { Incident } from '../../types/index.js';
import { statusBadge } from './banner.js';

/**
 * Print a formatted incident table.
 */
export function printIncidentTable(incidents: Incident[]): void {
  if (incidents.length === 0) {
    console.log(chalk.gray('No incidents found. Run: bug-replay scan <logfile>'));
    return;
  }

  const colWidths = { id: 4, type: 24, occ: 12, status: 14, location: 30 };

  // Header
  console.log(
    chalk.bold(
      ' ' +
        '#'.padEnd(colWidths.id) +
        'Error Type'.padEnd(colWidths.type) +
        'Occurrences'.padEnd(colWidths.occ) +
        'Status'.padEnd(colWidths.status) +
        'Location',
    ),
  );
  console.log(chalk.gray('─'.repeat(90)));

  for (const incident of incidents) {
    const id = `#${incident.id}`.padEnd(colWidths.id);
    const errorType = truncate(incident.errorType, colWidths.type - 1).padEnd(colWidths.type);
    const occ = String(incident.occurrences).padEnd(colWidths.occ);
    const status = statusBadge(incident.status).padEnd(colWidths.status + 10); // chalk adds chars

    const location = incident.primaryFrame
      ? truncate(
          `${incident.primaryFrame.file.split('/').slice(-2).join('/')}:${incident.primaryFrame.line}`,
          colWidths.location,
        )
      : chalk.gray('unknown');

    const row =
      ' ' +
      chalk.bold.white(id) +
      chalk.yellow(errorType) +
      chalk.white(occ) +
      status +
      chalk.gray(location);

    console.log(row);
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

