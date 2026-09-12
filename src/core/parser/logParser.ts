import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import type { LogEvent, LogLevel, StackFrame } from '../../types/index.js';
import { parseStackTrace, extractErrorHeader } from './stackTraceParser.js';

// ── Regex patterns for various log formats ───────────────────

// JSON log line (Winston, Pino, Bunyan style)
const JSON_LINE_RE = /^\s*\{.*\}\s*$/;

// [2024-01-15T10:30:00.000Z] [ERROR] message  (bracket style)
const BRACKET_LOG_RE =
  /^\[([^\]]+)\]\s+\[(\w+)\]\s+(.+)$/;

// 2024-01-15T10:30:00.000Z ERROR message  (plain prefix style)
const PREFIX_LOG_RE =
  /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+(\w+)\s+(.+)$/;

// Morgan HTTP log: ::1 - - [15/Jan/2024:10:30:00 +0000] "GET /api/checkout HTTP/1.1" 500 245
const MORGAN_RE =
  /^[\d.:a-fA-F]+\s+-\s+-\s+\[([^\]]+)\]\s+"(\w+)\s+([^\s"]+)[^"]*"\s+(\d{3})\s+(\d+|-)/;

// Morgan dev format: GET /api/checkout 500 45.321 ms
const MORGAN_DEV_RE = /^(\w+)\s+(\/[^\s]*)\s+(\d{3})\s+([\d.]+)\s+ms/;

// Simple: "ERROR: message" or "Error: message"
const SIMPLE_LEVEL_RE = /^(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)\s*:\s*(.+)$/i;

// Stack trace continuation line
const STACK_FRAME_RE = /^\s+at\s+/;

// Request ID patterns
const REQUEST_ID_RE =
  /(?:requestId|reqId|req_id|x-request-id|traceId|correlationId)[=:\s"']+([a-zA-Z0-9_-]{6,64})/i;

// ── Level normalization ──────────────────────────────────────

function normalizeLevel(raw: string): LogLevel {
  const upper = raw.toUpperCase();
  const map: Record<string, LogLevel> = {
    TRACE: 'trace',
    DEBUG: 'debug',
    VERBOSE: 'debug',
    INFO: 'info',
    INFORMATION: 'info',
    NOTICE: 'info',
    WARN: 'warn',
    WARNING: 'warn',
    ERROR: 'error',
    ERR: 'error',
    CRITICAL: 'fatal',
    FATAL: 'fatal',
    CRIT: 'fatal',
  };
  return map[upper] ?? 'unknown';
}

// ── Timestamp parsing ────────────────────────────────────────

function parseTimestamp(raw: string): Date | undefined {
  try {
    // Try ISO 8601 first
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;

    // Try Morgan/Apache format: 15/Jan/2024:10:30:00 +0000
    const morganMatch = /(\d{2})\/(\w+)\/(\d{4}):(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})/.exec(raw);
    if (morganMatch) {
      const [, day, mon, year, time, tz] = morganMatch;
      return new Date(`${day} ${mon} ${year} ${time} ${tz}`);
    }
  } catch {
    // ignore
  }
  return undefined;
}

// ── JSON log parsing ─────────────────────────────────────────

interface JsonLogShape {
  time?: string | number;
  timestamp?: string;
  ts?: string | number;
  '@timestamp'?: string;
  level?: string | number;
  severity?: string;
  msg?: string;
  message?: string;
  err?: { type?: string; message?: string; stack?: string };
  error?: { type?: string; message?: string; stack?: string } | string;
  stack?: string;
  reqId?: string;
  requestId?: string;
  req?: { method?: string; url?: string; id?: string };
  res?: { statusCode?: number };
  responseTime?: number;
  [key: string]: unknown;
}

function parseJsonLine(
  raw: string,
  lineNumber: number,
): LogEvent | undefined {
  try {
    const obj = JSON.parse(raw) as JsonLogShape;
    if (typeof obj !== 'object' || obj === null) return undefined;

    const id = randomUUID();

    // Timestamp
    const tsRaw =
      obj.time ?? obj.timestamp ?? obj.ts ?? obj['@timestamp'];
    const timestamp =
      tsRaw !== undefined
        ? parseTimestamp(
            typeof tsRaw === 'number' ? new Date(tsRaw).toISOString() : String(tsRaw),
          )
        : undefined;

    // Level
    const levelRaw = obj.level ?? obj.severity ?? 'unknown';
    const level = normalizeLevel(
      typeof levelRaw === 'number'
        ? pinoLevelToName(levelRaw)
        : String(levelRaw),
    );

    // Message
    const message = String(obj.msg ?? obj.message ?? '');

    // Error details
    const errObj =
      typeof obj.err === 'object'
        ? obj.err
        : typeof obj.error === 'object'
        ? obj.error
        : undefined;
    const errStr =
      typeof obj.error === 'string' ? obj.error : undefined;
    const stackRaw =
      (errObj as JsonLogShape | undefined)?.stack ?? obj.stack ?? errStr;
    const stackTrace =
      stackRaw ? parseStackTrace(String(stackRaw)) : undefined;
    const errHeader =
      stackRaw ? extractErrorHeader(String(stackRaw)) : undefined;
    const errorType =
      (errObj as JsonLogShape | undefined)?.type ??
      errHeader?.errorType;
    const errorMessage =
      (errObj as JsonLogShape | undefined)?.message ??
      errHeader?.errorMessage ??
      message;

    // HTTP
    const reqId =
      obj.reqId ?? obj.requestId ?? (obj.req as Record<string,unknown> | undefined)?.id;
    const req = obj.req as { method?: string; url?: string } | undefined;
    const res = obj.res as { statusCode?: number } | undefined;

    return {
      id,
      raw,
      timestamp,
      level,
      message: message || errorMessage || raw,
      errorType: errorType ? String(errorType) : undefined,
      errorMessage: errorMessage ? String(errorMessage) : undefined,
      stackTrace,
      requestId: reqId ? String(reqId) : undefined,
      httpMethod: req?.method,
      endpoint: req?.url,
      statusCode: res?.statusCode,
      durationMs:
        typeof obj.responseTime === 'number' ? obj.responseTime : undefined,
      lineNumber,
    };
  } catch {
    return undefined;
  }
}

// Pino numeric level to name
function pinoLevelToName(n: number): string {
  if (n <= 10) return 'trace';
  if (n <= 20) return 'debug';
  if (n <= 30) return 'info';
  if (n <= 40) return 'warn';
  if (n <= 50) return 'error';
  return 'fatal';
}

// ── Plain text log parsing ───────────────────────────────────

function parsePlainLine(
  raw: string,
  lineNumber: number,
  pendingStack: string[],
): LogEvent | undefined {
  const id = randomUUID();

  // Morgan combined
  const morganMatch = MORGAN_RE.exec(raw);
  if (morganMatch) {
    const [, ts, method, url, status] = morganMatch;
    return {
      id,
      raw,
      timestamp: parseTimestamp(ts ?? ''),
      level: parseInt(status ?? '200', 10) >= 500 ? 'error' : 'info',
      message: raw.trim(),
      httpMethod: method,
      endpoint: url,
      statusCode: parseInt(status ?? '200', 10),
      lineNumber,
    };
  }

  // Morgan dev
  const morganDevMatch = MORGAN_DEV_RE.exec(raw);
  if (morganDevMatch) {
    const [, method, url, status, ms] = morganDevMatch;
    return {
      id,
      raw,
      level: parseInt(status ?? '200', 10) >= 500 ? 'error' : 'info',
      message: raw.trim(),
      httpMethod: method,
      endpoint: url,
      statusCode: parseInt(status ?? '200', 10),
      durationMs: parseFloat(ms ?? '0'),
      lineNumber,
    };
  }

  // Bracket format [TIMESTAMP] [LEVEL] message
  const bracketMatch = BRACKET_LOG_RE.exec(raw);
  if (bracketMatch) {
    const [, ts, lvl, msg] = bracketMatch;
    const level = normalizeLevel(lvl ?? 'unknown');
    const reqIdMatch = REQUEST_ID_RE.exec(msg ?? '');
    return {
      id,
      raw,
      timestamp: parseTimestamp(ts ?? ''),
      level,
      message: (msg ?? '').trim(),
      requestId: reqIdMatch?.[1],
      lineNumber,
    };
  }

  // Prefix format: TIMESTAMP LEVEL message
  const prefixMatch = PREFIX_LOG_RE.exec(raw);
  if (prefixMatch) {
    const [, ts, lvl, msg] = prefixMatch;
    const level = normalizeLevel(lvl ?? 'unknown');
    const reqIdMatch = REQUEST_ID_RE.exec(msg ?? '');
    return {
      id,
      raw,
      timestamp: parseTimestamp(ts ?? ''),
      level,
      message: (msg ?? '').trim(),
      requestId: reqIdMatch?.[1],
      lineNumber,
    };
  }

  // Simple LEVEL: message
  const simpleMatch = SIMPLE_LEVEL_RE.exec(raw);
  if (simpleMatch) {
    const [, lvl, msg] = simpleMatch;
    return {
      id,
      raw,
      level: normalizeLevel(lvl ?? 'unknown'),
      message: (msg ?? '').trim(),
      lineNumber,
    };
  }

  // Stack trace continuation — attach to pending
  if (STACK_FRAME_RE.test(raw) && pendingStack.length > 0) {
    // Signal caller that this is a continuation
    return undefined;
  }

  // Fallback: raw line as unknown-level message
  return {
    id,
    raw,
    level: 'unknown',
    message: raw.trim(),
    lineNumber,
  };
}

// ── Main parser ──────────────────────────────────────────────

export interface ParseResult {
  events: LogEvent[];
  totalLines: number;
  errorCount: number;
  warnings: string[];
}

export async function parseLogFile(filePath: string): Promise<ParseResult> {
  const events: LogEvent[] = [];
  const warnings: string[] = [];
  let lineNumber = 0;

  // Buffer for accumulating multi-line stack traces
  let currentEvent: LogEvent | null = null;
  let stackBuffer: string[] = [];

  function flushStack(): void {
    if (currentEvent && stackBuffer.length > 0) {
      const fullStack = stackBuffer.join('\n');
      const frames = parseStackTrace(fullStack);
      if (frames.length > 0) {
        currentEvent.stackTrace = frames;
        const header = extractErrorHeader(stackBuffer[0] ?? '');
        if (header && !currentEvent.errorType) {
          currentEvent.errorType = header.errorType;
          currentEvent.errorMessage = header.errorMessage;
        }
      }
      stackBuffer = [];
    }
  }

  function commitEvent(): void {
    flushStack();
    if (currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    }
  }

  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    lineNumber++;

    // Skip empty lines (but flush pending stacks)
    if (!line.trim()) {
      if (stackBuffer.length > 0) {
        flushStack();
      }
      continue;
    }

    // Stack frame continuation
    if (STACK_FRAME_RE.test(line)) {
      if (stackBuffer.length === 0 && currentEvent) {
        // Start accumulating
        stackBuffer.push(line);
      } else {
        stackBuffer.push(line);
      }
      continue;
    }

    // Error message that precedes a stack trace (e.g. "TypeError: ...", "Error: ...")
    const isErrorHeader =
      /^[A-Za-z][A-Za-z0-9]*(?:Error|Exception|Fault)?:\s/.test(line.trim());

    if (isErrorHeader && stackBuffer.length === 0) {
      const header = extractErrorHeader(line);
      if (currentEvent && (currentEvent.level === 'error' || currentEvent.level === 'fatal')) {
        // Preceding line was an error log line (e.g. "ERROR Unhandled checkout error")
        // Attach this error header and start collecting stack frames for currentEvent
        if (header) {
          currentEvent.errorType = header.errorType;
          currentEvent.errorMessage = header.errorMessage;
        }
        stackBuffer.push(line);
        continue;
      } else {
        // Standalone error header without preceding log line
        commitEvent();
        currentEvent = {
          id: randomUUID(),
          raw: line,
          level: 'error',
          message: line.trim(),
          errorType: header?.errorType ?? 'Error',
          errorMessage: header?.errorMessage ?? line.trim(),
          lineNumber,
        };
        stackBuffer.push(line);
        continue;
      }
    }

    // Start of a new log line — flush accumulated stack
    if (stackBuffer.length > 0) {
      flushStack();
    }

    // Commit any previous event before starting a new one
    if (currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    }

    // Try JSON
    if (JSON_LINE_RE.test(line)) {
      const event = parseJsonLine(line, lineNumber);
      if (event) {
        currentEvent = event;
        continue;
      }
    }

    // Try plain text
    const event = parsePlainLine(line, lineNumber, stackBuffer);
    if (event) {
      currentEvent = event;
    } else {
      warnings.push(`Line ${lineNumber}: unrecognized format`);
    }
  }

  // Flush any remaining
  commitEvent();

  const errorCount = events.filter(
    (e) => e.level === 'error' || e.level === 'fatal',
  ).length;

  return {
    events,
    totalLines: lineNumber,
    errorCount,
    warnings,
  };
}

