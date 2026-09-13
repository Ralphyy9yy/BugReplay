import { afterEach, describe, expect, it, vi } from 'vitest';
import { printBanner, printNextStep, visibleLength } from './banner.js';

describe('terminal UI', () => {
  afterEach(() => vi.restoreAllMocks());

  it('measures styled text by its visible width', () => {
    expect(visibleLength('\u001B[36mBugReplay\u001B[39m')).toBe(9);
  });

  it('prints a clean, balanced banner', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    printBanner();

    const output = log.mock.calls.map(([line]) => String(line)).join('\n');
    expect(output).toContain('BUGREPLAY');
    expect(output).toContain('verified regression tests');
    expect(output).not.toContain('â');
  });

  it('makes the next action explicit', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    printNextStep('bug-replay analyze 1', 'Inspect the incident.');

    const output = log.mock.calls.map(([line]) => String(line)).join('\n');
    expect(output).toContain('NEXT');
    expect(output).toContain('bug-replay analyze 1');
    expect(output).toContain('Inspect the incident.');
  });
});
