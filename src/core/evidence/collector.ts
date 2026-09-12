import { resolve } from 'node:path';
import type {
  Incident,
  LogEvent,
  Evidence,
  SourceSnippet,
} from '../../types/index.js';
import {
  readSourceSnippet,
  findTestFiles,
  readPackageInfo,
} from '../../integrations/filesystem.js';
import { collectGitInfo } from '../../integrations/git.js';
import { redact } from '../../security/redaction.js';
import { getPrimaryFrame } from '../parser/stackTraceParser.js';
import { getIncidentEvents } from '../incidents/grouper.js';

const MAX_RELATED_LOGS = 50;
const CONTEXT_LINES = 30;

export async function collectEvidence(
  incident: Incident,
  allEvents: LogEvent[],
  projectRoot: string,
): Promise<Evidence> {
  const relatedEvents = getIncidentEvents(incident, allEvents);

  // ── 1. Source snippets ───────────────────────────────────

  const sourceSnippets: SourceSnippet[] = [];
  const seenFiles = new Set<string>();

  // Primary frame first
  if (incident.primaryFrame) {
    const { file, line } = incident.primaryFrame;
    const snippet = await readSourceSnippet(file, line, projectRoot, CONTEXT_LINES);
    if (snippet.exists) {
      // Redact the code before storing
      const { redacted: cleanCode } = redact(snippet.code);
      sourceSnippets.push({ ...snippet, code: cleanCode });
      seenFiles.add(snippet.file);
    }
  }

  // Other affected files (first non-internal frame of each event)
  for (const event of relatedEvents.slice(0, 5)) {
    if (!event.stackTrace) continue;
    const primary = getPrimaryFrame(event.stackTrace);
    if (!primary || seenFiles.has(primary.file)) continue;

    const snippet = await readSourceSnippet(
      primary.file,
      primary.line,
      projectRoot,
      CONTEXT_LINES,
    );
    if (snippet.exists) {
      const { redacted: cleanCode } = redact(snippet.code);
      sourceSnippets.push({ ...snippet, code: cleanCode });
      seenFiles.add(snippet.file);
    }
  }

  // Additional affected files from incident
  for (const file of incident.affectedFiles.slice(0, 3)) {
    if (seenFiles.has(file) || seenFiles.has(resolve(projectRoot, file))) continue;
    const snippet = await readSourceSnippet(file, 1, projectRoot, CONTEXT_LINES);
    if (snippet.exists) {
      const { redacted: cleanCode } = redact(snippet.code);
      sourceSnippets.push({ ...snippet, code: cleanCode });
      seenFiles.add(snippet.file);
    }
  }

  // ── 2. Related log events (capped, redacted) ─────────────

  const relatedLogs = relatedEvents
    .slice(0, MAX_RELATED_LOGS)
    .map((e) => {
      const { redacted: cleanMsg } = redact(e.message);
      return { ...e, message: cleanMsg, raw: '[raw redacted]' };
    });

  // ── 3. Git information ────────────────────────────────────

  const gitInfo = await collectGitInfo(
    incident.affectedFiles,
    incident.primaryFrame,
    projectRoot,
  );

  // ── 4. Test files ─────────────────────────────────────────

  const searchTerms = [
    ...incident.affectedFiles.map((f) => f.split('/').pop() ?? f),
    incident.errorType,
  ].filter(Boolean);

  const testFiles = await findTestFiles(projectRoot, searchTerms);

  // ── 5. Package info ───────────────────────────────────────

  const packageInfo = await readPackageInfo(projectRoot);

  return {
    incidentId: incident.id,
    sourceSnippets,
    stackTrace: incident.primaryFrame ? [incident.primaryFrame] : undefined,
    relatedLogs,
    gitInfo,
    testFiles,
    packageInfo,
    collectedAt: new Date(),
  };
}

