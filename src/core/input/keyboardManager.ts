/**
 * Centralized Keyboard Shortcut System for OmniStrih AI
 * Provides context-aware keybindings, input field isolation, and modular shortcut registration.
 */

export type ShortcutContext = 'global' | 'timeline' | 'source' | 'program';

export interface ShortcutDefinition {
  id: string;
  key: string; // e.g. 'Space', 'j', 'k', 'l', 'i', 'o', 'x', 'm', 'v', 'c', 'ArrowLeft', 'ArrowRight'
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  context?: ShortcutContext;
  action: (e: KeyboardEvent) => void;
  enabled?: boolean;
}

export class KeyboardManager {
  private static instance: KeyboardManager | null = null;
  private shortcuts: Map<string, ShortcutDefinition> = new Map();
  private currentContext: ShortcutContext = 'global';
  private isListening: boolean = false;
  private cleanupListener: (() => void) | null = null;

  private constructor() {}

  public static getInstance(): KeyboardManager {
    if (!KeyboardManager.instance) {
      KeyboardManager.instance = new KeyboardManager();
    }
    return KeyboardManager.instance;
  }

  public setContext(context: ShortcutContext): void {
    this.currentContext = context;
  }

  public getContext(): ShortcutContext {
    return this.currentContext;
  }

  public register(shortcut: ShortcutDefinition): () => void {
    this.shortcuts.set(shortcut.id, { ...shortcut, enabled: shortcut.enabled ?? true });
    return () => {
      this.shortcuts.delete(shortcut.id);
    };
  }

  public unregister(id: string): void {
    this.shortcuts.delete(id);
  }

  public init(): () => void {
    if (this.isListening) return () => {};

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events inside inputs, textareas, selects, or editable divs
      const target = e.target as HTMLElement;
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
          target.isContentEditable ||
          target.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;
      const pressedKey = e.key;

      for (const shortcut of this.shortcuts.values()) {
        if (shortcut.enabled === false) continue;

        // Context check: 'global' shortcuts match any context
        if (shortcut.context && shortcut.context !== 'global' && shortcut.context !== this.currentContext) {
          continue;
        }

        const matchCtrlCmd = shortcut.ctrlOrCmd ? isCtrlOrCmd : !isCtrlOrCmd;
        const matchShift = shortcut.shift ? isShift : !isShift;
        const matchAlt = shortcut.alt ? isAlt : !isAlt;
        const matchKey = shortcut.key.toLowerCase() === pressedKey.toLowerCase() ||
                         (shortcut.key === 'Space' && pressedKey === ' ') ||
                         (shortcut.key === 'Delete' && (pressedKey === 'Delete' || pressedKey === 'Backspace'));

        if (matchKey && matchCtrlCmd && matchShift && matchAlt) {
          e.preventDefault();
          shortcut.action(e);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    this.isListening = true;
    this.cleanupListener = () => {
      window.removeEventListener('keydown', handleKeyDown);
      this.isListening = false;
    };

    return this.cleanupListener;
  }
}

export const keyboardManager = KeyboardManager.getInstance();
