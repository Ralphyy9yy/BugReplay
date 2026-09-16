import { describe, expect, it } from 'vitest';
import { matchFailureToIncident } from './failure-matcher.js';
import type { Incident, TestResult } from '../../types/index.js';

const incident: Incident = {
  id: 1,
  title: 'TypeError in checkout',
  errorType: 'TypeError',
  normalizedMessage: 'cannot read properties of undefined reading id',
  occurrences: 2,
  affectedFiles: ['src/checkout.ts'],
  primaryFrame: { file: 'src/checkout.ts', line: 42 },
  relatedEventIds: [],
  status: 'new',
  logFile: 'server.log',
  createdAt: new Date(),
};

function failed(output: string): TestResult {
  return { status: 'failed', passed: false, output, exitCode: 1, durationMs: 10 };
}

describe('matchFailureToIncident', () => {
  it('matches the original error type', () => {
    expect(matchFailureToIncident(incident, failed('TypeError: unrelated detail')).matched).toBe(true);
  });

  it('matches message terms', () => {
    expect(matchFailureToIncident(incident, failed('cannot read properties because value is undefined')).matched).toBe(true);
  });

  it('rejects unrelated assertion failures', () => {
    expect(matchFailureToIncident(incident, failed('AssertionError: expected 1 to be 2')).matched).toBe(false);
  });

  it('rejects runner errors and timeouts', () => {
    const result = failed('TypeError');
    result.status = 'error';
    expect(matchFailureToIncident(incident, result).matched).toBe(false);
  });
});
