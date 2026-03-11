# @net-vim/virtual-keyboard

[![npm version](https://img.shields.io/npm/v/@net-vim/virtual-keyboard.svg)](https://www.npmjs.com/package/@net-vim/virtual-keyboard)

A framework-agnostic virtual keyboard component for web applications, designed for mobile terminal-like experiences.

## Installation

```bash
npm install @net-vim/virtual-keyboard
```

## Usage

### Framework-Agnostic Initialization

You can initialize the virtual keyboard into any HTML element without requiring a specific frontend framework.

```javascript
import { initVirtualKeyboard } from '@net-vim/virtual-keyboard';

const container = document.getElementById('keyboard-container');
const { dispose } = initVirtualKeyboard(container, {
  onKeyPress: (key, mods) => {
    console.log('Key pressed:', key, 'Mods:', mods);
  }
});

// To remove the keyboard later
// dispose();
```

### Solid.js Component

For applications using Solid.js, the keyboard is available as a component.

```tsx
import { VirtualKeyboard } from '@net-vim/virtual-keyboard';

function App() {
  const handleKeyPress = (key, mods) => {
    console.log('Key pressed:', key, 'Mods:', mods);
  };

  return (
    <div style={{ position: 'fixed', bottom: 0, width: '100%' }}>
      <VirtualKeyboard onKeyPress={handleKeyPress} />
    </div>
  );
}
```

## License

MIT
