import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { GitInfo, GitCommitInfo, GitBlameInfo } from '../types/index.js';

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT = 10_000; // 10 seconds

// ── Safe git execution ───────────────────────────────────────

async function git(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string } | null> {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      timeout: GIT_TIMEOUT,
      maxBuffer: 1024 * 1024, // 1MB
    });
    return result;
  } catch {
    return null;
  }
}

// ── Git repo detection ───────────────────────────────────────

export async function isGitRepo(dir: string): Promise<boolean> {
  const result = await git(['rev-parse', '--git-dir'], dir);
  return result !== null;
}

// ── Commit parsing ───────────────────────────────────────────

function parseCommit(line: string): GitCommitInfo | undefined {
  // Format: hash|author|email|date|message
  const parts = line.split('|');
  if (parts.length < 5) return undefined;

  const [hash, author, email, dateStr, ...msgParts] = parts;
  if (!hash || !author || !email || !dateStr) return undefined;

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return undefined;

  const daysAgo = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    hash,
    shortHash: hash.slice(0, 7),
    author,
    email,
    date,
    message: msgParts.join('|').trim(),
    daysAgo,
  };
}

// ── Blame ────────────────────────────────────────────────────

export async function getBlame(
  file: string,
  line: number,
  cwd: string,
): Promise<GitBlameInfo | undefined> {
  const result = await git(
    ['blame', '-L', `${line},${line}`, '--porcelain', file],
    cwd,
  );

  if (!result?.stdout) return undefined;

  try {
    const lines = result.stdout.split('\n');
    const hash = lines[0]?.split(' ')[0];
    if (!hash || hash.length < 7) return undefined;

    const authorLine = lines.find((l) => l.startsWith('author '));
    const emailLine = lines.find((l) => l.startsWith('author-mail '));
    const timeLine = lines.find((l) => l.startsWith('author-time '));
    const summaryLine = lines.find((l) => l.startsWith('summary '));

    const author = authorLine?.replace('author ', '').trim() ?? 'Unknown';
    const email = emailLine?.replace('author-mail ', '').replace(/[<>]/g, '').trim() ?? '';
    const timestamp = timeLine ? new Date(parseInt(timeLine.replace('author-time ', '').trim(), 10) * 1000) : new Date();
    const message = summaryLine?.replace('summary ', '').trim() ?? '';
    const daysAgo = Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60 * 60 * 24));

    const commit: GitCommitInfo = {
      hash,
      shortHash: hash.slice(0, 7),
      author,
      email,
      date: timestamp,
      message,
      daysAgo,
    };

    // Correlation heuristic: recent changes to this file score higher
    const correlationScore = Math.max(0, Math.min(100, 100 - daysAgo * 5));

    return { file, line, commit, correlationScore };
  } catch {
    return undefined;
  }
}

// ── Recent log for file ──────────────────────────────────────

export async function getRecentLog(
  file: string,
  cwd: string,
  n = 5,
): Promise<GitCommitInfo[]> {
  const result = await git(
    [
      'log',
      `-${n}`,
      '--format=%H|%an|%ae|%aI|%s',
      '--',
      file,
    ],
    cwd,
  );

  if (!result?.stdout) return [];

  return result.stdout
    .split('\n')
    .filter((l) => l.trim())
    .map(parseCommit)
    .filter((c): c is GitCommitInfo => c !== undefined);
}

// ── Diff for commit ──────────────────────────────────────────

export async function getDiff(
  commitHash: string,
  cwd: string,
): Promise<string> {
  const result = await git(['show', '--stat', '--patch', commitHash], cwd);
  return result?.stdout ?? '';
}

// ── Current status ───────────────────────────────────────────

export async function getStatus(cwd: string): Promise<string> {
  const result = await git(['status', '--short'], cwd);
  return result?.stdout ?? '';
}

// ── Collect all git info for an incident ────────────────────

export async function collectGitInfo(
  affectedFiles: string[],
  primaryFrame: { file: string; line: number } | undefined,
  projectRoot: string,
): Promise<GitInfo> {
  const isRepo = await isGitRepo(projectRoot);

  if (!isRepo) {
    return { isGitRepo: false };
  }

  const blame: GitBlameInfo[] = [];
  const recentCommitsMap = new Map<string, GitCommitInfo>();

  for (const file of affectedFiles.slice(0, 3)) {
    // Resolve file relative to project root
    const absFile = file.startsWith('/') || file.includes(':')
      ? file
      : resolve(projectRoot, file);

    if (!existsSync(absFile)) continue;

    const relFile = absFile.startsWith(projectRoot)
      ? absFile.slice(projectRoot.length).replace(/^[/\\]/, '')
      : file;

    // Blame the primary frame line
    if (primaryFrame && (file === primaryFrame.file || absFile === primaryFrame.file)) {
      const blameResult = await getBlame(relFile, primaryFrame.line, projectRoot);
      if (blameResult) blame.push(blameResult);
    }

    // Recent log for this file
    const commits = await getRecentLog(relFile, projectRoot, 5);
    for (const commit of commits) {
      recentCommitsMap.set(commit.hash, commit);
    }
  }

  const recentCommits = [...recentCommitsMap.values()].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );

  // Get diff of most recent commit
  let recentDiff: string | undefined;
  if (recentCommits[0]) {
    const diff = await getDiff(recentCommits[0].hash, projectRoot);
    // Truncate to 2000 chars for LLM context
    recentDiff = diff.slice(0, 2000);
  }

  return {
    blame,
    recentCommits: recentCommits.slice(0, 10),
    recentDiff,
    isGitRepo: true,
  };
}

