import chalk from 'chalk';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  getIncident,
  loadAnalysis,
  loadReproduction,
  loadPatch,
  loadVerifications,
} from '../../storage/store.js';
import { printBanner, printError, printSuccess } from '../ui/banner.js';

export async function reportCommand(incidentId: number): Promise<void> {
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
    const patch = await loadPatch(incidentId, projectRoot);
    const verifications = await loadVerifications(incidentId, projectRoot);

    const reportPath = resolve(
      projectRoot,
      `.bugreplay/report-incident-${String(incidentId).padStart(3, '0')}.md`,
    );

    const report = buildMarkdownReport(
      incident,
      analysis,
      reproduction,
      patch,
      verifications,
    );

    await writeFile(reportPath, report, 'utf8');
    printSuccess(`Report saved: ${reportPath}`);
    console.log('');
    console.log(chalk.gray('Preview:'));
    console.log(report.slice(0, 1000));
    if (report.length > 1000) {
      console.log(chalk.gray(`... (${report.length} chars total — see file)`));
    }
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

function buildMarkdownReport(
  incident: unknown,
  analysis: unknown,
  reproduction: unknown,
  patch: unknown,
  verifications: unknown[],
): string {
  const i = incident as Record<string, unknown>;
  const a = analysis as Record<string, unknown> | undefined;
  const r = reproduction as Record<string, unknown> | undefined;
  const p = patch as Record<string, unknown> | undefined;

  const lines: string[] = [
    `# BugReplay Incident Report`,
    ``,
    `**Incident #${i['id']}** — ${i['title']}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `---`,
    ``,
    `## Summary`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Error Type | \`${i['errorType']}\` |`,
    `| Occurrences | ${i['occurrences']} |`,
    `| Status | ${i['status']} |`,
    `| First Seen | ${i['firstSeen'] ? new Date(i['firstSeen'] as string).toISOString() : 'unknown'} |`,
    `| Last Seen | ${i['lastSeen'] ? new Date(i['lastSeen'] as string).toISOString() : 'unknown'} |`,
    ``,
  ];

  if (i['primaryFrame']) {
    const f = i['primaryFrame'] as Record<string, unknown>;
    lines.push(`**Location:** \`${f['file']}:${f['line']}\``);
    lines.push('');
  }

  if (a) {
    lines.push(`## Root Cause Analysis`, ``);
    lines.push(`**Confidence:** ${a['confidence']}%`, ``);
    lines.push(`**Summary:** ${a['summary']}`, ``);
    lines.push(`**Root Cause:**`, ``, `> ${String(a['rootCause']).replace(/\n/g, '\n> ')}`, ``);

    if (Array.isArray(a['facts']) && a['facts'].length > 0) {
      lines.push(`### Facts`, ``);
      (a['facts'] as string[]).forEach((f) => lines.push(`- ✓ ${f}`));
      lines.push('');
    }

    if (Array.isArray(a['hypotheses']) && a['hypotheses'].length > 0) {
      lines.push(`### Hypotheses`, ``);
      (a['hypotheses'] as string[]).forEach((h) => lines.push(`- ~ ${h}`));
      lines.push('');
    }

    if (a['suggestedFix']) {
      lines.push(`### Suggested Fix`, ``, `${a['suggestedFix']}`, ``);
    }

    lines.push(`**Uncertainty:** ${a['uncertainty']}`, ``);
  }

  if (r) {
    lines.push(`## Reproduction Plan`, ``);
    lines.push(`${r['summary']}`, ``);
    if (Array.isArray(r['steps'])) {
      (r['steps'] as Array<Record<string, unknown>>).forEach((s) => {
        lines.push(`${s['order']}. ${s['description']}`);
      });
      lines.push('');
    }
    if (r['generatedTestPath']) {
      lines.push(`**Generated Test:** \`${r['generatedTestPath']}\``, ``);
    }
  }

  if (p) {
    lines.push(`## Patch Proposal`, ``);
    lines.push(`**Confidence:** ${p['confidence']}%`, ``);
    lines.push(`${p['explanation']}`, ``);
    if (Array.isArray(p['patches'])) {
      (p['patches'] as Array<Record<string, unknown>>).forEach((patch) => {
        lines.push(
          `### \`${patch['file']}\``,
          ``,
          `\`\`\`diff`,
          ...String(patch['originalContent'] ?? '').split('\n').map((l) => `- ${l}`),
          ...String(patch['patchedContent'] ?? '').split('\n').map((l) => `+ ${l}`),
          `\`\`\``,
          ``,
        );
      });
    }
  }

  if (verifications.length > 0) {
    lines.push(`## Verification Results`, ``);
    verifications.forEach((v, i) => {
      const ver = v as Record<string, unknown>;
      const tr = ver['testResult'] as Record<string, unknown>;
      lines.push(
        `### Verification ${i + 1}`,
        ``,
        `- **Phase:** ${ver['phase']}`,
        `- **Test passed:** ${tr['passed'] ? '✓ Yes' : '✗ No'}`,
        `- **Duration:** ${tr['durationMs']}ms`,
        `- **AI prediction correct:** ${ver['aiPredictionCorrect'] ? '✓' : '✗'}`,
        ``,
      );
    });
  }

  return lines.join('\n');
}

