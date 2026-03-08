export const PRELUDE_PLUGINS: Record<string, string> = {
  'line-numbers.tsx': `
export default {
  metadata: {
    name: "line-numbers",
    author: "Web-Vim Team",
    version: "1.0.0",
    description: "Provides line numbers in the gutter"
  },
  setup: (api: any) => {
    api.log("Setting up line-numbers plugin...");
    api.registerGutter({
      name: "line-numbers",
      width: 4,
      priority: 100,
      render: ({ lineIndex, isCursorLine }: any) => {
        const getVal = (val: any) => (typeof val === "function" ? val() : val);
        const num = () => (getVal(lineIndex) + 1).toString().padStart(3, " ");
        return (
          <text 
            content={() => num() + " "} 
            color={() => getVal(isCursorLine) ? "#ffffff" : "#888888"} 
          />
        );
      }
    });
    api.log("Line-numbers gutter registered");
  }
};
`,
  'hello.tsx': `
export default {
  metadata: {
    name: "hello-plugin",
    description: "A simple plugin that greets you and tracks mode changes."
  },
  setup: (api: any) => {
    api.log("Hello from the virtual prelude!");
    
    api.registerCommand("hello", (args: string[]) => {
      api.log("Command :hello executed with args:", args);
      console.log("HELLO FROM PRELUDE PLUGIN!", args);
    });

    api.on("ModeChanged", (data: any) => {
      api.log("Mode changed from " + data.from + " to " + data.to);
    });
  }
};
`,
  'ts-lsp-worker.ts': `
import * as Comlink from "https://esm.sh/comlink@4.4.1";

let ts = null;
let vfs = null;

async function ensureTs() {
  if (!ts) {
    try {
      console.log("TS-LSP Worker: Importing TypeScript...");
      ts = await import("https://esm.sh/typescript@5.7.2");
      console.log("TS-LSP Worker: TypeScript imported. Loading @typescript/vfs...");
      vfs = await import("https://esm.sh/@typescript/vfs@1.6.4?bundle");
      console.log("TS-LSP Worker: All dependencies loaded");
    } catch (e) {
      console.error("TS-LSP Worker: Import failed!", e);
      throw e;
    }
  }
  return { ts, vfs };
}

const fsMap = new Map();

const worker = {
  env: null,
  async ping() {
    return "pong";
  },
  async initialize() {
    console.log("TS-LSP Worker: Starting initialize...");
    try {
      const { ts: tsInstance, vfs: vfsInstance } = await ensureTs();
      console.log("TS-LSP Worker: TS and VFS loaded", !!tsInstance, !!vfsInstance);
      const system = vfsInstance.createSystem(fsMap);
      const compilerOptions = {
        target: tsInstance.ScriptTarget.ESNext,
        module: tsInstance.ModuleKind.ESNext,
        lib: ["esnext", "dom"],
        strict: true,
        allowNonTsExtensions: true,
      };
      this.env = vfsInstance.createVirtualTypeScriptEnvironment(system, [], tsInstance, compilerOptions);
      console.log("TS-LSP Worker: Environment created");
    } catch (e) {
      console.error("TS-LSP Worker: Initialize failed", e);
      throw e;
    }
  },

  updateFile(path, content) {
    if (!this.env) return;
    if (this.env.getSourceFile(path)) {
      this.env.updateFile(path, content);
    } else {
      this.env.createFile(path, content);
    }
  },

  getLints(path) {
    if (!this.env) return [];
    const syntatic = this.env.languageService.getSyntacticDiagnostics(path);
    const semantic = this.env.languageService.getSemanticDiagnostics(path);
    return [...syntatic, ...semantic].map(d => ({
      from: d.start,
      to: (d.start || 0) + (d.length || 0),
      message: typeof d.messageText === 'string' ? d.messageText : d.messageText.messageText,
      category: d.category
    }));
  },

  getCompletions(path, pos) {
    if (!this.env) return null;
    const info = this.env.languageService.getCompletionsAtPosition(path, pos, {});
    if (!info) return null;
    return info.entries.map(entry => ({
      label: entry.name,
      kind: entry.kind,
    }));
  },

  getHover(path, pos) {
    if (!this.env) return null;
    const info = this.env.languageService.getQuickInfoAtPosition(path, pos);
    if (!info) return null;
    // @ts-ignore
    const display = ts.displayPartsToString(info.displayParts);
    return {
      display,
      range: { start: info.textSpan.start, length: info.textSpan.length }
    };
  }
};

Comlink.expose(worker);
`,
  'ts-lsp.tsx': `
export default {
  metadata: {
    name: 'ts-lsp',
    description: 'TypeScript LSP for Web-Vim'
  },
  setup: async (api) => {
    try {
      api.log('TS-LSP: Loading Comlink...');
      const Comlink = await import("https://esm.sh/comlink@4.4.1");
      api.log('TS-LSP: Comlink loaded. Loading worker source...');
      
      const workerSource = await api.fs.readFile(".config/web-vim/prelude/ts-lsp-worker.ts");
      if (!workerSource) {
        api.log("TS-LSP Error: Could not find worker source");
        return;
      }
      
      const blob = new Blob([workerSource], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      api.log('TS-LSP: Spawning worker...');
      
      const workerInstance = new Worker(workerUrl, { type: 'module' });
      workerInstance.onerror = (e) => api.log('TS-LSP Worker Error: ' + (e.message || 'Check console'));
      
      const worker = Comlink.wrap(workerInstance);
      
      api.log('TS-LSP: Testing connection (ping)...');
      const pong = await worker.ping();
      api.log('TS-LSP: Connection ok: ' + pong);
      
      api.log('TS-LSP: Calling worker.initialize()...');
      await worker.initialize();
      api.log('TS-LSP: Worker initialized successfully');

      let lints = [];
      let currentPath = '';

      const updateLints = async () => {
        if (!currentPath) return;
        lints = await worker.getLints(currentPath);
      };

      api.on('BufferLoaded', async (data) => {
        currentPath = data.path;
        if (currentPath.endsWith('.ts') || currentPath.endsWith('.tsx')) {
          await worker.updateFile(currentPath, data.content);
          await updateLints();
        }
      });

      api.on('TextChanged', async () => {
        const buffer = api.getBuffer().join('\\n');
        if (currentPath && (currentPath.endsWith('.ts') || currentPath.endsWith('.tsx'))) {
          await worker.updateFile(currentPath, buffer);
          await updateLints();
          
          if (api.getMode() === 'Insert') {
            const cursor = api.getCursor();
            const bufferLines = api.getBuffer();
            let pos = 0;
            for (let i = 0; i < cursor.y; i++) {
              pos += bufferLines[i].length + 1;
            }
            pos += cursor.x;
            
            const completions = await worker.getCompletions(currentPath, pos);
            if (completions && completions.length > 0) {
              api.showCompletions(completions, (item) => {
                const currentBuffer = api.getBuffer();
                const line = currentBuffer[cursor.y];
                const newLine = line.slice(0, cursor.x) + item.label + line.slice(cursor.x);
                currentBuffer[cursor.y] = newLine;
                api.setBuffer(currentBuffer);
                api.setCursor(cursor.x + item.label.length, cursor.y);
              });
            } else {
              api.hideCompletions();
            }
          }
        }
      });

      api.registerGutter({
        name: 'ts-lint',
        width: 2,
        priority: 50,
        render: ({ lineIndex }) => {
          const idx = typeof lineIndex === 'function' ? lineIndex() : lineIndex;
          const hasError = lints.some(l => {
            const buffer = api.getBuffer();
            let lineStart = 0;
            for (let i = 0; i < idx; i++) lineStart += buffer[i].length + 1;
            const lineEnd = lineStart + buffer[idx].length;
            return l.from >= lineStart && l.from <= lineEnd && l.category === 1;
          });

          return (
            <text content={hasError ? ' E' : '  '} color="#ff0000" />
          );
        }
      });

      api.registerCommand('hover', async () => {
        if (!currentPath) return;
        const cursor = api.getCursor();
        const bufferLines = api.getBuffer();
        let pos = 0;
        for (let i = 0; i < cursor.y; i++) {
          pos += bufferLines[i].length + 1;
        }
        pos += cursor.x;
        
        const hover = await worker.getHover(currentPath, pos);
        if (hover) {
          api.showHover(hover.display, cursor.x, cursor.y);
          setTimeout(() => api.hideHover(), 3000);
        }
      });

      api.registerLineRenderer({
        name: 'ts-highlighter',
        priority: 10,
        render: ({ lineIndex, lineContent }) => {
          const content = typeof lineContent === 'function' ? lineContent() : lineContent;
          if (!currentPath || !(currentPath.endsWith('.ts') || currentPath.endsWith('.tsx'))) {
            return <text content={content} />;
          }
          
          const keywords = ['import', 'export', 'default', 'const', 'let', 'var', 'function', 'class', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'await', 'async'];
          const parts = [];
          const words = content.split(/(\\W+)/);
          for (const word of words) {
            const isKeyword = keywords.includes(word);
            parts.push(<text content={word} color={isKeyword ? '#569cd6' : '#ffffff'} />);
          }
          
          return <box x={0} y={0} width={content.length} height={1}>{parts}</box>;
        }
      });
    } catch (err) {
      api.log('TS-LSP Setup Error: ' + err.message);
    }
  }
};
`
};
