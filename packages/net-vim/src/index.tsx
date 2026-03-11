import { render } from 'solid-js/web';
import VimEditor from './VimEditor';
import { VimEngine } from './vim-engine';

export { default as VimEditor } from './VimEditor';
export * from './types';
export * from './vim-engine';
export * from './plugin-manager';

export function initNetVim(container: HTMLElement) {
  const vim = new VimEngine(() => {});
  const dispose = render(() => <VimEditor engine={vim} />, container);
  
  return {
    vim,
    dispose
  };
}
