import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';

// Plugin to copy public assets (manifest.json, icons) to dist
function copyPublicAssets() {
  return {
    name: 'copy-public-assets',
    writeBundle() {
      const distDir = resolve(__dirname, 'dist');
      const publicDir = resolve(__dirname, 'public');

      // Copy manifest.json
      copyFileSync(
        resolve(publicDir, 'manifest.json'),
        resolve(distDir, 'manifest.json')
      );

      // Copy icons
      const iconsDir = resolve(publicDir, 'icons');
      const distIconsDir = resolve(distDir, 'icons');
      if (!existsSync(distIconsDir)) mkdirSync(distIconsDir, { recursive: true });
      if (existsSync(iconsDir)) {
        for (const file of readdirSync(iconsDir)) {
          copyFileSync(resolve(iconsDir, file), resolve(distIconsDir, file));
        }
      }

      // Copy content script CSS
      const contentCss = resolve(__dirname, 'src/content/styles.css');
      if (existsSync(contentCss)) {
        const distContentDir = resolve(distDir, 'content');
        if (!existsSync(distContentDir)) mkdirSync(distContentDir, { recursive: true });
        copyFileSync(contentCss, resolve(distContentDir, 'styles.css'));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyPublicAssets()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  // Use relative paths for Chrome Extension
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Disable modulepreload polyfill — it uses `document` and `window`
    // which don't exist in Chrome Extension Service Workers
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        injected: resolve(__dirname, 'src/content/injected.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background' || chunkInfo.name === 'content' || chunkInfo.name === 'injected') {
            if (chunkInfo.name === 'injected') {
              return 'content/injected.js';
            }
            return `${chunkInfo.name}/index.js`;
          }
          return `assets/[name]-[hash].js`;
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    target: 'esnext',
    minify: false,
  },
});
