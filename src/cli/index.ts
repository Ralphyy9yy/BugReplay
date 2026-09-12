import { Command } from 'commander';
import { scanCommand } from './commands/scan.js';
import { incidentsCommand } from './commands/incidents.js';
import { analyzeCommand } from './commands/analyze.js';
import { reproduceCommand } from './commands/reproduce.js';
import { fixCommand } from './commands/fix.js';
import { verifyCommand } from './commands/verify.js';
import { reportCommand } from './commands/report.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
  .name('bug-replay')
  .description('AI-assisted debugging CLI — convert failures into verified reproducible tests')
  .version('0.1.0');

// ── Commands ─────────────────────────────────────────────────

program
  .command('scan <logfile>')
  .description('Parse a log file and identify incidents')
  .action(async (logfile: string) => {
    await scanCommand(logfile);
  });

program
  .command('incidents')
  .description('List all identified incidents')
  .action(async () => {
    await incidentsCommand();
  });

program
  .command('analyze <id>')
  .description('Run AI root-cause analysis on an incident')
  .option('-f, --force', 'Re-analyze even if cached result exists')
  .action(async (id: string, options: { force?: boolean }) => {
    const incidentId = parseInt(id, 10);
    if (isNaN(incidentId) || incidentId < 1) {
      console.error('Error: incident ID must be a positive integer');
      process.exit(1);
    }
    await analyzeCommand(incidentId, options);
  });

program
  .command('reproduce <id>')
  .description('Generate a reproduction plan and regression test')
  .option('-f, --force', 'Overwrite existing test file if present')
  .action(async (id: string, options: { force?: boolean }) => {
    const incidentId = parseInt(id, 10);
    if (isNaN(incidentId)) {
      console.error('Error: incident ID must be a positive integer');
      process.exit(1);
    }
    await reproduceCommand(incidentId, options);
  });

program
  .command('fix <id>')
  .description('Propose and optionally apply a code patch')
  .option('--apply', 'Apply the patch without prompting')
  .action(async (id: string, options: { apply?: boolean }) => {
    const incidentId = parseInt(id, 10);
    if (isNaN(incidentId)) {
      console.error('Error: incident ID must be a positive integer');
      process.exit(1);
    }
    await fixCommand(incidentId, options);
  });

program
  .command('verify <id>')
  .description('Run the regression test and verify the result')
  .action(async (id: string) => {
    const incidentId = parseInt(id, 10);
    if (isNaN(incidentId)) {
      console.error('Error: incident ID must be a positive integer');
      process.exit(1);
    }
    await verifyCommand(incidentId);
  });

program
  .command('report <id>')
  .description('Generate a full markdown incident report')
  .action(async (id: string) => {
    const incidentId = parseInt(id, 10);
    if (isNaN(incidentId)) {
      console.error('Error: incident ID must be a positive integer');
      process.exit(1);
    }
    await reportCommand(incidentId);
  });

program
  .command('config')
  .description('Show current BugReplay configuration')
  .action(() => {
    configCommand();
  });

// ── Error handling ────────────────────────────────────────────

program.configureOutput({
  writeErr: (str) => process.stderr.write(str),
});

program.exitOverride((err) => {
  if (err.code === 'commander.helpDisplayed') process.exit(0);
  if (err.code === 'commander.version') process.exit(0);
  process.exit(1);
});

// ── Run ───────────────────────────────────────────────────────

program.parse(process.argv);

// Show help if no command given
if (process.argv.length <= 2) {
  program.help();
}

