import { readFile } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { glob } from 'node:fs/promises';

export interface SourceSnippet {
  file: string;
  startLine: number;
  endLine: number;
  highlightLine?: number;
  code: string;
  exists: boolean;
}

/**
 * Safely resolves a file path within projectRoot.
 * Handles:
 * - Direct paths
 * - Relative paths from projectRoot
 * - Container paths (/app/src/checkout.ts -> src/checkout.ts)
 * - Path traversal protection
 */
export function resolveProjectFile(file: string, projectRoot: string): string | undefined {
  const rootResolved = resolve(projectRoot);

  const cleanPath = file.replace(/\\/g, '/');

  const candidates: string[] = [
    // Direct
    resolve(file),
    // Relative to projectRoot
    resolve(projectRoot, cleanPath.replace(/^\/+/, '')),
    // Stripping common container prefixes (/app, /var/task, /usr/src/app, etc.)
    resolve(projectRoot, cleanPath.replace(/^\/?(?:app|var\/task|usr\/src\/app)\//i, '')),
    // Inside src/
    resolve(projectRoot, 'src', cleanPath.replace(/^\/?(?:app\/|src\/)?/i, '')),
  ];

  for (const candidate of candidates) {
    try {
      const rel = relative(rootResolved, candidate);
      if (!rel.startsWith('..') && !resolve(candidate).startsWith('..') && existsSync(candidate)) {
        if (statSync(candidate).isFile()) {
          return candidate;
        }
      }
    } catch {
      // ignore
    }
  }

  return undefined;
}

/**
 * Read a source snippet around a specific line.
 * Protects against path traversal by ensuring file is within projectRoot.
 */
export async function readSourceSnippet(
  file: string,
  line: number,
  projectRoot: string,
  contextLines = 30,
): Promise<SourceSnippet> {
  const notFound: SourceSnippet = {
    file,
    startLine: 0,
    endLine: 0,
    code: '',
    exists: false,
  };

  try {
    const resolved = resolveProjectFile(file, projectRoot);
    if (!resolved) {
      return notFound;
    }

    const stat = statSync(resolved);
    if (!stat.isFile()) return notFound;

    // Don't read huge files
    if (stat.size > 512 * 1024) {
      return { ...notFound, exists: true, code: '// [File too large to display]' };
    }

    const content = await readFile(resolved, 'utf8');
    const lines = content.split('\n');

    const startLine = Math.max(1, line - contextLines);
    const endLine = Math.min(lines.length, line + contextLines);

    const snippet = lines
      .slice(startLine - 1, endLine)
      .map((l, i) => {
        const lineNum = startLine + i;
        const prefix = lineNum === line ? '→ ' : '  ';
        return `${prefix}${String(lineNum).padStart(4)} │ ${l}`;
      })
      .join('\n');

    return {
      file: resolved,
      startLine,
      endLine,
      highlightLine: line,
      code: snippet,
      exists: true,
    };
  } catch {
    return notFound;
  }
}

/**
 * Find test files in the project that reference any of the given search terms.
 */
export async function findTestFiles(
  projectRoot: string,
  searchTerms: string[],
): Promise<string[]> {
  const testFiles: string[] = [];

  try {
    // Common test file patterns
    const patterns = [
      '**/*.test.ts',
      '**/*.test.js',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/tests/**/*.ts',
      '**/tests/**/*.js',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.js',
    ];

    const found = new Set<string>();

    for (const pattern of patterns) {
      try {
        const matches = glob(pattern, {
          cwd: projectRoot,
          exclude: (f) => f.includes('node_modules') || f.includes('.bugreplay'),
        });
        for await (const match of matches) {
          found.add(join(projectRoot, match));
        }
      } catch {
        // glob may not support all patterns on all platforms
      }
    }

    // Filter to files that mention any search term
    for (const filePath of found) {
      try {
        const content = await readFile(filePath, 'utf8');
        const mentions = searchTerms.some((term) =>
          content.toLowerCase().includes(term.toLowerCase()),
        );
        if (mentions) {
          testFiles.push(filePath);
        }
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // return empty on any error
  }

  return testFiles;
}

/**
 * Read package.json from projectRoot and return dependencies.
 */
export async function readPackageInfo(
  projectRoot: string,
): Promise<Record<string, string>> {
  try {
    const pkgPath = resolve(projectRoot, 'package.json');
    const content = await readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
  } catch {
    return {};
  }
}

/**
 * Find a file relative to project root — tries multiple common locations.
 */
export async function findFile(
  fileName: string,
  projectRoot: string,
): Promise<string | undefined> {
  const candidates = [
    resolve(projectRoot, fileName),
    resolve(projectRoot, 'src', fileName),
    resolve(projectRoot, 'lib', fileName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

