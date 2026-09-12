import type { LogEvent, Incident, StackFrame } from '../../types/index.js';
import { getPrimaryFrame } from '../parser/stackTraceParser.js';
import { randomUUID } from 'node:crypto';

// ── Message normalization ────────────────────────────────────

// Patterns to strip dynamic values from messages before grouping
const NORMALIZATION_PATTERNS: [RegExp, string][] = [
  // Timestamps — MUST come before numeric ID stripping
  [/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '<ts>'],
  // UUIDs
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>'],
  // MongoDB ObjectIds (24 hex chars)
  [/\b[0-9a-f]{24}\b/gi, '<objectid>'],
  // Long hex strings (commit hashes, tokens)
  [/\b[0-9a-f]{16,}\b/gi, '<hex>'],
  // Numeric IDs (standalone numbers)
  [/\b\d{1,12}\b/g, '<n>'],
  // IP addresses
  [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<ip>'],
  // File paths with dynamic segments (keep structure)
  [/\/[^\s"']{20,}/g, '<path>'],
  // Quoted strings (dynamic values in quotes)
  [/"[^"]{0,100}"/g, '"<val>"'],
  [/'[^']{0,100}'/g, "'<val>'"],
  // Email addresses
  [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<email>'],
];

export function normalizeMessage(message: string): string {
  let normalized = message;
  for (const [pattern, replacement] of NORMALIZATION_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }
  // Collapse multiple spaces
  return normalized.replace(/\s{2,}/g, ' ').trim().toLowerCase();
}

// ── Grouping key ─────────────────────────────────────────────

function groupingKey(event: LogEvent): string {
  const errorType = event.errorType ?? 'UnknownError';
  const normalizedMsg = normalizeMessage(event.errorMessage ?? event.message);
  const primaryFrame = event.stackTrace
    ? getPrimaryFrame(event.stackTrace)
    : undefined;
  const file = primaryFrame?.file ?? '';
  const line = primaryFrame?.line ?? 0;

  return `${errorType}|${normalizedMsg}|${file}:${line}`;
}

// ── Incident builder ─────────────────────────────────────────

function getAffectedFiles(events: LogEvent[]): string[] {
  const files = new Set<string>();
  for (const event of events) {
    if (!event.stackTrace) continue;
    for (const frame of event.stackTrace) {
      if (!frame.isInternal && !frame.isNative && frame.file !== '<native>') {
        files.add(frame.file);
      }
    }
  }
  return [...files];
}

function getTitle(event: LogEvent): string {
  const errorType = event.errorType ?? 'Error';
  const msg = event.errorMessage ?? event.message;
  // Truncate to reasonable title length
  const truncated = msg.length > 80 ? msg.slice(0, 77) + '...' : msg;
  return `${errorType}: ${truncated}`;
}

// ── Main grouper ─────────────────────────────────────────────

export interface GroupResult {
  incidents: Incident[];
  ungroupedCount: number;
}

export function groupEvents(
  events: LogEvent[],
  logFile: string,
  projectRoot?: string,
): GroupResult {
  // Only group error-level events that have identifiable errors
  const errorEvents = events.filter(
    (e) =>
      (e.level === 'error' || e.level === 'fatal') &&
      (e.errorType || e.errorMessage || e.stackTrace?.length),
  );

  const groups = new Map<string, LogEvent[]>();

  for (const event of errorEvents) {
    const key = groupingKey(event);
    const existing = groups.get(key);
    if (existing) {
      existing.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  // Sort groups by occurrence count (descending)
  const sortedGroups = [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );

  const incidents: Incident[] = sortedGroups.map(([, groupEvents], idx) => {
    const representative = groupEvents[0]!;
    const primaryFrame = representative.stackTrace
      ? getPrimaryFrame(representative.stackTrace)
      : undefined;
    const timestamps = groupEvents
      .map((e) => e.timestamp)
      .filter((t): t is Date => t !== undefined);
    const sortedTs = [...timestamps].sort((a, b) => a.getTime() - b.getTime());

    return {
      id: idx + 1,
      title: getTitle(representative),
      errorType: representative.errorType ?? 'Error',
      normalizedMessage: normalizeMessage(
        representative.errorMessage ?? representative.message,
      ),
      occurrences: groupEvents.length,
      firstSeen: sortedTs[0],
      lastSeen: sortedTs[sortedTs.length - 1],
      affectedFiles: getAffectedFiles(groupEvents),
      primaryFrame,
      relatedEventIds: groupEvents.map((e) => e.id),
      status: 'new' as const,
      logFile,
      projectRoot,
      createdAt: new Date(),
    };
  });

  const ungroupedCount = events.filter(
    (e) => e.level === 'error' || e.level === 'fatal',
  ).length - errorEvents.length;

  return { incidents, ungroupedCount };
}

/**
 * Get all LogEvents related to an incident from the full event list.
 */
export function getIncidentEvents(
  incident: Incident,
  allEvents: LogEvent[],
): LogEvent[] {
  const idSet = new Set(incident.relatedEventIds);
  return allEvents.filter((e) => idSet.has(e.id));
}

/**
 * Find log events surrounding an incident (for context).
 */
export function getSurroundingEvents(
  incident: Incident,
  allEvents: LogEvent[],
  windowSize = 10,
): LogEvent[] {
  const incidentIds = new Set(incident.relatedEventIds);
  const incidentLineNumbers = allEvents
    .filter((e) => incidentIds.has(e.id))
    .map((e) => e.lineNumber);

  if (incidentLineNumbers.length === 0) return [];

  const minLine = Math.min(...incidentLineNumbers);
  const maxLine = Math.max(...incidentLineNumbers);

  return allEvents.filter(
    (e) =>
      e.lineNumber >= minLine - windowSize &&
      e.lineNumber <= maxLine + windowSize,
  );
}

