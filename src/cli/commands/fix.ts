import ora from 'ora';
import chalk from 'chalk';
import { createInterface } from 'node:readline';
import {
  getIncident,
  loadAnalysis,
  loadReproduction,
  loadLogEvents,
  savePatch,
  updateIncidentStatus,
} from '../../storage/store.js';
import { collectEvidence } from '../../core/evidence/collector.js';
import { applyPatch } from '../../core/patching/patcher.js';
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
import { renderPatchProposal } from '../ui/diff.js';
import { renderConfidence } from '../ui/confidence.js';
import type { LogEvent } from '../../types/index.js';

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

export async function fixCommand(
  incidentId: number,
  options: { force?: boolean; apply?: boolean } = {},
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
    const reproduction = await loadReproduction(incidentId, projectRoot);

    const spinner = ora('Collecting evidence...').start();
    const evidence = await collectEvidence(incident, events, projectRoot);
    spinner.succeed('Evidence collected');

    const aiSpinner = ora('Generating patch proposal...').start();
    const provider = createProvider(config);

    const patchProposal = await provider.generatePatch({
      incident,
      analysis,
      evidence,
      reproduction: reproduction ?? undefined,
    });
    aiSpinner.succeed('Patch proposal generated');

    // Save proposal
    await savePatch(patchProposal, projectRoot);

    // Display proposal
    aiPredictionBox('PATCH PROPOSAL');
    console.log('');
    console.log(chalk.gray('Confidence: ') + renderConfidence(patchProposal.confidence));
    console.log('');
    renderPatchProposal(
      patchProposal.patches,
      patchProposal.explanation,
      patchProposal.confidence,
      patchProposal.warnings,
    );
    closedBox();

    // Prompt for confirmation
    const shouldApply =
      options.apply ?? (await confirm(chalk.bold.yellow('Apply patch? [y/N] ')));

    if (!shouldApply) {
      console.log('');
      console.log(chalk.gray('Patch not applied.'));
      console.log(chalk.gray('Run again and answer y to apply, or:'));
      console.log(chalk.white(`  bug-replay fix ${incidentId} --apply`));
      console.log('');
      return;
    }

    // Apply
    const applySpinner = ora('Applying patch...').start();
    const result = await applyPatch(patchProposal, projectRoot);
    applySpinner.stop();

    if (result.success) {
      printSuccess(`Patch applied to: ${result.appliedFiles.join(', ')}`);
      printSuccess(`Backup saved as: ${result.backupFiles.join(', ')}`);
      await updateIncidentStatus(incidentId, 'fixed', projectRoot);
    } else {
      for (const e of result.errors) {
        printError(e);
      }
      process.exit(1);
    }

    printNextStep(`bug-replay verify ${incidentId}`, 'Re-run the regression test and verify the patch.');
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
