import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import type { ReproductionPlan, Incident } from '../../types/index.js';

const BUGREPLAY_TEST_DIR = 'tests/bugreplay';

/**
 * Write the generated test to the project's tests/bugreplay/ directory.
 * Never modifies production source files.
 * Never overwrites existing files without explicit flag.
 */
export async function writeReproductionTest(
  plan: ReproductionPlan,
  incident: Incident,
  projectRoot: string,
  overwrite = false,
): Promise<string> {
  const testDir = resolve(projectRoot, BUGREPLAY_TEST_DIR);
  await mkdir(testDir, { recursive: true });

  const fileName = `incident-${String(incident.id).padStart(3, '0')}.test.ts`;
  const testPath = join(testDir, fileName);

  if (existsSync(testPath) && !overwrite) {
    throw new Error(
      `Test file already exists: ${testPath}\nPass overwrite=true to replace it.`,
    );
  }

  if (!plan.testCode || plan.testCode.trim().length === 0) {
    throw new Error('Reproduction plan has no test code to write.');
  }

  // Add header comment
  const header = `// ============================================================
// BugReplay Generated Regression Test
// Incident #${incident.id}: ${incident.title}
// Generated: ${new Date().toISOString()}
// DO NOT EDIT — regenerate with: bug-replay reproduce ${incident.id}
// ============================================================

`;

  const fullContent = header + plan.testCode;
  await writeFile(testPath, fullContent, 'utf8');

  return testPath;
}

/**
 * Determine the expected test file path for an incident.
 */
export function getTestFilePath(incidentId: number, projectRoot: string): string {
  return resolve(
    projectRoot,
    BUGREPLAY_TEST_DIR,
    `incident-${String(incidentId).padStart(3, '0')}.test.ts`,
  );
}

