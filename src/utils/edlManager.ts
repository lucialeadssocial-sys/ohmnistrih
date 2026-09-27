import { EditDecisionRecord, EditDecisionList } from "../types";

export class EDLManager {
  private static STORAGE_KEY_PREFIX = "omnistrih_edl_";
  private static HISTORY_KEY_PREFIX = "omnistrih_edl_history_";
  private static memoryStore: Map<string, string> = new Map();

  private static safeGetItem(key: string): string | null {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // ignore
    }
    return this.memoryStore.get(key) || null;
  }

  private static safeSetItem(key: string, value: string): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
    this.memoryStore.set(key, value);
  }

  static createDefaultEDL(projectId: string): EditDecisionList {
    const defaultDecisions: EditDecisionRecord[] = [
      {
        id: "edl-1",
        type: "KEEP",
        action: "KEEP",
        sourceMediaId: "src-1",
        sourceStart: 0,
        sourceEnd: 5,
        timelineStart: 0,
        timelineEnd: 5,
        start: 0,
        end: 5,
        reason: "Primary hook statement establishing clear value proposition and topic.",
        reasonSk: "Primárne vyhlásenie pre zachovanie pozornosti v úvode videa.",
        confidence: 0.98,
        createdBy: "AI",
        status: "accepted",
        category: "SAFE",
        risk: "SAFE",
        isLocked: true,
      },
      {
        id: "edl-2",
        type: "CUT",
        action: "REMOVE",
        sourceMediaId: "src-1",
        sourceStart: 5,
        sourceEnd: 10,
        timelineStart: 5,
        timelineEnd: 5, // Cut segment does not occupy timeline span
        start: 5,
        end: 10,
        reason: "Silence or filler detected. Cut out per autopilot rules.",
        reasonSk: "Detekované ticho alebo výplň. Vystrihnuté pravidlami autopilota.",
        confidence: 0.95,
        createdBy: "AI",
        status: "accepted",
        category: "SAFE",
        risk: "SAFE",
        isLocked: false,
      },
      {
        id: "edl-3",
        type: "KEEP",
        action: "KEEP",
        sourceMediaId: "src-1",
        sourceStart: 10,
        sourceEnd: 20,
        timelineStart: 5,
        timelineEnd: 15,
        start: 10,
        end: 20,
        reason: "Body core content statement.",
        reasonSk: "Hlavná obsahová časť vyhlásenia.",
        confidence: 0.97,
        createdBy: "AI",
        status: "accepted",
        category: "SAFE",
        risk: "SAFE",
        isLocked: false,
      },
    ];

    return {
      projectId,
      version: 1,
      decisions: defaultDecisions,
      lastUpdated: new Date().toISOString(),
    };
  }

  static getEDL(projectId: string): EditDecisionList {
    try {
      const saved = this.safeGetItem(this.STORAGE_KEY_PREFIX + projectId);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load EDL", e);
    }
    const fresh = this.createDefaultEDL(projectId);
    this.saveEDL(fresh);
    return fresh;
  }

  static saveEDL(edl: EditDecisionList): void {
    try {
      // Push previous version to history stack for version rollback / undo
      const historyKey = this.HISTORY_KEY_PREFIX + edl.projectId;
      let history: EditDecisionList[] = [];
      const existingHistory = this.safeGetItem(historyKey);
      if (existingHistory) {
        history = JSON.parse(existingHistory);
      }
      const current = this.safeGetItem(this.STORAGE_KEY_PREFIX + edl.projectId);
      if (current) {
        history.push(JSON.parse(current));
        if (history.length > 20) history.shift(); // keep last 20 versions
        this.safeSetItem(historyKey, JSON.stringify(history));
      }

      edl.version += 1;
      edl.lastUpdated = new Date().toISOString();
      this.safeSetItem(this.STORAGE_KEY_PREFIX + edl.projectId, JSON.stringify(edl));
    } catch (e) {
      console.error("Failed to save EDL", e);
    }
  }

  static restorePreviousVersion(projectId: string): EditDecisionList | null {
    try {
      const historyKey = this.HISTORY_KEY_PREFIX + projectId;
      const existingHistory = this.safeGetItem(historyKey);
      if (existingHistory) {
        const history: EditDecisionList[] = JSON.parse(existingHistory);
        if (history.length > 0) {
          const previous = history.pop()!;
          this.safeSetItem(historyKey, JSON.stringify(history));
          this.safeSetItem(this.STORAGE_KEY_PREFIX + projectId, JSON.stringify(previous));
          return previous;
        }
      }
    } catch (e) {
      console.error("Failed to restore EDL version", e);
    }
    return null;
  }

  /**
   * CRITICAL TEST: EDL -> Playback Mapping
   * Maps timeline time (seconds) to source media time (seconds), skipping REMOVE/CUT decisions.
   */
  static timelineTimeToSourceTime(edl: EditDecisionList, timelineTime: number): { sourceTime: number; sourceMediaId: string } {
    let accumulatedTimeline = 0;
    
    // Sort keep/cut decisions by timeline order
    const sorted = [...edl.decisions].sort((a, b) => (a.timelineStart ?? a.start) - (b.timelineStart ?? b.start));

    for (const dec of sorted) {
      if (dec.action === "REMOVE" || dec.action === "CUT") {
        continue; // skipped in playback
      }

      const tStart = dec.timelineStart ?? dec.start;
      const tEnd = dec.timelineEnd ?? dec.end;
      const span = tEnd - tStart;

      if (timelineTime <= accumulatedTimeline + span) {
        const offset = timelineTime - accumulatedTimeline;
        const sStart = dec.sourceStart ?? dec.start;
        return {
          sourceTime: sStart + offset,
          sourceMediaId: dec.sourceMediaId || "src-1",
        };
      }
      accumulatedTimeline += span;
    }

    // Fallback to start
    return { sourceTime: 0, sourceMediaId: "src-1" };
  }

  /**
   * Calculate confidence using real heuristics (silence duration, filler check, semantic safety)
   */
  static calculateConfidence(duration: number, isFiller: boolean, hasSemanticRisk: boolean): { confidence: number; category: "SAFE" | "REVIEW" | "CRITICAL" } {
    if (hasSemanticRisk) {
      return { confidence: 0.65, category: "CRITICAL" };
    }
    if (isFiller) {
      return { confidence: 0.95, category: "SAFE" };
    }
    if (duration > 1.5) {
      return { confidence: 0.92, category: "SAFE" }; // long silence
    }
    return { confidence: 0.81, category: "REVIEW" };
  }
}
