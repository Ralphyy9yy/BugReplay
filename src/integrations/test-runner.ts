import { executeAllowed } from '../security/command-policy.js';
import type { TestResult } from '../types/index.js';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Run a specific test file using vitest and return structured results.
 * Only executes commands from the security allowlist.
 */
export async function runTestFile(
  testFilePath: string,
  projectRoot: string,
): Promise<TestResult> {
  const start = Date.now();

  if (!existsSync(testFilePath)) {
    return {
      status: 'error',
      passed: false,
      output: '',
      exitCode: 1,
      durationMs: 0,
      testFile: testFilePath,
      errorOutput: `Test file not found: ${testFilePath}`,
      failureReason: 'Test file does not exist',
    };
  }

  // Use relative path if possible (cleaner output)
  const relPath = testFilePath.startsWith(projectRoot)
    ? testFilePath.slice(projectRoot.length).replace(/^[/\\]/, '').replace(/\\/g, '/')
    : testFilePath.replace(/\\/g, '/');

  const command = `npx vitest run ${relPath}`;

  try {
    const result = await executeAllowed(command, projectRoot);

    const passed = result.exitCode === 0;
    const combined = result.stdout + (result.stderr ? '\n' + result.stderr : '');

    // Parse failure reason from vitest output
    let failureReason: string | undefined;
    if (!passed) {
      const failMatch = /✗\s+(.+)|FAIL\s+(.+)|AssertionError:\s+(.+)|Error:\s+(.+)/
        .exec(combined);
      failureReason = failMatch?.[1] ?? failMatch?.[2] ?? failMatch?.[3] ?? failMatch?.[4];
    }

    return {
      status: result.timedOut
        ? 'timeout'
        : passed
        ? 'passed'
        : 'failed',
      passed,
      output: combined,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      testFile: testFilePath,
      errorOutput: result.stderr || undefined,
      failureReason,
    };
  } catch (err) {
    return {
      status: 'error',
      passed: false,
      output: '',
      exitCode: 1,
      durationMs: Date.now() - start,
      testFile: testFilePath,
      errorOutput: err instanceof Error ? err.message : String(err),
      failureReason: 'Failed to execute test runner',
    };
  }
}

/**
 * Run all tests in the project.
 */
export async function runAllTests(projectRoot: string): Promise<TestResult> {
  const start = Date.now();

  try {
    const result = await executeAllowed('npx vitest run', projectRoot);
    const combined = result.stdout + (result.stderr ? '\n' + result.stderr : '');
    const passed = result.exitCode === 0;

    return {
      status: result.timedOut ? 'timeout' : passed ? 'passed' : 'failed',
      passed,
      output: combined,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    };
  } catch (err) {
    return {
      status: 'error',
      passed: false,
      output: '',
      exitCode: 1,
      durationMs: Date.now() - start,
      errorOutput: err instanceof Error ? err.message : String(err),
      failureReason: 'Failed to run test suite',
    };
  }
}

