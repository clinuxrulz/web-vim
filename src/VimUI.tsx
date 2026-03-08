import { For, Show, type Component, createEffect } from 'solid-js';
import type { VimMode, GutterOptions } from './types';
import { h } from './solid-universal-tui';

interface VimUIProps {
  buffer: string[] | (() => string[]);
  cursor: { x: number; y: number } | (() => { x: number; y: number });
  topLine?: number | (() => number);
  leftCol?: number | (() => number);
  mode: VimMode | (() => VimMode);
  commandText: string | (() => string);
  width: number | (() => number);
  height: number | (() => number);
  currentFilePath?: string | null | (() => string | null);
  isExplorer?: boolean | (() => boolean);
  explorerPath?: string | (() => string);
  isReadOnly?: boolean | (() => boolean);
  plugins?: Array<{ name: string }> | (() => Array<{ name: string }>);
  gutters?: GutterOptions[] | (() => GutterOptions[]);
  lineRenderers?: LineRendererOptions[] | (() => LineRendererOptions[]);
  completionItems?: any[] | (() => any[]);
  selectedCompletionIndex?: number | (() => number);
  hoverText?: string | null | (() => string | null);
  hoverPos?: { x: number; y: number } | (() => { x: number; y: number });
  onCursorChange?: (cursor: { x: number; y: number }) => void;
}

export const VimUI: Component<VimUIProps> = (props) => {
  const getProp = <T,>(val: T | (() => T)): T => (typeof val === 'function' ? (val as Function)() : val);

  const buffer = () => getProp(props.buffer) || [];
  const cursor = () => getProp(props.cursor) || { x: 0, y: 0 };
  const topLine = () => getProp(props.topLine) || 0;
  const leftCol = () => getProp(props.leftCol) || 0;
  const mode = () => getProp(props.mode) || 'Normal';
  const commandText = () => getProp(props.commandText) || '';
  const width = () => getProp(props.width) || 80;
  const height = () => getProp(props.height) || 24;
  const currentFilePath = () => getProp(props.currentFilePath);
  const isExplorer = () => getProp(props.isExplorer);
  const explorerPath = () => getProp(props.explorerPath);
  const isReadOnly = () => getProp(props.isReadOnly);
  const gutters = () => getProp(props.gutters) || [];
  const lineRenderers = () => getProp(props.lineRenderers) || [];
  const completionItems = () => getProp(props.completionItems) || [];
  const selectedCompletionIndex = () => getProp(props.selectedCompletionIndex) || 0;
  const hoverText = () => getProp(props.hoverText);
  const hoverPos = () => getProp(props.hoverPos) || { x: 0, y: 0 };

  const statusLineY = () => height() - 2;
  const commandLineY = () => height() - 1;
  const viewportHeight = () => height() - 2;

  const totalGutterWidth = () => gutters().reduce((acc, g) => acc + g.width, 0);
  const viewportWidth = () => width() - totalGutterWidth();

  const visualCursorX = () => cursor().x - leftCol() + totalGutterWidth();
  const visualCursorY = () => cursor().y - topLine();

  const lineRenderer = () => lineRenderers()[0];

  createEffect(() => {
    if (props.onCursorChange) {
      props.onCursorChange({ x: visualCursorX(), y: visualCursorY() });
    }
  });

  const fileName = () => {
    if (isExplorer()) return `Explorer: ${explorerPath() || '/'}`;
    return (currentFilePath() || '[No Name]') + (isReadOnly() ? ' [RO]' : '');
  };

  const visibleLines = () => buffer().slice(topLine(), topLine() + viewportHeight());

  return h('box', { x: 0, y: 0, width: width, height: height, border: false }, [
    /* Gutters & Buffer View */
    h(For, { each: visibleLines }, (line: string, i: () => number) => {
      const absoluteLineIndex = () => topLine() + i();
      return h('box', { x: 0, y: i, width: width, height: 1 }, [
        h(For, { each: gutters }, (gutter: GutterOptions, index: () => number) => {
          const x = () => gutters().slice(0, index()).reduce((acc, g) => acc + g.width, 0);
          return h('box', { x: x, y: 0, width: () => gutter.width, height: 1 }, [
            gutter.render({ 
              lineIndex: absoluteLineIndex, 
              lineContent: line, 
              isCursorLine: () => cursor().y === absoluteLineIndex() 
            })
          ]);
        }),
        h(Show, { 
          when: lineRenderer, 
          fallback: h('text', { x: totalGutterWidth, y: 0, content: () => line.slice(leftCol(), leftCol() + viewportWidth()) })
        }, [
          h('box', { x: totalGutterWidth, y: 0, width: viewportWidth, height: 1 }, [
            () => lineRenderer()?.render({
              lineIndex: absoluteLineIndex,
              lineContent: line,
              isCursorLine: () => cursor().y === absoluteLineIndex(),
              gutterWidth: totalGutterWidth
            })
          ])
        ])
      ]);
    }),

    /* Status Line */
    h('box', { x: 0, y: statusLineY, width: width, height: 1, border: false }, [
      h('text', { x: 0, y: 0, content: () => `-- ${mode().toUpperCase()} --   ${fileName()}   ${cursor().y + 1},${cursor().x + 1}` })
    ]),

    /* Command Line / Message Area */
    h('box', { x: 0, y: commandLineY, width: width, height: 1, border: false }, [
      h(Show, { when: () => mode() === 'Command' }, [
        h('text', { x: 0, y: 0, content: () => `:${commandText()}` })
      ])
    ]),

    /* Completion Popup */
    h(Show, { when: () => completionItems().length > 0 }, [
      h('box', { 
        x: () => Math.min(visualCursorX(), width() - 30), 
        y: () => visualCursorY() + 1, 
        width: 30, 
        height: () => Math.min(10, completionItems().length),
        border: true,
        title: 'Completions'
      }, [
        h(For, { each: () => completionItems().slice(0, 10) }, (item: any, i: () => number) => {
          const isSelected = () => i() === selectedCompletionIndex();
          return h('text', { 
            x: 0, 
            y: i, 
            content: () => (isSelected() ? '> ' : '  ') + item.label.slice(0, 26),
            color: () => isSelected() ? '#007acc' : '#ffffff'
          });
        })
      ])
    ]),

    /* Hover Info */
    h(Show, { when: () => hoverText() }, [
      h('box', {
        x: () => Math.min(hoverPos().x, width() - 40),
        y: () => Math.max(0, hoverPos().y - 3),
        width: 40,
        height: 3,
        border: true
      }, [
        h('text', { x: 0, y: 0, content: () => hoverText() || '' })
      ])
    ])
  ]);
};
