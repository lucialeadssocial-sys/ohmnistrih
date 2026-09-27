import { VisualStyleDNA, STYLE_PRESETS, StylePresetId } from "./VisualStyleDNA";

export class VisualStyleManager {
  private static STORAGE_KEY_PREFIX = "omnistrih_visual_dna_";

  static getActiveStyle(projectId: string): VisualStyleDNA {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY_PREFIX + projectId);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("[VisualStyleManager] Error reading visual DNA", e);
    }
    const defaultPreset = { ...STYLE_PRESETS.OMNISTRIH_EDITORIAL, projectId };
    this.saveStyle(projectId, defaultPreset);
    return defaultPreset;
  }

  static saveStyle(projectId: string, dna: VisualStyleDNA): void {
    try {
      dna.projectId = projectId;
      dna.version = (dna.version || 1) + 1;
      localStorage.setItem(this.STORAGE_KEY_PREFIX + projectId, JSON.stringify(dna));
    } catch (e) {
      console.error("[VisualStyleManager] Error saving visual DNA", e);
    }
  }

  static setPreset(projectId: string, presetId: StylePresetId): VisualStyleDNA {
    const basePreset = STYLE_PRESETS[presetId] || STYLE_PRESETS.OMNISTRIH_EDITORIAL;
    const newDna: VisualStyleDNA = {
      ...basePreset,
      id: `${presetId}_${projectId}`,
      projectId,
      source: "STYLE_PRESET",
      version: 1,
    };
    this.saveStyle(projectId, newDna);
    return newDna;
  }

  /**
   * Evaluates override hierarchy:
   * USER LOCK / DO_NOT_TOUCH > EXPLICIT USER OVERRIDE > PROJECT SETTINGS > STYLE PROFILE > EDIT DNA > EDITORIAL ENGINE > AI SUGGESTION > DEFAULT
   */
  static resolveValue<T>(
    paramName: string,
    context: {
      isLocked?: boolean;
      userOverride?: T;
      projectSetting?: T;
      styleProfileValue?: T;
      editDnaValue?: T;
      editorialValue?: T;
      aiSuggestionValue?: T;
      defaultValue: T;
    }
  ): { resolvedValue: T; source: string } {
    if (context.isLocked) {
      return { resolvedValue: context.userOverride ?? context.defaultValue, source: "USER_LOCK" };
    }
    if (context.userOverride !== undefined && context.userOverride !== null) {
      return { resolvedValue: context.userOverride, source: "EXPLICIT_USER_OVERRIDE" };
    }
    if (context.projectSetting !== undefined && context.projectSetting !== null) {
      return { resolvedValue: context.projectSetting, source: "PROJECT_SETTINGS" };
    }
    if (context.styleProfileValue !== undefined && context.styleProfileValue !== null) {
      return { resolvedValue: context.styleProfileValue, source: "STYLE_PROFILE" };
    }
    if (context.editDnaValue !== undefined && context.editDnaValue !== null) {
      return { resolvedValue: context.editDnaValue, source: "EDIT_DNA" };
    }
    if (context.editorialValue !== undefined && context.editorialValue !== null) {
      return { resolvedValue: context.editorialValue, source: "EDITORIAL_ENGINE" };
    }
    if (context.aiSuggestionValue !== undefined && context.aiSuggestionValue !== null) {
      return { resolvedValue: context.aiSuggestionValue, source: "AI_SUGGESTION" };
    }
    return { resolvedValue: context.defaultValue, source: "DEFAULT" };
  }
}
