import { ProjectModel, EditingPreference } from '../types/project';

export class EditingBrain {
  private static instance: EditingBrain;

  public static getInstance(): EditingBrain {
    if (!EditingBrain.instance) EditingBrain.instance = new EditingBrain();
    return EditingBrain.instance;
  }

  /**
   * Records what the user did with an AI proposal (or their own manual edit) as evidence.
   *
   * Returns a NEW preference list — the caller writes it into the project, so this stays a pure
   * function and the canonical project is only changed through one explicit write.
   */
  public observeAction(
    project: ProjectModel,
    action: 'ACCEPTED' | 'MODIFIED' | 'REJECTED' | 'MANUAL',
    decisionType: EditingPreference['category'],
    context: EditingPreference['context'],
    detail?: string
  ): EditingPreference[] {
    const preferences = (project.editingPreferences || []).map(p => ({ ...p }));
    const existing = preferences.find(p => p.category === decisionType && p.context === context);
    const now = Date.now();

    if (existing) {
      existing.evidenceCount += 1;
      // Confidence moves with the evidence: acceptance raises it, rejection lowers it.
      if (action === 'ACCEPTED') existing.confidence = Math.min(1, Number((existing.confidence + 0.15).toFixed(2)));
      else if (action === 'MODIFIED') existing.confidence = Math.max(0, Number((existing.confidence - 0.05).toFixed(2)));
      else if (action === 'REJECTED') existing.confidence = Math.max(0, Number((existing.confidence - 0.2).toFixed(2)));
      // The latest observed behaviour is the current preference value.
      existing.value = action;
      existing.notes = detail
        ? `${detail} (${existing.evidenceCount}× pozorované)`
        : `Naposledy: ${action} (${existing.evidenceCount}× pozorované)`;
      existing.updatedAt = now;
    } else {
      preferences.push({
        id: crypto.randomUUID(),
        category: decisionType,
        value: action,
        confidence: action === 'ACCEPTED' ? 0.15 : 0.1,
        evidenceCount: 1,
        context,
        source: 'OBSERVED',
        createdAt: now,
        updatedAt: now,
        enabled: true,
        notes: detail ? `${detail} (1× pozorované)` : `Naposledy: ${action} (1× pozorované)`,
      });
    }

    console.log(`[EditingBrain] ${decisionType}/${context}: ${action}${detail ? ` — ${detail}` : ''} (${existing ? existing.evidenceCount : 1}×)`);
    return preferences;
  }

  /**
   * Summary of what was really observed for a category — used by the Director to explain
   * why a recommendation was promoted or demoted.
   */
  public describeObservation(
    project: ProjectModel,
    category: EditingPreference['category'],
    minEvidence: number = 2
  ): { action: EditingPreference['value']; evidenceCount: number; confidence: number } | null {
    const match = (project.editingPreferences || [])
      .filter(p => p.category === category && p.enabled && p.evidenceCount >= minEvidence)
      .sort((a, b) => b.evidenceCount - a.evidenceCount)[0];

    if (!match) return null;
    return { action: match.value, evidenceCount: match.evidenceCount, confidence: match.confidence };
  }

  public getPreferences(project: ProjectModel, category: EditingPreference['category']): EditingPreference[] {
    return project.editingPreferences?.filter(p => p.category === category && p.enabled) || [];
  }
}

export const editingBrain = EditingBrain.getInstance();
