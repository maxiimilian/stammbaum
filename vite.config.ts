import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, searchForWorkspaceRoot } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The real family lives in data/, a private repository of its own that this
// public one ignores. Without it — a fresh clone, CI — the app shows the
// made-up sample family. FAMILY_DIR points anywhere else: `FAMILY_DIR=sample`.
const root = fileURLToPath(new URL('.', import.meta.url));
const familyDir = process.env.FAMILY_DIR
  ? path.resolve(process.env.FAMILY_DIR)
  : path.join(root, existsSync(path.join(root, 'data/family.md')) ? 'data' : 'sample');

// `--mode single` produces one self-contained dist/index.html with every asset
// (script, styles, photos) inlined, so it can be mailed around and opened offline.
export default defineConfig(({ mode }) => ({
  base: './',
  resolve: {
    alias: { '@family': familyDir },
  },
  server: {
    // A FAMILY_DIR outside the project still has to be served in dev.
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), familyDir] },
  },
  build: {
    // Inline every photo as a data: URI in single-file mode.
    assetsInlineLimit: mode === 'single' ? 100 * 1024 * 1024 : 4096,
    target: 'es2022',
  },
  plugins: mode === 'single' ? [tailwindcss(), viteSingleFile()] : [tailwindcss()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
