import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { DOMElements, SVGElements } = require("solid-js/web/dist/dev.cjs");

const universalPath = path.resolve(__dirname, '../../packages/net-vim/src/solid-universal-tui/index.ts');

export default defineConfig({
  base: "./",
  plugins: [
    // @ts-ignore - renderers option is valid at runtime
    solidPlugin({
      solid: {
        moduleName: "solid-js/web",
        // @ts-ignore
        generate: "universal",
        // @ts-ignore
        renderers: [
          {
            name: "dom",
            moduleName: "solid-js/web",
            elements: [...DOMElements.values(), ...SVGElements.values()],
          },
          {
            name: "universal",
            moduleName: "universal",
            elements: ["tui-box", "tui-text", "box", "text"],
          },
        ],
      },
    }),
    wasm(),
    topLevelAwait()
  ],
  server: {
    port: 3001,
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
        }
      }
    }
  },
  resolve: {
    alias: {
      "universal": universalPath
    }
  },
  optimizeDeps: {
    include: ['monaco-editor']
  }
});
