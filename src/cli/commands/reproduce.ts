import ora from 'ora';
import chalk from 'chalk';
import {
  getIncident,
  loadAnalysis,
  loadLogEvents,
  saveReproduction,
  updateIncidentStatus,
} from '../../storage/store.js';
import { collectEvidence } from '../../core/evidence/collector.js';
import { writeReproductionTest } from '../../core/reproduction/generator.js';
import { createProvider } from '../../ai/provider.js';
import { loadConfig, requireApiKey } from '../../config.js';
import {
  printBanner,
  printSection,
  printError,
  printSuccess,
  printWarning,
  aiPredictionBox,
  closedBox,
  printNextStep,
} from '../ui/banner.js';
import { printIncidentCard } from '../ui/table.js';
import type { LogEvent } from '../../types/index.js';

export async function reproduceCommand(
  incidentId: number,
  options: { force?: boolean } = {},
): Promise<void> {
  printBanner();

  const projectRoot = process.cwd();

  try {
    const incident = await getIncident(incidentId, projectRoot);
    if (!incident) {
      printError(`Incident #${incidentId} not found.`);
      process.exit(1);
    }

    const analysis = await loadAnalysis(incidentId, projectRoot);
    if (!analysis) {
      printError(`No analysis found for incident #${incidentId}.`);
      console.log(`Run: bug-replay analyze ${incidentId}`);
      process.exit(1);
    }

    printIncidentCard(incident);

    const config = loadConfig();
    requireApiKey(config);

    const rawEvents = await loadLogEvents(projectRoot);
    const events = rawEvents as LogEvent[];

    const spinner = ora('Collecting evidence...').start();
    const evidence = await collectEvidence(incident, events, projectRoot);
    spinner.succeed('Evidence collected');

    const aiSpinner = ora('Generating reproduction plan...').start();
    const provider = createProvider(config);

    const plan = await provider.generateReproduction({ incident, analysis, evidence });
    aiSpinner.succeed('Reproduction plan generated');

    // Write test file
    const testSpinner = ora('Writing regression test...').start();
    const testPath = await writeReproductionTest(plan, incident, projectRoot, options.force);
    plan.generatedTestPath = testPath;
    testSpinner.succeed(`Test written: ${testPath}`);

    // Save
    await saveReproduction(plan, projectRoot);
    await updateIncidentStatus(incidentId, 'reproduced', projectRoot);

    // Display plan
    aiPredictionBox('REPRODUCTION PLAN');
    console.log('');
    console.log(chalk.white(plan.summary));
    console.log('');

    if (plan.preconditions.length > 0) {
      console.log(chalk.bold.white('PRECONDITIONS'));
      for (const p of plan.preconditions) {
        console.log(chalk.gray('  • ') + chalk.white(p));
      }
      console.log('');
    }

    console.log(chalk.bold.white('STEPS'));
    for (const step of plan.steps) {
      console.log(chalk.white(`  ${step.order}. ${step.description}`));
      if (step.code) {
        console.log(chalk.gray('     ' + step.code));
      }
    }
    console.log('');

    console.log(chalk.bold.white('EXPECTED FAILURE'));
    console.log(chalk.red('  ' + plan.expectedFailure));

    closedBox();

    console.log('');
    printSuccess(`Generated test: ${testPath}`);
    printNextStep(`bug-replay verify ${incidentId}`, 'Run the generated test and confirm the bug is reproducible.');
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
