import { describe, it, expect } from 'vitest';
import { normalizeMessage, groupEvents } from './grouper.js';
import type { LogEvent } from '../../types/index.js';
import { randomUUID } from 'node:crypto';

function makeErrorEvent(overrides: Partial<LogEvent> = {}): LogEvent {
  return {
    id: randomUUID(),
    raw: 'error line',
    level: 'error',
    message: 'An error occurred',
    lineNumber: 1,
    ...overrides,
  };
}

describe('normalizeMessage', () => {
  it('strips numeric IDs', () => {
    const a = normalizeMessage('User 123 failed to authenticate');
    const b = normalizeMessage('User 984 failed to authenticate');
    expect(a).toBe(b);
  });

  it('strips UUIDs', () => {
    const a = normalizeMessage('Order 550e8400-e29b-41d4-a716-446655440000 not found');
    const b = normalizeMessage('Order 6ba7b810-9dad-11d1-80b4-00c04fd430c8 not found');
    expect(a).toBe(b);
  });

  it('strips IP addresses', () => {
    const a = normalizeMessage('Connection from 192.168.1.1 rejected');
    const b = normalizeMessage('Connection from 10.0.0.5 rejected');
    expect(a).toBe(b);
  });

  it('strips ISO timestamps', () => {
    const a = normalizeMessage('Request at 2024-01-15T10:30:00Z failed');
    const b = normalizeMessage('Request at 2024-06-20T15:45:00Z failed');
    expect(a).toBe(b);
  });

  it('normalizes to lowercase', () => {
    expect(normalizeMessage('FATAL ERROR')).toBe(normalizeMessage('fatal error'));
  });

  it('handles empty string', () => {
    expect(normalizeMessage('')).toBe('');
  });
});

describe('groupEvents', () => {
  it('groups identical error types into one incident', () => {
    const events: LogEvent[] = [
      makeErrorEvent({
        errorType: 'TypeError',
        errorMessage: "Cannot read properties of undefined (reading 'id')",
        stackTrace: [{ file: '/app/checkout.js', line: 184, isInternal: false, isNative: false }],
      }),
      makeErrorEvent({
        errorType: 'TypeError',
        errorMessage: "Cannot read properties of undefined (reading 'id')",
        stackTrace: [{ file: '/app/checkout.js', line: 184, isInternal: false, isNative: false }],
      }),
    ];

    const { incidents } = groupEvents(events, 'server.log');
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.occurrences).toBe(2);
  });

  it('separates different error types into different incidents', () => {
    const events: LogEvent[] = [
      makeErrorEvent({
        errorType: 'TypeError',
        errorMessage: 'Cannot read property id',
        stackTrace: [{ file: '/app/checkout.js', line: 184, isInternal: false, isNative: false }],
      }),
      makeErrorEvent({
        errorType: 'DatabaseError',
        errorMessage: 'Connection refused',
        stackTrace: [{ file: '/app/db.js', line: 42, isInternal: false, isNative: false }],
      }),
    ];

    const { incidents } = groupEvents(events, 'server.log');
    expect(incidents).toHaveLength(2);
  });

  it('groups errors with different user IDs as one incident', () => {
    const events: LogEvent[] = [
      makeErrorEvent({
        errorType: 'AuthError',
        errorMessage: 'User 123 failed to authenticate',
        stackTrace: [{ file: '/app/auth.js', line: 55, isInternal: false, isNative: false }],
      }),
      makeErrorEvent({
        errorType: 'AuthError',
        errorMessage: 'User 456 failed to authenticate',
        stackTrace: [{ file: '/app/auth.js', line: 55, isInternal: false, isNative: false }],
      }),
      makeErrorEvent({
        errorType: 'AuthError',
        errorMessage: 'User 789 failed to authenticate',
        stackTrace: [{ file: '/app/auth.js', line: 55, isInternal: false, isNative: false }],
      }),
    ];

    const { incidents } = groupEvents(events, 'server.log');
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.occurrences).toBe(3);
  });

  it('returns empty incidents for no error events', () => {
    const events: LogEvent[] = [
      makeErrorEvent({ level: 'info', errorType: undefined, stackTrace: undefined }),
      makeErrorEvent({ level: 'debug', errorType: undefined, stackTrace: undefined }),
    ];
    const { incidents } = groupEvents(events, 'server.log');
    expect(incidents).toHaveLength(0);
  });

  it('sorts incidents by occurrence count descending', () => {
    const makeN = (n: number, type: string, file: string) =>
      Array.from({ length: n }, () =>
        makeErrorEvent({
          errorType: type,
          errorMessage: `${type} occurred`,
          stackTrace: [{ file, line: 10, isInternal: false, isNative: false }],
        }),
      );

    const events = [
      ...makeN(3, 'TypeError', '/app/checkout.js'),
      ...makeN(8, 'DatabaseError', '/app/db.js'),
      ...makeN(1, 'AuthError', '/app/auth.js'),
    ];

    const { incidents } = groupEvents(events, 'server.log');
    expect(incidents[0]?.occurrences).toBe(8);
    expect(incidents[1]?.occurrences).toBe(3);
    expect(incidents[2]?.occurrences).toBe(1);
  });

  it('does not crash on malformed events', () => {
    const events: LogEvent[] = [
      makeErrorEvent({ errorType: undefined, stackTrace: undefined, errorMessage: 'crash' }),
    ];
    expect(() => groupEvents(events, 'server.log')).not.toThrow();
  });

  it('sets incident IDs starting from 1', () => {
    const events = [
      makeErrorEvent({ errorType: 'TypeError', errorMessage: 'err', stackTrace: [{ file: '/app/a.js', line: 1, isInternal: false, isNative: false }] }),
    ];
    const { incidents } = groupEvents(events, 'server.log');
    expect(incidents[0]?.id).toBe(1);
  });
});

