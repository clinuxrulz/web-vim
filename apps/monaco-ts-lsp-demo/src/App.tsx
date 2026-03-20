import { initNetVim, prelude } from '@net-vim/core';
import type { FileSystem } from '@net-vim/core';
import { onMount, createSignal, createEffect, on, Show, For, createMemo } from 'solid-js';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import * as monaco from 'monaco-editor';

(window as any).monaco = monaco;

self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new editorWorker();
  }
};

const monacoTsLspPluginSource = prelude.PRELUDE_PLUGINS["monaco-ts-lsp.tsx"];

const SAMPLE_TYPESCRIPT = `// TypeScript example - edit in Monaco or net-vim!
// Changes sync in real-time between both editors.

interface Person {
  name: string;
  age: number;
  email?: string;
}

class Greeter {
  private greeting: string;
  
  constructor(message: string) {
    this.greeting = message;
  }
  
  public greet(person: Person): string {
    return \`\${this.greeting}, \${person.name}!\`;
  }
}

const people: Person[] = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25, email: "bob@example.com" },
  { name: "Charlie", age: 35 }
];

const greeter = new Greeter("Hello");

people.forEach(person => {
  const message = greeter.greet(person);
  console.log(message);
  
  // Try adding errors to see diagnostics!
  // const x: number = "string"; // This will show an error
});
`;

const createDemoFileSystem = (): FileSystem => {
  const files = new Map<string, string>([
    ['/sample.ts', SAMPLE_TYPESCRIPT],
  ]);

  return {
    readFile: async (path: string) => files.get(path) ?? null,
    writeFile: async (path: string, content: string) => { files.set(path, content); },
    listDirectory: async (path: string) => {
      const entries = new Set<string>();
      const normalizedPath = path.endsWith('/') ? path : path + '/';
      for (const key of files.keys()) {
        if (key.startsWith(normalizedPath)) {
          const relative = key.slice(normalizedPath.length);
          const parts = relative.split('/');
          entries.add(parts[0]);
        }
      }
      return Array.from(entries);
    },
    isDirectory: async (path: string) => {
      if (path === '' || path === '/') return true;
      const normalizedPath = path.endsWith('/') ? path : path + '/';
      for (const key of files.keys()) {
        if (key.startsWith(normalizedPath)) return true;
      }
      return false;
    }
  };
};

export default function App() {
  const [engine, setEngine] = createSignal<any>(null);
  const [monacoContainer, setMonacoContainer] = createSignal<HTMLDivElement | null>(null);
  const [monacoEditor, setMonacoEditor] = createSignal<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [activeTab, setActiveTab] = createSignal<'split' | 'vim' | 'monaco'>('split');
  const [isPluginActive, setIsPluginActive] = createSignal(false);
  const [logs, setLogs] = createSignal<string[]>([]);
  const [vimContainer, setVimContainer] = createSignal<HTMLDivElement | null>(null);

  let vimEngineRef: any = null;
  let syncingFromVim = false;
  let syncingFromMonaco = false;
  let currentFilePath = '/sample.ts';

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const syncVimToMonaco = () => {
    const monaco = monacoEditor();
    if (!monaco || syncingFromMonaco) return;
    
    const vim = vimEngineRef;
    if (!vim) return;

    syncingFromVim = true;
    try {
      const buffer = vim.getState().buffer;
      const content = buffer.join('\n');
      const monacoModel = monaco.getModel();
      if (monacoModel && monacoModel.getValue() !== content) {
        monaco.executeEdits('vim-sync', [{
          range: monacoModel.getFullModelRange(),
          text: content
        }]);
      }
    } finally {
      syncingFromVim = false;
    }
  };

  const syncMonacoToVim = () => {
    const monaco = monacoEditor();
    if (!monaco || syncingFromVim) return;
    
    const vim = vimEngineRef;
    if (!vim) return;

    syncingFromMonaco = true;
    try {
      const monacoModel = monaco.getModel();
      if (!monacoModel) return;
      
      const content = monacoModel.getValue();
      const newBuffer = content.split('\n');
      const currentBuffer = vim.getState().buffer;
      
      if (JSON.stringify(newBuffer) !== JSON.stringify(currentBuffer)) {
        vim.getAPI().setBuffer(newBuffer);
      }
    } finally {
      syncingFromMonaco = false;
    }
  };

  onMount(async () => {
    const container = monacoContainer();
    if (!container) return;

    const model = monaco.editor.createModel(SAMPLE_TYPESCRIPT, 'typescript', monaco.Uri.parse('file:///sample.ts'));
    const editor = monaco.editor.create(container, {
      model,
      theme: 'vs-dark',
      automaticLayout: true,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderLineHighlight: 'line',
      tabSize: 2,
      insertSpaces: true,
    });

    setMonacoEditor(editor);

    editor.onDidChangeModelContent(() => {
      syncMonacoToVim();
    });

    addLog('Monaco editor initialized with TypeScript support');

    const vimContainerEl = vimContainer();
    if (vimContainerEl) {
      const { vim } = await initNetVim(vimContainerEl, {
        fileSystem: createDemoFileSystem()
      });
      
      vimEngineRef = vim;
      setEngine(vim);
      vim.getAPI().requestFocus();
      
      vim.getAPI().executeCommand('e /sample.ts');
      
      vim.getAPI().on('TextChanged', () => {
        syncVimToMonaco();
      });
      
      vim.getAPI().on('BufferLoaded', (data: any) => {
        if (data.path !== currentFilePath) {
          currentFilePath = data.path;
          const monaco = (window as any).monaco;
          const editor = monacoEditor();
          if (monaco && editor) {
            const absolutePath = data.path.startsWith('/') ? data.path : '/' + data.path;
            const normalizedPath = absolutePath.startsWith('/') ? absolutePath.slice(1) : absolutePath;
            const uri = monaco.Uri.parse(`file:///${normalizedPath}`);
            
            let model = monaco.editor.getModel(uri);
            if (!model) {
              const content = typeof data.content === 'string' ? data.content : vim.getState().buffer.join('\n');
              model = monaco.editor.createModel(content, 'typescript', uri);
            }
            editor.setModel(model);
          }
        }
      });

      addLog('net-vim mounted, plugins available');
    }
  });

  const activatePlugin = async () => {
    const vim = vimEngineRef;
    if (!vim || !monacoTsLspPluginSource) return;
    
    try {
      await vim.getAPI().loadPluginFromSource("monaco-ts-lsp", monacoTsLspPluginSource);
      vim.getAPI().executeCommand('MonacoTSStart');
      
      const currentPath = vim.getState().currentFilePath;
      if (currentPath) {
        vim.getAPI().executeCommand(`e ${currentPath}`);
      }
      
      setIsPluginActive(true);
      addLog('Monaco TS-LSP plugin activated!');
    } catch (err: any) {
      addLog(`Error: ${err.message}`);
    }
  };

  const deactivatePlugin = () => {
    const vim = vimEngineRef;
    if (!vim) return;
    
    vim.getAPI().executeCommand('MonacoTSStop');
    setIsPluginActive(false);
    addLog('Monaco TS-LSP plugin deactivated');
  };

  const toggleSplit = () => setActiveTab('split');
  const vimOnly = () => setActiveTab('vim');
  const monacoOnly = () => setActiveTab('monaco');

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      'flex-direction': 'column',
      background: '#1e1e1e',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        'align-items': 'center',
        background: '#323233',
        padding: '8px 16px',
        gap: '12px',
        'border-bottom': '1px solid #454545'
      }}>
        <span style={{ color: '#cccccc', 'font-size': '14px', 'font-family': 'sans-serif' }}>
          net-vim + Monaco TS-LSP Demo
        </span>
        
        <div style={{ display: 'flex', gap: '4px', 'margin-left': 'auto' }}>
          <button 
            onClick={toggleSplit}
            style={{
              padding: '6px 12px',
              background: activeTab() === 'split' ? '#094771' : '#3c3c3c',
              border: 'none',
              color: '#cccccc',
              cursor: 'pointer',
              'font-size': '12px',
              'border-radius': '4px'
            }}
          >
            Split
          </button>
          <button 
            onClick={vimOnly}
            style={{
              padding: '6px 12px',
              background: activeTab() === 'vim' ? '#094771' : '#3c3c3c',
              border: 'none',
              color: '#cccccc',
              cursor: 'pointer',
              'font-size': '12px',
              'border-radius': '4px'
            }}
          >
            net-vim
          </button>
          <button 
            onClick={monacoOnly}
            style={{
              padding: '6px 12px',
              background: activeTab() === 'monaco' ? '#094771' : '#3c3c3c',
              border: 'none',
              color: '#cccccc',
              cursor: 'pointer',
              'font-size': '12px',
              'border-radius': '4px'
            }}
          >
            Monaco
          </button>
        </div>
        
        <Show when={!isPluginActive()}>
          <button 
            onClick={activatePlugin}
            style={{
              padding: '6px 12px',
              background: '#0e639c',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              'font-size': '12px',
              'border-radius': '4px',
              'font-weight': 'bold'
            }}
          >
            Activate TS-LSP
          </button>
        </Show>
        <Show when={isPluginActive()}>
          <button 
            onClick={deactivatePlugin}
            style={{
              padding: '6px 12px',
              background: '#4d4d4d',
              border: 'none',
              color: '#cccccc',
              cursor: 'pointer',
              'font-size': '12px',
              'border-radius': '4px'
            }}
          >
            Deactivate TS-LSP
          </button>
        </Show>
        
        <Show when={isPluginActive()}>
          <span style={{ color: '#4ec9b0', 'font-size': '12px', 'font-family': 'sans-serif' }}>
            TS-LSP Active
          </span>
        </Show>
      </div>
      
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        <Show when={activeTab() !== 'monaco'}>
          <div style={{
            width: activeTab() === 'split' ? '50%' : '100%',
            height: '100%',
            display: 'flex',
            'flex-direction': 'column',
            "border-right": activeTab() === 'split' ? '1px solid #454545' : 'none'
          }}>
            <div style={{
              background: '#252526',
              padding: '6px 12px',
              'border-bottom': '1px solid #454545',
              display: 'flex',
              'align-items': 'center',
              gap: '8px'
            }}>
              <span style={{ color: '#cccccc', 'font-size': '12px', 'font-family': 'sans-serif' }}>
                net-vim
              </span>
              <span style={{ color: '#808080', 'font-size': '11px', 'font-family': 'sans-serif' }}>
                {currentFilePath}
              </span>
            </div>
            <div 
              ref={setVimContainer}
              style={{
                flex: 1,
                overflow: 'hidden',
                position: 'relative'
              }}
            />
          </div>
        </Show>
        
        <Show when={activeTab() !== 'vim'}>
          <div style={{
            width: activeTab() === 'split' ? '50%' : '100%',
            height: '100%',
            display: 'flex',
            'flex-direction': 'column'
          }}>
            <div style={{
              background: '#252526',
              padding: '6px 12px',
              'border-bottom': '1px solid #454545',
              display: 'flex',
              'align-items': 'center',
              gap: '8px'
            }}>
              <span style={{ color: '#cccccc', 'font-size': '12px', 'font-family': 'sans-serif' }}>
                Monaco Editor
              </span>
              <span style={{ color: '#808080', 'font-size': '11px', 'font-family': 'sans-serif' }}>
                TypeScript
              </span>
            </div>
            <div 
              ref={setMonacoContainer}
              style={{
                flex: 1,
                overflow: 'hidden'
              }}
            />
          </div>
        </Show>
      </div>
      
      <div style={{
        background: '#1e1e1e',
        "border-top": "1px solid #454545",
        padding: '6px 12px',
        "max-height": '120px',
        overflow: 'auto'
      }}>
        <div style={{
          display: 'flex',
          'align-items': 'center',
          'margin-bottom': '4px'
        }}>
          <span style={{ color: '#cccccc', 'font-size': '11px', 'font-family': 'sans-serif', 'font-weight': 'bold' }}>
            Logs
          </span>
        </div>
        <For each={logs()}>
          {(log) => (
            <div style={{ 
              color: '#d4d4d4', 
              'font-size': '11px', 
              'font-family': 'Consolas, "Courier New", monospace',
              'line-height': '1.4'
            }}>
              {log}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
