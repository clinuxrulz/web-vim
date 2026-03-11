import { render } from 'solid-js/web';
import VirtualKeyboard, { type VirtualKeyboardProps } from './App';

export { default as VirtualKeyboard } from './App';
export type { VirtualKeyboardProps, KeyboardMode } from './App';

export function initVirtualKeyboard(container: HTMLElement, props: VirtualKeyboardProps = {}) {
  const dispose = render(() => <VirtualKeyboard {...props} />, container);
  
  return {
    dispose
  };
}
