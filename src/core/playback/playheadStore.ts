/**
 * Isolated High-Frequency Playhead Store
 * Provides 60fps playhead updates without triggering React App.tsx / editor tree re-renders.
 * Uses useSyncExternalStore for targeted sub-component subscriptions.
 */

import { useSyncExternalStore, useCallback } from 'react';

export interface PlayheadState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isScrubbing: boolean;
}

export class PlayheadStore {
  private static instance: PlayheadStore | null = null;
  
  private currentTime: number = 0;
  private duration: number = 15;
  private isPlaying: boolean = false;
  private isScrubbing: boolean = false;

  private timeListeners: Set<(time: number) => void> = new Set();
  private stateListeners: Set<(state: PlayheadState) => void> = new Set();

  private constructor() {}

  public static getInstance(): PlayheadStore {
    if (!PlayheadStore.instance) {
      PlayheadStore.instance = new PlayheadStore();
    }
    return PlayheadStore.instance;
  }

  public getTime(): number {
    return this.currentTime;
  }

  public getDuration(): number {
    return this.duration;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getIsScrubbing(): boolean {
    return this.isScrubbing;
  }

  public getState(): PlayheadState {
    return {
      currentTime: this.currentTime,
      duration: this.duration,
      isPlaying: this.isPlaying,
      isScrubbing: this.isScrubbing,
    };
  }

  /**
   * High-frequency time update (called on every animation frame / timeupdate)
   */
  public setTime(time: number, notifyState: boolean = false): void {
    if (Math.abs(this.currentTime - time) < 0.001) return;
    this.currentTime = time;

    // Fast notify for direct DOM/time listeners
    for (const listener of this.timeListeners) {
      try {
        listener(time);
      } catch (err) {
        console.error('[PlayheadStore] Listener error:', err);
      }
    }

    if (notifyState) {
      this.notifyStateChanged();
    }
  }

  public setDuration(duration: number): void {
    if (this.duration === duration) return;
    this.duration = Math.max(0.1, duration);
    this.notifyStateChanged();
  }

  public setIsPlaying(isPlaying: boolean): void {
    if (this.isPlaying === isPlaying) return;
    this.isPlaying = isPlaying;
    this.notifyStateChanged();
  }

  public setIsScrubbing(isScrubbing: boolean): void {
    if (this.isScrubbing === isScrubbing) return;
    this.isScrubbing = isScrubbing;
    this.notifyStateChanged();
  }

  private notifyStateChanged(): void {
    const state = this.getState();
    for (const listener of this.stateListeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[PlayheadStore] State listener error:', err);
      }
    }
  }

  /**
   * Subscribes to high-frequency playhead time changes (60fps)
   */
  public subscribeTime(listener: (time: number) => void): () => void {
    this.timeListeners.add(listener);
    return () => {
      this.timeListeners.delete(listener);
    };
  }

  /**
   * Subscribes to general state changes (play, pause, scrub, duration)
   */
  public subscribeState(listener: (state: PlayheadState) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }
}

export const playheadStore = PlayheadStore.getInstance();

/**
 * Hook to subscribe to isolated playhead time in individual leaf components.
 */
export function usePlayheadTime(): number {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return playheadStore.subscribeTime(() => {
      onStoreChange();
    });
  }, []);

  const getSnapshot = useCallback(() => {
    return playheadStore.getTime();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}

/**
 * Hook to subscribe to full playhead state.
 */
export function usePlayheadState(): PlayheadState {
  const subscribe = useCallback((onStoreChange: () => void) => {
    return playheadStore.subscribeState(() => {
      onStoreChange();
    });
  }, []);

  const getSnapshot = useCallback(() => {
    return playheadStore.getState();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, () => ({
    currentTime: 0,
    duration: 15,
    isPlaying: false,
    isScrubbing: false,
  }));
}
