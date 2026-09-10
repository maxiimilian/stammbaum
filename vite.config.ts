import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `--mode single` produces one self-contained dist/index.html with every asset
// (script, styles, photos) inlined, so it can be mailed around and opened offline.
export default defineConfig(({ mode }) => ({
  base: './',
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
