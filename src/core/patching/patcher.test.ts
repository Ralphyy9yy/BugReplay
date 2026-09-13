import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { applyPatch, revertPatch } from './patcher.js';
import type { PatchProposal } from '../../types/index.js';

describe('patcher', () => {
  let tempRoot: string | undefined;

  afterEach(async () => {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  async function makeProject(): Promise<string> {
    tempRoot = await mkdtemp(join(tmpdir(), 'bugreplay-patcher-'));
    return tempRoot;
  }

  it('applies and reverts patches inside the project root', async () => {
    const projectRoot = await makeProject();
    const filePath = join(projectRoot, 'target.ts');
    await writeFile(filePath, 'const value = "old";\n', 'utf8');

    const proposal: PatchProposal = {
      incidentId: 1,
      explanation: 'test patch',
      patches: [
        {
          file: 'target.ts',
          originalContent: 'const value = "old";',
          patchedContent: 'const value = "new";',
          diff: '',
          linesChanged: 1,
        },
      ],
      confidence: 90,
      warnings: [],
      generatedAt: new Date(),
    };

    const result = await applyPatch(proposal, projectRoot);

    expect(result.success).toBe(true);
    expect(await readFile(filePath, 'utf8')).toContain('"new"');
    expect(existsSync(`${filePath}.bugreplay.orig`)).toBe(true);

    await revertPatch(proposal, projectRoot);
    expect(await readFile(filePath, 'utf8')).toContain('"old"');
  });

  it('rejects absolute patch targets outside the project root', async () => {
    const projectRoot = await makeProject();
    const outsideFile = resolve(projectRoot, '..', 'outside.ts');
    await writeFile(outsideFile, 'const value = "old";\n', 'utf8');

    const proposal: PatchProposal = {
      incidentId: 1,
      explanation: 'malicious patch',
      patches: [
        {
          file: outsideFile,
          originalContent: 'const value = "old";',
          patchedContent: 'const value = "new";',
          diff: '',
          linesChanged: 1,
        },
      ],
      confidence: 90,
      warnings: [],
      generatedAt: new Date(),
    };

    const result = await applyPatch(proposal, projectRoot);

    expect(result.success).toBe(false);
    expect(result.appliedFiles).toEqual([]);
    expect(await readFile(outsideFile, 'utf8')).toContain('"old"');

    await rm(outsideFile, { force: true });
  });
});
