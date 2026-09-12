import { describe, it, expect } from 'vitest';
import { parseStackTrace, extractErrorHeader, getPrimaryFrame } from './stackTraceParser.js';

describe('parseStackTrace', () => {
  it('parses a standard Node.js stack trace', () => {
    const raw = `TypeError: Cannot read properties of undefined (reading 'id')
    at processPayment (/app/src/checkout.js:184:25)
    at async handleOrder (/app/src/order.js:42:5)
    at node:internal/process/task_queues:140:7`;

    const frames = parseStackTrace(raw);
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[0]?.functionName).toBe('processPayment');
    expect(frames[0]?.file).toBe('/app/src/checkout.js');
    expect(frames[0]?.line).toBe(184);
    expect(frames[0]?.column).toBe(25);
    expect(frames[0]?.isInternal).toBe(false);
  });

  it('marks node: internal frames as internal', () => {
    const raw = `Error: test
    at node:internal/process/task_queues:140:7`;
    const frames = parseStackTrace(raw);
    expect(frames[0]?.isInternal).toBe(true);
  });

  it('marks node_modules frames as internal', () => {
    const raw = `Error: test
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)`;
    const frames = parseStackTrace(raw);
    expect(frames[0]?.isInternal).toBe(true);
  });

  it('handles async frames', () => {
    const raw = `Error: test
    at async processOrder (/app/src/order.js:10:5)`;
    const frames = parseStackTrace(raw);
    expect(frames[0]?.functionName).toBe('processOrder');
    expect(frames[0]?.file).toBe('/app/src/order.js');
  });

  it('returns empty array for non-stack strings', () => {
    expect(parseStackTrace('hello world')).toHaveLength(0);
    expect(parseStackTrace('')).toHaveLength(0);
  });

  it('handles anonymous functions', () => {
    const raw = `Error: test
    at /app/src/index.js:5:3`;
    const frames = parseStackTrace(raw);
    expect(frames[0]?.file).toBe('/app/src/index.js');
    expect(frames[0]?.functionName).toBeUndefined();
  });
});

describe('extractErrorHeader', () => {
  it('extracts TypeError', () => {
    const result = extractErrorHeader(
      "TypeError: Cannot read properties of undefined (reading 'id')\n    at foo.js:1:1",
    );
    expect(result?.errorType).toBe('TypeError');
    expect(result?.errorMessage).toContain("Cannot read properties");
  });

  it('extracts RangeError', () => {
    const result = extractErrorHeader('RangeError: Maximum call stack size exceeded');
    expect(result?.errorType).toBe('RangeError');
  });

  it('returns undefined for non-error strings', () => {
    expect(extractErrorHeader('hello world')).toBeUndefined();
    expect(extractErrorHeader('')).toBeUndefined();
  });

  it('returns undefined for lines with spaces in type', () => {
    expect(extractErrorHeader('Not An Error: some message')).toBeUndefined();
  });
});

describe('getPrimaryFrame', () => {
  it('returns first non-internal frame', () => {
    const frames = [
      { file: 'node:internal/foo', line: 1, isInternal: true, isNative: false },
      { file: '/app/src/checkout.js', line: 184, isInternal: false, isNative: false },
      { file: '/app/src/order.js', line: 42, isInternal: false, isNative: false },
    ];
    const primary = getPrimaryFrame(frames);
    expect(primary?.file).toBe('/app/src/checkout.js');
  });

  it('returns undefined when all frames are internal', () => {
    const frames = [
      { file: 'node:internal/foo', line: 1, isInternal: true, isNative: false },
    ];
    expect(getPrimaryFrame(frames)).toBeUndefined();
  });
});

