import { ProjectModel, EditingPreference } from '../types/project';

export class EditingBrain {
  private static instance: EditingBrain;

  public static getInstance(): EditingBrain {
    if (!EditingBrain.instance) EditingBrain.instance = new EditingBrain();
    return EditingBrain.instance;
  }

  public observeAction(
    project: ProjectModel,
    action: 'ACCEPTED' | 'MODIFIED' | 'REJECTED' | 'MANUAL',
    decisionType: EditingPreference['category'],
    context: EditingPreference['context']
  ): void {
    if (!project.editingPreferences) project.editingPreferences = [];
    
    const existing = project.editingPreferences.find(p => p.category === decisionType && p.context === context);
    
    if (existing) {
      existing.evidenceCount += 1;
      // Simple confidence update: increase with action, decrease on rejection
      if (action === 'ACCEPTED') existing.confidence = Math.min(1, existing.confidence + 0.05);
      if (action === 'REJECTED') existing.confidence = Math.max(0, existing.confidence - 0.1);
      existing.updatedAt = Date.now();
    } else {
      project.editingPreferences.push({
        id: crypto.randomUUID(),
        category: decisionType,
        value: action, // Simplified as value
        confidence: 0.1,
        evidenceCount: 1,
        context,
        source: 'OBSERVED',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        enabled: true
      });
    }
    console.log(`EditingBrain updated ${decisionType} preference in ${context}`);
  }

  public getPreferences(project: ProjectModel, category: EditingPreference['category']): EditingPreference[] {
    return project.editingPreferences?.filter(p => p.category === category && p.enabled) || [];
  }
}

export const editingBrain = EditingBrain.getInstance();
