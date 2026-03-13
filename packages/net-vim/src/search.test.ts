import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VimEngine } from './vim-engine';

// Mock utils
vi.mock('./utils', () => ({
  loadScript: vi.fn().mockResolvedValue(undefined),
}));

// Mock opfs-util
vi.mock('./opfs-util', () => ({
  autoFS: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    listDirectory: vi.fn(),
    isDirectory: vi.fn(),
  },
  PRELUDE_BASE: '/prelude',
}));

describe('VimEngine Search', () => {
  let engine: VimEngine;
  const onUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new VimEngine(onUpdate);
    // Set a predictable buffer
    (engine as any).buffer = [
      'first line with apple',
      'second line with banana',
      'third line with apple',
      'fourth line with cherry',
    ];
    engine.setCursor(0, 0);
  });

  it('should enter search mode with /', () => {
    engine.handleKey('/');
    expect(engine.getState().mode).toBe('Search');
  });

  it('should search forward and find next match', () => {
    engine.handleKey('/');
    engine.handleKey('a');
    engine.handleKey('p');
    engine.handleKey('p');
    engine.handleKey('l');
    engine.handleKey('e');
    engine.handleKey('Enter');

    // Should find apple in the first line (index 0) because it starts searching from (0,0) + 1
    expect(engine.getState().cursor).toEqual({ x: 16, y: 0 });
  });

  it('should search backward and find previous match', () => {
    engine.setCursor(0, 2); // Start at "third line with apple"
    engine.handleKey('?');
    engine.handleKey('a');
    engine.handleKey('p');
    engine.handleKey('p');
    engine.handleKey('l');
    engine.handleKey('e');
    engine.handleKey('Enter');

    // Should find apple in the first line (index 0)
    expect(engine.getState().cursor).toEqual({ x: 16, y: 0 });
  });

  it('should wrap around when searching forward', () => {
    engine.setCursor(0, 3); // Start at "fourth line with cherry"
    engine.handleKey('/');
    engine.handleKey('a');
    engine.handleKey('p');
    engine.handleKey('p');
    engine.handleKey('l');
    engine.handleKey('e');
    engine.handleKey('Enter');

    // Should wrap to first line
    expect(engine.getState().cursor).toEqual({ x: 16, y: 0 });
  });

  it('should wrap around when searching backward', () => {
    engine.setCursor(0, 0); // Start at "first line with apple"
    engine.handleKey('?');
    engine.handleKey('a');
    engine.handleKey('p');
    engine.handleKey('p');
    engine.handleKey('l');
    engine.handleKey('e');
    engine.handleKey('Enter');

    // Should wrap to third line
    expect(engine.getState().cursor).toEqual({ x: 16, y: 2 });
  });

  it('should support repeating search with n and N', () => {
    engine.handleKey('/');
    engine.handleKey('a');
    engine.handleKey('p');
    engine.handleKey('p');
    engine.handleKey('l');
    engine.handleKey('e');
    engine.handleKey('Enter');
    
    expect(engine.getState().cursor).toEqual({ x: 16, y: 0 });

    engine.handleKey('n'); // Next forward
    expect(engine.getState().cursor).toEqual({ x: 16, y: 2 });

    engine.handleKey('N'); // Next backward
    expect(engine.getState().cursor).toEqual({ x: 16, y: 0 });
  });

  it('should support regular expressions', () => {
    engine.handleKey('/');
    engine.handleKey('b');
    engine.handleKey('.');
    engine.handleKey('n');
    engine.handleKey('Enter');

    // Should match "ban" in banana (index 17 in "second line with banana")
    expect(engine.getState().cursor).toEqual({ x: 17, y: 1 });
  });

  it('should repeat last search with empty Enter', () => {
    // 1. First search for banana
    engine.handleKey('/');
    engine.handleKey('b');
    engine.handleKey('a');
    engine.handleKey('n');
    engine.handleKey('a');
    engine.handleKey('n');
    engine.handleKey('a');
    engine.handleKey('Enter');
    expect(engine.getState().cursor).toEqual({ x: 17, y: 1 });

    // 2. Move cursor back to (0,0)
    engine.setCursor(0, 0);

    // 3. Search again with empty Enter
    engine.handleKey('/');
    engine.handleKey('Enter');
    expect(engine.getState().cursor).toEqual({ x: 17, y: 1 });
  });

  it('should show message when pattern not found', () => {
    engine.handleKey('/');
    engine.handleKey('z');
    engine.handleKey('e');
    engine.handleKey('b');
    engine.handleKey('r');
    engine.handleKey('a');
    engine.handleKey('Enter');

    expect(engine.getState().statusMessage).toContain('Pattern not found');
  });

  it('should show message on invalid regex', () => {
    engine.handleKey('/');
    engine.handleKey('[');
    engine.handleKey('Enter');

    expect(engine.getState().statusMessage).toContain('Invalid pattern');
  });
});
