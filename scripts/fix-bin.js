#!/usr/bin/env node
/**
 * Ensures the built CLI file has the correct shebang line.
 * tsup handles this via banner config, but this script validates it.
 */
import { readFileSync, writeFileSync, statSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const binFile = resolve('dist', 'index.js');

try {
  const content = readFileSync(binFile, 'utf8');
  if (!content.startsWith('#!/usr/bin/env node')) {
    const patched = '#!/usr/bin/env node\n' + content;
    writeFileSync(binFile, patched, 'utf8');
    console.log('Added shebang to dist/index.js');
  } else {
    console.log('dist/index.js already has shebang');
  }
} catch (err) {
  console.warn('Could not patch bin file:', err.message);
}

