import ora from 'ora';
import chalk from 'chalk';
import {
  getIncident,
  loadAnalysis,
  saveAnalysis,
  loadLogEvents,
  updateIncidentStatus,
} from '../../storage/store.js';
import { collectEvidence } from '../../core/evidence/collector.js';
import { createProvider } from '../../ai/provider.js';
import { loadConfig, requireApiKey } from '../../config.js';
import {
  printBanner,
  printSection,
  printError,
  printFact,
  printHypothesis,
  printAssumption,
  printLabel,
  aiPredictionBox,
  closedBox,
  printNextStep,
} from '../ui/banner.js';
import { printIncidentCard } from '../ui/table.js';
import { renderConfidence, confidenceLabel } from '../ui/confidence.js';
import type { LogEvent } from '../../types/index.js';

export async function analyzeCommand(
  incidentId: number,
  options: { force?: boolean } = {},
): Promise<void> {
  printBanner();

  const projectRoot = process.cwd();

  try {
    // Load incident
    const incident = await getIncident(incidentId, projectRoot);
    if (!incident) {
      printError(`Incident #${incidentId} not found.`);
      console.log('Run: bug-replay scan <logfile>');
      process.exit(1);
    }

    printIncidentCard(incident);

    // Check cache
    if (!options.force) {
      const cached = await loadAnalysis(incidentId, projectRoot);
      if (cached) {
        console.log(chalk.gray('(Using cached analysis — use --force to re-analyze)'));
        printAnalysisResult(cached.incidentId, cached);
        return;
      }
    }

    // Load config and validate API key
    const config = loadConfig();
    requireApiKey(config);

    // Load events
    const rawEvents = await loadLogEvents(projectRoot);
    const events = rawEvents as LogEvent[];

    // Collect evidence
    const spinner = ora('Collecting evidence...').start();
    const evidence = await collectEvidence(incident, events, projectRoot);
    spinner.succeed(
      `Evidence collected: ${evidence.sourceSnippets.length} source snippets, ` +
        `${evidence.relatedLogs.length} log events` +
        (evidence.gitInfo?.isGitRepo ? ', git info' : ''),
    );

    // Show git correlation if found
    if (evidence.gitInfo?.blame?.length) {
      console.log('');
      console.log(chalk.bold.yellow('RECENT CHANGE DETECTED'));
      console.log(chalk.gray('─'.repeat(40)));
      for (const blame of evidence.gitInfo.blame) {
        console.log(chalk.gray('File:     ') + chalk.white(`${blame.file}:${blame.line}`));
        console.log(
          chalk.gray('Modified: ') +
            chalk.white(
              blame.commit.daysAgo === 0
                ? 'today'
                : `${blame.commit.daysAgo} day${blame.commit.daysAgo > 1 ? 's' : ''} ago`,
            ),
        );
        console.log(chalk.gray('Commit:   ') + chalk.white(blame.commit.shortHash));
        console.log(chalk.gray('Message:  ') + chalk.white(`"${blame.commit.message}"`));
        console.log(chalk.gray('Author:   ') + chalk.white(blame.commit.author));
        if (blame.correlationScore !== undefined) {
          console.log(
            chalk.gray('Possible correlation: ') +
              chalk.yellow(`${blame.correlationScore}%`) +
              chalk.gray(' (HYPOTHESIS — not confirmed causation)'),
          );
        }
        console.log('');
      }
    }

    // AI analysis
    const aiSpinner = ora(`Analyzing with AI (${config.model})...`).start();
    const provider = createProvider(config);

    const analysis = await provider.analyzeIncident({
      incident,
      evidence,
      logSample: events
        .filter((e) => e.level === 'error' || e.level === 'warn')
        .slice(0, 30),
    });

    aiSpinner.succeed('AI analysis complete');

    // Save
    await saveAnalysis(analysis, projectRoot);
    await updateIncidentStatus(incidentId, 'analyzed', projectRoot);

    // Display
    printAnalysisResult(incidentId, analysis);

    printNextStep(`bug-replay reproduce ${incidentId}`, 'Generate a regression test that proves the failure.');
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    if (process.env['BUGREPLAY_LOG_LEVEL'] === 'debug') {
      console.error(err);
    }
    process.exit(1);
  }
}

function printAnalysisResult(incidentId: number, analysis: {
  summary: string;
  rootCause: string;
  confidence: number;
  facts: string[];
  hypotheses: string[];
  assumptions: string[];
  reproductionConditions: string[];
  suggestedFix?: string;
  uncertainty: string;
  affectedFiles: string[];
}): void {
  aiPredictionBox('ROOT-CAUSE ANALYSIS');
  console.log('');

  printLabel('Summary:', analysis.summary);
  console.log('');

  console.log(chalk.bold.white('ROOT CAUSE'));
  console.log(chalk.white(analysis.rootCause));
  console.log('');

  console.log(chalk.bold.white('CONFIDENCE'));
  console.log('  ' + renderConfidence(analysis.confidence) + '  ' + confidenceLabel(analysis.confidence));
  console.log('');

  if (analysis.facts.length > 0) {
    console.log(chalk.bold.white('EVIDENCE'));
    for (const fact of analysis.facts) printFact(fact);
    console.log('');
  }

  if (analysis.hypotheses.length > 0) {
    for (const h of analysis.hypotheses) printHypothesis(h);
    console.log('');
  }

  if (analysis.assumptions.length > 0) {
    for (const a of analysis.assumptions) printAssumption(a);
    console.log('');
  }

  if (analysis.reproductionConditions.length > 0) {
    console.log(chalk.bold.white('REPRODUCTION CONDITIONS'));
    analysis.reproductionConditions.forEach((c, i) =>
      console.log(`  ${i + 1}. ${chalk.white(c)}`),
    );
    console.log('');
  }

  if (analysis.suggestedFix) {
    console.log(chalk.bold.white('SUGGESTED FIX'));
    console.log(chalk.green('  ' + analysis.suggestedFix));
    console.log('');
  }

  console.log(chalk.bold.white('UNCERTAINTY'));
  console.log(chalk.gray('  ' + analysis.uncertainty));

  closedBox();

  console.log(chalk.bold.red('STATUS'));
  console.log(chalk.red('🔴 UNVERIFIED — run bug-replay reproduce ' + incidentId + ' to generate test'));
}
