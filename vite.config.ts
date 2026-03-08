import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { DOMElements, SVGElements } = require("solid-js/web/dist/dev.cjs");

export default defineConfig({
  base: "./",
  plugins: [
    solidPlugin({
      solid: {
        moduleName: "solid-js/web",
        // @ts-ignore
        generate: "dynamic",
        renderers: [
          {
            name: "dom",
            moduleName: "solid-js/web",
            elements: [...DOMElements.values(), ...SVGElements.values()],
          },
          {
            name: "universal",
            moduleName: "universal",
            elements: ["tui-box", "tui-text"],
          },
        ],
      },
    }),
    wasm(),
    topLevelAwait()
  ],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
  resolve: {
    alias: {
      "universal": "/src/solid-universal-tui/index.ts"
    }
  }
});
