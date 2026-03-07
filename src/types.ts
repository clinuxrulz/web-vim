export type VimMode = 'Normal' | 'Insert' | 'Command';

export type VimEvent = 'ModeChanged' | 'CursorMoved' | 'TextChanged' | 'BufferLoaded';

export interface GutterOptions {
  name: string;
  width: number;
  priority?: number;
  /**
   * A function that returns a TUI element for a given line.
   * Plugins can use the provided 'h' function to create elements.
   */
  render: (props: { 
    lineIndex: number | (() => number); 
    lineContent: string | (() => string); 
    isCursorLine: boolean | (() => boolean) 
  }) => any;
}

export interface VimAPI {
  registerCommand: (name: string, callback: (args: string[]) => void) => void;
  getBuffer: () => string[];
  setBuffer: (buffer: string[]) => void;
  getCursor: () => { x: number, y: number };
  setCursor: (x: number, y: number) => void;
  getMode: () => VimMode;
  on: (event: VimEvent, callback: (...args: any[]) => void) => void;
  executeCommand: (cmd: string) => void;
  loadPluginFromSource: (name: string, source: string) => Promise<boolean>;
  registerGutter: (options: GutterOptions) => void;
}
