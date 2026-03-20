# Monaco TS-LSP Demo

This example demonstrates using the `monaco-ts-lsp` prelude plugin with net-vim.

## Features

- **Split View**: net-vim editor on one side, Monaco editor on the other
- **Real-time Sync**: Changes in either editor sync to the other
- **Tab Switching**: Toggle between split view, net-vim only, or Monaco only
- **Monaco TS-LSP Plugin**: Activates TypeScript language server features in net-vim using Monaco's built-in TypeScript worker

## Running the Demo

```bash
pnpm dev:monaco-ts-lsp
```

Then open `http://localhost:3001` (or the port shown in the terminal).

## Using the TS-LSP Plugin

1. Click the **Activate TS-LSP** button to enable TypeScript language features in net-vim
2. The plugin provides:
   - **Error diagnostics** (shown in the gutter as "E")
   - **Hover information** (via `:MonacoTSHover` command)
   - **Go-to-definition** (via `:MonacoTSDefinition` command)
   - **Syntax highlighting** using Monaco's semantic classifications

3. Try adding TypeScript errors in the code to see diagnostics appear

## Key Bindings

In net-vim with the plugin active:
- `\d` - Show diagnostics for current line
- `[d` / `]d` - Previous/next diagnostic
- `gd` - Go to definition (via `:MonacoTSDefinition`)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Demo App                                 │
├─────────────────────────┬─────────────────────────────────┤
│      net-vim            │         Monaco Editor            │
│  ┌─────────────────┐   │   ┌─────────────────────────┐     │
│  │ monaco-ts-lsp   │   │   │ Monaco TS Worker       │     │
│  │ plugin          │   │   │ (TypeScript support)   │     │
│  └────────┬────────┘   │   └───────────┬─────────────┘     │
│           │              │               │                    │
│           └──────────────┴───────────────┘                    │
│                    window.monaco                              │
└─────────────────────────────────────────────────────────────┘
```

The plugin connects to Monaco's TypeScript worker to provide LSP-like features for net-vim, leveraging the same TypeScript language services that power Monaco's editor.
