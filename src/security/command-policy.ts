import { spawn } from 'node:child_process';

/**
 * Command execution allowlist.
 * BugReplay may ONLY execute commands from this list automatically.
 * Any other command will be rejected.
 */

// ── Allowlist definition ─────────────────────────────────────

interface AllowedCommand {
  /** Display name */
  name: string;
  /** Regex that must match the full command string */
  pattern: RegExp;
  /** Maximum execution time in milliseconds */
  timeoutMs: number;
  description: string;
}

const ALLOWED_COMMANDS: AllowedCommand[] = [
  {
    name: 'npm-test',
    pattern: /^npm\s+test\s*$/,
    timeoutMs: 120_000,
    description: 'Run npm test',
  },
  {
    name: 'npm-run-test',
    pattern: /^npm\s+run\s+test\s*$/,
    timeoutMs: 120_000,
    description: 'Run npm run test',
  },
  {
    name: 'vitest-run-all',
    pattern: /^npx\s+vitest\s+run\s*$/,
    timeoutMs: 120_000,
    description: 'Run all vitest tests',
  },
  {
    name: 'vitest-run-file',
    pattern: /^npx\s+vitest\s+run\s+["']?[A-Za-z0-9_./\\: -]+["']?\s*$/,
    timeoutMs: 60_000,
    description: 'Run a specific vitest test file',
  },
  {
    name: 'vitest-run-pattern',
    pattern: /^npx\s+vitest\s+run\s+--reporter\s+\S+\s+["']?[A-Za-z0-9_./\\: -]+["']?\s*$/,
    timeoutMs: 60_000,
    description: 'Run vitest with reporter option',
  },
  {
    name: 'npm-install-no-save',
    pattern: /^npm\s+install\s*$/,
    timeoutMs: 300_000,
    description: 'npm install (no modifications to package.json)',
  },
];

// ── Explicitly blocked dangerous commands ────────────────────

const BLOCKED_PATTERNS: RegExp[] = [
  /\brm\b/i,
  /\brmdir\b/i,
  /\bdel\b/i,
  /\bformat\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bgit\s+push/i,
  /\bgit\s+reset\s+--hard/i,
  /\bgit\s+clean/i,
  /\bcurl\b.*\|\s*sh/i,
  /\bwget\b.*\|\s*sh/i,
  /\beval\b/i,
  /\bsudo\b/i,
  /\bpowerShell\b/i,
  /\bcmd\.exe\b/i,
  />\s*\/dev\/sd/i,
  /\bdd\b.*of=/i,
];

// ── Public API ───────────────────────────────────────────────

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  timedOut: boolean;
}

export function isCommandAllowed(command: string): boolean {
  const trimmed = command.trim();

  // Check explicit blocklist first
  if (BLOCKED_PATTERNS.some((p) => p.test(trimmed))) {
    return false;
  }

  // Check allowlist
  return ALLOWED_COMMANDS.some((allowed) => allowed.pattern.test(trimmed));
}

export function getAllowedCommandInfo(command: string): AllowedCommand | undefined {
  const trimmed = command.trim();
  return ALLOWED_COMMANDS.find((a) => a.pattern.test(trimmed));
}

export function getAllowedCommands(): string[] {
  return ALLOWED_COMMANDS.map((c) => c.description);
}

export async function executeAllowed(
  command: string,
  cwd: string,
): Promise<CommandResult> {
  if (!isCommandAllowed(command)) {
    throw new Error(
      `Command not allowed: "${command}"\n` +
        `Allowed commands:\n${getAllowedCommands()
          .map((c) => `  - ${c}`)
          .join('\n')}`,
    );
  }

  const cmdInfo = getAllowedCommandInfo(command)!;
  const start = Date.now();

  return new Promise((resolve, reject) => {
    // Use shell: false equivalent by splitting manually
    const [cmd, ...args] = command.trim().split(/\s+/);
    if (!cmd) {
      reject(new Error('Empty command'));
      return;
    }

    const child = spawn(cmd, args, {
      cwd,
      shell: true, // needed for npx/npm on Windows
      env: {
        ...process.env,
        // Prevent interactive prompts
        CI: 'true',
        FORCE_COLOR: '0',
      },
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, cmdInfo.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        durationMs: Date.now() - start,
        timedOut,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

