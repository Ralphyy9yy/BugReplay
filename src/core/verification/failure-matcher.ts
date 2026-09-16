import { basename } from 'node:path';
import type { Incident, TestResult } from '../../types/index.js';

export interface FailureMatch {
  matched: boolean;
  signals: string[];
}

/** Require the generated test failure to share concrete signals with the production incident. */
export function matchFailureToIncident(incident: Incident, result: TestResult): FailureMatch {
  if (result.passed || result.status === 'timeout' || result.status === 'error') {
    return { matched: false, signals: [] };
  }

  const output = `${result.failureReason ?? ''}\n${result.output}\n${result.errorOutput ?? ''}`.toLowerCase();
  const signals: string[] = [];
  const errorType = incident.errorType.trim().toLowerCase();
  if (errorType && errorType !== 'error' && errorType !== 'unknownerror' && output.includes(errorType)) {
    signals.push(`error type: ${incident.errorType}`);
  }

  const words = incident.normalizedMessage
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .match(/[a-z][a-z0-9_]{3,}/g) ?? [];
  const uniqueWords = [...new Set(words)];
  const matchingWords = uniqueWords.filter((word) => output.includes(word));
  if (matchingWords.length >= 2 && matchingWords.length / Math.max(uniqueWords.length, 1) >= 0.4) {
    signals.push(`message terms: ${matchingWords.slice(0, 4).join(', ')}`);
  }

  const sourceFile = incident.primaryFrame?.file ? basename(incident.primaryFrame.file).toLowerCase() : '';
  if (sourceFile && output.includes(sourceFile)) signals.push(`source file: ${sourceFile}`);

  return { matched: signals.length > 0, signals };
}
