import type { ScopedVimAPI } from './plugin-manager';

export default {
  metadata: {
    name: 'line-numbers',
    author: 'Web-Vim Team',
    version: '1.0.0',
    description: 'Provides line numbers in the gutter'
  },
  setup: (api: ScopedVimAPI) => {
    api.registerGutter({
      name: 'line-numbers',
      width: 4,
      priority: 100,
      render: ({ lineIndex, isCursorLine }) => {
        const getVal = <T,>(val: T | (() => T)): T => (typeof val === 'function' ? (val as Function)() : val);
        const num = () => (getVal(lineIndex) + 1).toString().padStart(3, ' ');
        // We can use JSX here because we've configured Babel to use 'h'
        return (
          <tui-text 
            content={() => num() + ' '} 
            color={() => getVal(isCursorLine) ? '#ffffff' : '#888888'} 
          />
        );
      }
    });
    
    api.log('Line numbers plugin initialized');
  }
};
