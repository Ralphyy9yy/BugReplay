import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { existsSync } from 'node:fs';
import type { PatchProposal, FilePatch } from '../../types/index.js';
import { resolveProjectFile } from '../../integrations/filesystem.js';

export interface PatchApplicationResult {
  success: boolean;
  appliedFiles: string[];
  backupFiles: string[];
  errors: string[];
}

/**
 * Apply a patch proposal to the filesystem after creating backups.
 * This function should only be called after explicit user confirmation.
 */
export async function applyPatch(
  proposal: PatchProposal,
  projectRoot: string,
): Promise<PatchApplicationResult> {
  const result: PatchApplicationResult = {
    success: false,
    appliedFiles: [],
    backupFiles: [],
    errors: [],
  };

  for (const patch of proposal.patches) {
    try {
      await applyFilePatch(patch, projectRoot, result);
    } catch (err) {
      result.errors.push(
        `Failed to patch ${patch.file}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  result.success = result.errors.length === 0 && result.appliedFiles.length > 0;
  return result;
}

async function applyFilePatch(
  patch: FilePatch,
  projectRoot: string,
  result: PatchApplicationResult,
): Promise<void> {
  const absFile = resolvePatchTarget(patch.file, projectRoot);

  if (!existsSync(absFile)) {
    throw new Error(`File not found: ${absFile}`);
  }

  const original = await readFile(absFile, 'utf8');

  // Verify that the original snippet actually exists in the file
  if (!original.includes(patch.originalContent)) {
    throw new Error(
      `Original snippet not found in ${patch.file}.\n` +
        `Expected to find:\n${patch.originalContent.slice(0, 200)}\n\n` +
        `This may mean the file was modified after analysis.`,
    );
  }

  // Create backup
  const backupPath = absFile + '.bugreplay.orig';
  await copyFile(absFile, backupPath);
  result.backupFiles.push(backupPath);

  // Apply patch (replace first occurrence of original snippet)
  const patched = original.replace(patch.originalContent, patch.patchedContent);
  await writeFile(absFile, patched, 'utf8');
  result.appliedFiles.push(absFile);
}

/**
 * Revert a previously applied patch by restoring backups.
 */
export async function revertPatch(
  proposal: PatchProposal,
  projectRoot: string,
): Promise<void> {
  for (const patch of proposal.patches) {
    const absFile = resolvePatchTarget(patch.file, projectRoot);
    const backupPath = absFile + '.bugreplay.orig';

    if (existsSync(backupPath)) {
      const backupContent = await readFile(backupPath, 'utf8');
      await writeFile(absFile, backupContent, 'utf8');
    }
  }
}

/**
 * Build a human-readable colored diff string for display.
 * This is a visual diff only — not a proper unified diff format.
 */
function resolvePatchTarget(file: string, projectRoot: string): string {
  const absFile = resolveProjectFile(file, projectRoot);

  if (!absFile) {
    throw new Error(`Patch target must be an existing file inside the project: ${file}`);
  }

  const rootResolved = resolve(projectRoot);
  const rel = relative(rootResolved, absFile);

  if (rel.startsWith('..') || rel === '' || resolve(absFile) === rootResolved) {
    throw new Error(`Patch target escapes the project root: ${file}`);
  }

  return absFile;
}

export function buildDisplayDiff(patch: FilePatch): string {
  const origLines = patch.originalContent.split('\n');
  const patchLines = patch.patchedContent.split('\n');
  const lines: string[] = [];

  for (const line of origLines) {
    lines.push(`- ${line}`);
  }
  for (const line of patchLines) {
    lines.push(`+ ${line}`);
  }

  return lines.join('\n');
}
