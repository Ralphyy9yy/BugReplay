import ora from 'ora';
import chalk from 'chalk';
import {
  getIncident,
  loadAnalysis,
  loadReproduction,
  loadPatch,
  saveVerification,
  updateIncidentStatus,
} from '../../storage/store.js';
import { getTestFilePath } from '../../core/reproduction/generator.js';
import { runTestFile } from '../../integrations/test-runner.js';
import {
  printBanner,
  printError,
  printSuccess,
  aiPredictionBox,
  systemVerificationBox,
  closedBox,
} from '../ui/banner.js';
import { printIncidentCard } from '../ui/table.js';
import { renderConfidence } from '../ui/confidence.js';
import type { VerificationResult } from '../../types/index.js';
import { existsSync } from 'node:fs';

export async function verifyCommand(incidentId: number): Promise<void> {
  printBanner();

  const projectRoot = process.cwd();

  try {
    const incident = await getIncident(incidentId, projectRoot);
    if (!incident) {
      printError(`Incident #${incidentId} not found.`);
      process.exit(1);
    }

    const analysis = await loadAnalysis(incidentId, projectRoot);
    const reproduction = await loadReproduction(incidentId, projectRoot);

    if (!reproduction) {
      printError(`No reproduction plan found for incident #${incidentId}.`);
      console.log(`Run: bug-replay reproduce ${incidentId}`);
      process.exit(1);
    }

    printIncidentCard(incident);

    // Determine test file
    const testPath =
      reproduction.generatedTestPath ?? getTestFilePath(incidentId, projectRoot);

    if (!existsSync(testPath)) {
      printError(`Test file not found: ${testPath}`);
      console.log(`Run: bug-replay reproduce ${incidentId}`);
      process.exit(1);
    }

    // Show AI prediction
    if (analysis) {
      aiPredictionBox('PREDICTION');
      console.log('');
      console.log(chalk.gray('Confidence:  ') + renderConfidence(analysis.confidence));
      console.log(chalk.gray('Root cause:  ') + chalk.white(analysis.summary));
      console.log('');
      console.log(chalk.gray('Expected failure:'));
      console.log(chalk.red('  ' + reproduction.expectedFailure));
      closedBox();
    }

    // Run the test
    const spinner = ora(`Running test: ${testPath.split('/').slice(-3).join('/')}...`).start();
    const testResult = await runTestFile(testPath, projectRoot);
    spinner.stop();

    // Display actual result
    systemVerificationBox('TEST EXECUTION');
    console.log('');
    console.log(chalk.gray('Test file: ') + chalk.white(testPath.split(/[/\\]/).slice(-3).join('/')));
    console.log(chalk.gray('Duration:  ') + chalk.white(`${testResult.durationMs}ms`));
    console.log(chalk.gray('Exit code: ') + chalk.white(String(testResult.exitCode)));
    console.log('');

    // Determine what the test result means
    const patchApplied = incident.status === 'fixed' || incident.status === 'verified';

    if (patchApplied) {
      // After patch: we want the test to PASS
      if (testResult.passed) {
        console.log(chalk.bold.green('✓ Regression test PASSES'));
        console.log(chalk.green('✓ Bug verified as resolved'));
        await updateIncidentStatus(incidentId, 'verified', projectRoot);
      } else {
        console.log(chalk.bold.red('✗ Regression test FAILS'));
        console.log(chalk.red('✗ Patch did not fix the bug'));
        if (testResult.failureReason) {
          console.log(chalk.gray('  Failure: ') + chalk.red(testResult.failureReason));
        }
      }
    } else {
      // Before patch: we want the test to FAIL (bug reproduced)
      if (!testResult.passed) {
        console.log(chalk.bold.green('✓ Bug reproduced'));
        console.log(chalk.green('✓ Test correctly fails on the buggy code'));
        if (testResult.failureReason) {
          console.log(chalk.gray('  Failure: ') + chalk.yellow(testResult.failureReason));
        }
      } else {
        console.log(chalk.bold.yellow('⚠ Test unexpectedly PASSES'));
        console.log(chalk.yellow('⚠ Either the bug was already fixed, or the test does not reproduce it'));
      }
    }

    console.log('');

    // Trim output if too long
    const output = testResult.output.slice(0, 2000);
    if (output.trim()) {
      console.log(chalk.gray('── Test output ──────────────────────────────────────'));
      console.log(chalk.gray(output));
      console.log(chalk.gray('─────────────────────────────────────────────────────'));
    }

    closedBox();

    // Save verification
    const verification: VerificationResult = {
      incidentId,
      phase: patchApplied ? 'patch' : 'reproduction',
      testResult,
      aiPrediction: analysis?.summary,
      aiPredictionCorrect: patchApplied ? testResult.passed : !testResult.passed,
      verifiedAt: new Date(),
    };
    await saveVerification(verification, projectRoot);

    // Summary
    console.log('');
    if (!patchApplied && !testResult.passed) {
      console.log(chalk.bold.white('BEFORE'));
      console.log(chalk.red('🔴 Bug reproduced'));
      console.log('');
      console.log(chalk.gray('Next: apply a fix with'));
      console.log(chalk.white(`  bug-replay fix ${incidentId}`));
    } else if (patchApplied && testResult.passed) {
      console.log(chalk.bold.white('AFTER'));
      console.log(chalk.green('✓ Patch applied'));
      console.log(chalk.green('✓ Regression test passes'));
      console.log(chalk.green('✓ Bug verified as resolved'));
    }
    console.log('');
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

