import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
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

// The short commit of the family repository, `-dirty` with uncommitted edits.
// Only a family folder that is a repository of its own has one — the sample
// would otherwise report this repository's commit.
function familyCommit(dir: string): string {
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  try {
    if (realpathSync(git('rev-parse', '--show-toplevel')) !== realpathSync(dir)) return '';
    const commit = git('rev-parse', '--short', 'HEAD');
    return git('status', '--porcelain') ? `${commit}-dirty` : commit;
  } catch {
    // No git, or a repository without a first commit yet.
    return '';
  }
}

// `--mode single` produces one self-contained dist/index.html with every asset
// (script, styles, photos) inlined, so it can be mailed around and opened offline.
export default defineConfig(({ mode }) => ({
  base: './',
  // Printed under the tree, so a build that has gone stale is easy to spot.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __FAMILY_COMMIT__: JSON.stringify(familyCommit(familyDir)),
  },
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
