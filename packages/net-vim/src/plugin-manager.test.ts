import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginManager } from './plugin-manager';
import type { VimAPI } from './types';

describe('PluginManager', () => {
  let pluginManager: PluginManager;
  let mockVimAPI: any;

  beforeEach(() => {
    mockVimAPI = {
      babel: {
        transform: vi.fn(),
      },
      getFS: vi.fn().mockReturnValue({
        readFile: vi.fn(),
        writeFile: vi.fn(),
      }),
    };
    pluginManager = new PluginManager(() => mockVimAPI as VimAPI);
  });

  it('should initialize with no plugins', () => {
    expect(pluginManager.getLoadedPlugins()).toEqual([]);
  });

  it('should fail to load plugin if Babel is missing', async () => {
    mockVimAPI.babel = undefined;
    const success = await pluginManager.loadPluginFromSource('test-plugin', 'console.log("hello")');
    expect(success).toBe(false);
  });

  it('should load a simple plugin from source', async () => {
    const pluginSource = `
      export default {
        metadata: { name: 'test-plugin' },
        setup: (api) => {
          api.log('Plugin loaded');
        }
      }
    `;

    mockVimAPI.babel.transform.mockReturnValue({
      code: `
        "use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        exports.default = {
          metadata: { name: 'test-plugin' },
          setup: function(api) {
            api.log('Plugin loaded');
          }
        };
      `
    });

    const success = await pluginManager.loadPluginFromSource('test-plugin', pluginSource);
    expect(success).toBe(true);
    expect(pluginManager.getLoadedPlugins()).toContainEqual({ name: 'test-plugin' });
  });

  it('should handle setup errors gracefully', async () => {
    const pluginSource = `
      export default {
        metadata: { name: 'failing-plugin' },
        setup: (api) => {
          throw new Error('Setup failed');
        }
      }
    `;

    mockVimAPI.babel.transform.mockReturnValue({
      code: `
        "use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        exports.default = {
          metadata: { name: 'failing-plugin' },
          setup: function(api) {
            throw new Error('Setup failed');
          }
        };
      `
    });

    const success = await pluginManager.loadPluginFromSource('failing-plugin', pluginSource);
    expect(success).toBe(true); // Registration succeeds even if setup fails
    expect(pluginManager.getLoadedPlugins()).toContainEqual({ name: 'failing-plugin' });
  });
});
