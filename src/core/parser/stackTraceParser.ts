import type { StackFrame } from '../../types/index.js';

/**
 * Parses Node.js-style stack traces into structured StackFrame objects.
 * Handles various formats:
 *   at functionName (file:line:col)
 *   at file:line:col
 *   at async functionName (file:line:col)
 */

const NODE_FRAME_RE =
  /^\s+at\s+(?:async\s+)?(?:(?:new\s+)?([^\s(]+)\s+\()?([^)]+):(\d+):(\d+)\)?$/;

const NATIVE_FRAME_RE = /^\s+at\s+(?:async\s+)?([^\s(]+)\s+\(native\)$/;

const EVAL_FRAME_RE = /^\s+at\s+(?:[^\s]+)\s+\(eval\s+at/;

const NODE_INTERNAL_PREFIXES = [
  'node:',
  'node_modules/',
  '/node_modules/',
  'internal/',
];

function isInternal(file: string): boolean {
  return NODE_INTERNAL_PREFIXES.some((p) => file.startsWith(p) || file.includes(p));
}

export function parseStackTrace(raw: string): StackFrame[] {
  const frames: StackFrame[] = [];
  const lines = raw.split('\n');

  for (const line of lines) {
    // Skip the error message line (e.g. "TypeError: ...")
    if (!line.trim().startsWith('at ')) continue;

    // Skip eval frames (too noisy for root-cause)
    if (EVAL_FRAME_RE.test(line)) continue;

    // Native frames
    const nativeMatch = NATIVE_FRAME_RE.exec(line);
    if (nativeMatch) {
      frames.push({
        functionName: nativeMatch[1],
        file: '<native>',
        line: 0,
        isNative: true,
        isInternal: true,
      });
      continue;
    }

    const match = NODE_FRAME_RE.exec(line);
    if (!match) continue;

    const [, funcName, filePart, lineStr, colStr] = match;
    const lineNum = parseInt(lineStr ?? '0', 10);
    const colNum = parseInt(colStr ?? '0', 10);

    // Strip file:// prefix if present
    const file = (filePart ?? '').replace(/^file:\/\//, '').trim();

    frames.push({
      functionName: funcName || undefined,
      file,
      line: lineNum,
      column: colNum,
      isNative: false,
      isInternal: isInternal(file),
    });
  }

  return frames;
}

/**
 * Finds the first non-internal frame — the most useful one for root-cause.
 */
export function getPrimaryFrame(frames: StackFrame[]): StackFrame | undefined {
  return frames.find((f) => !f.isInternal && !f.isNative && f.file !== '<native>');
}

/**
 * Extracts error type and message from the first line of a stack trace.
 * e.g. "TypeError: Cannot read properties of undefined (reading 'id')"
 */
export function extractErrorHeader(
  raw: string,
): { errorType: string; errorMessage: string } | undefined {
  const firstLine = raw.trim().split('\n')[0]?.trim();
  if (!firstLine) return undefined;

  const colonIdx = firstLine.indexOf(':');
  if (colonIdx === -1) return undefined;

  const errorType = firstLine.slice(0, colonIdx).trim();
  const errorMessage = firstLine.slice(colonIdx + 1).trim();

  // Sanity check: error types are PascalCase identifiers (no spaces)
  if (!/^[A-Za-z][A-Za-z0-9]*(?:Error|Exception|Fault)?$/.test(errorType)) {
    return undefined;
  }

  return { errorType, errorMessage };
}

