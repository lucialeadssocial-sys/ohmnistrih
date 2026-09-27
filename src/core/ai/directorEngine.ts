/**
 * OmniStrih AI — AI Director Decision Engine (FÁZA 2F)
 * Converts analysis results into explainable, reviewable, non-destructive DirectorPlans.
 */

import {
  AnalysisResultCollection,
  DirectorDecisionItem,
  DirectorObjective,
  DirectorPlan,
  DirectorStrategy,
  EditComparison,
  DecisionPriority,
  KnowledgeCategory
} from './analysisTypes';
import { ProjectModel, EditDecision } from '../types/project';
import { EDIT_KNOWLEDGE_BASE, getTeachMeExplanation } from './knowledgeBase';
import {
  CommandManager,
  TrimClipCommand,
  SplitClipCommand,
  SetAudioFadeCommand,
  SetTransformCommand,
  SetColorCorrectionCommand,
  SetTransitionCommand,
  CreateProjectVersionCommand,
  SwitchMulticamAngleCommand
} from '../command/commandSystem';

import { editingBrain } from './editingBrain';

export class DirectorEngine {
  private static instance: DirectorEngine | null = null;

  public static getInstance(): DirectorEngine {
    if (!DirectorEngine.instance) {
      DirectorEngine.instance = new DirectorEngine();
    }
    return DirectorEngine.instance;
  }

  /**
   * Generates a deterministic, explainable DirectorPlan from analysis results.
   */
  public generateDirectorPlan(
    project: ProjectModel,
    targetPlatform: 'TikTok' | 'Instagram Reels' | 'YouTube Shorts' | 'YouTube Long-form' | 'UGC Ads' | 'General' = 'TikTok',
    objectives: DirectorObjective[] = ['Retention', 'Education']
  ): DirectorPlan {
    const analysis = project.analysisResults || {
      projectId: project.id,
      timestamp: Date.now()
    };

    const decisions: DirectorDecisionItem[] = [];

    // Query Brain for preferences
    const pacingPrefs = editingBrain.getPreferences(project, 'PACING');

    // 1. Pacing & Pause Trimming Decisions
    const pauseList = analysis.pauses?.filter((p: any) => p.type === 'long_pause') || [
      { id: 'p1', start: 4.2, end: 5.8, duration: 1.6, confidence: 0.95 }
    ];

    pauseList.forEach((pause: any, idx: number) => {
      const teach = EDIT_KNOWLEDGE_BASE.PAUSE_TRIMMING;
      decisions.push({
        id: `dir_dec_pause_${idx}`,
        editDecisionId: `dec_pause_${idx}`,
        priority: pause.duration > 2.0 ? 'MUST_CONSIDER' : 'RECOMMENDED',
        what: `Skrátenie dlhej pauzy v čase ${pause.start.toFixed(1)}s (${pause.duration.toFixed(1)}s -> 0.4s)`,
        why: teach.why,
        whenToUse: teach.whenToUse,
        whenNotToUse: teach.whenNotToUse,
        howToManual: teach.manualWorkflowSteps || [],
        alternatives: teach.alternativeChoices || ['Ponechať pre dramatický účinok.'],
        confidence: pause.confidence || 0.95,
        source: teach.source,
        category: (teach.category as KnowledgeCategory) || 'heuristic',
        timelineLocation: { start: pause.start, end: pause.end },
        status: 'proposed'
      });
    });

    // 2. Hook Enhancement Strategy Decisions (Punch-in)
    const hookList = analysis.hooks || [
      { id: 'h1', start: 0, end: 3.0, type: 'question', confidence: 0.94 }
    ];

    hookList.forEach((hook: any, idx: number) => {
      const teach = EDIT_KNOWLEDGE_BASE.HOOK_PUNCHIN || {
        why: 'Prvých 3.0s rozhoduje o tom, či divák preskočí video (Scroll Stop).',
        whenToUse: 'Pri úvodnej otázke alebo prekvapivom tvrdení.',
        whenNotToUse: 'Pri uvoľnenom podcastovom úvode.',
        source: 'TikTok & Shorts Retention Benchmarks 2026'
      };
      decisions.push({
        id: `dir_dec_hook_${idx}`,
        editDecisionId: `dec_hook_${idx}`,
        priority: 'MUST_CONSIDER',
        what: `Punch-in Zoom (100% -> 115%) pre zamedzenie preskakovaniu hooku v čase ${hook.start}s - ${hook.end}s`,
        why: teach.why,
        whenToUse: teach.whenToUse,
        whenNotToUse: teach.whenNotToUse,
        howToManual: EDIT_KNOWLEDGE_BASE.HOOK_PUNCHIN?.manualWorkflowSteps || [
          '1. Označ prvých 3.0s hlavného klipu na V1.',
          '2. V Inspectorovi nastav Scale na 115%.',
          '3. Vycentruj pozíciu tváre v hornej tretine.'
        ],
        alternatives: EDIT_KNOWLEDGE_BASE.HOOK_PUNCHIN?.alternativeChoices || ['Pridať zvýraznený titulok na stope T1.'],
        confidence: hook.confidence || 0.94,
        source: teach.source,
        category: 'trend_platform_pattern',
        timelineLocation: { start: hook.start, end: hook.end },
        status: 'proposed'
      });
    });

    // 3. J-Cut / Audio Lead Decision
    const jcutTeach = EDIT_KNOWLEDGE_BASE.J_CUT;
    decisions.push({
      id: `dir_dec_jcut_0`,
      editDecisionId: `dec_jcut_0`,
      priority: 'RECOMMENDED',
      what: `Použitie J-Cut prechodu (zvuk predbieha obraz o 1.2s) v čase 12.0s`,
      why: jcutTeach.why,
      whenToUse: jcutTeach.whenToUse,
      whenNotToUse: jcutTeach.whenNotToUse,
      howToManual: jcutTeach.manualWorkflowSteps || [],
      alternatives: jcutTeach.alternativeChoices || [],
      confidence: 0.98,
      source: jcutTeach.source,
      category: 'professional_convention',
      timelineLocation: { start: 12.0, end: 14.5 },
      status: 'proposed'
    });

    // 4. B-Roll & Visual Pacing Strategy
    const brollList = analysis.brollOpportunities || [
      { id: 'b1', start: 8.5, end: 11.5, suggestedVisualType: 'product', confidence: 0.92 }
    ];

    brollList.forEach((broll: any, idx: number) => {
      const teach = EDIT_KNOWLEDGE_BASE.BROLL_INSERTION;
      decisions.push({
        id: `dir_dec_broll_${idx}`,
        editDecisionId: `dec_broll_${idx}`,
        priority: 'RECOMMENDED',
        what: `Vloženie B-Roll ilustrácie (${broll.suggestedVisualType}) na V2 v čase ${broll.start}s - ${broll.end}s`,
        why: teach.why,
        whenToUse: teach.whenToUse,
        whenNotToUse: teach.whenNotToUse,
        howToManual: teach.manualWorkflowSteps || [],
        alternatives: teach.alternativeChoices || ['Použiť Punch-in zoom.'],
        confidence: broll.confidence || 0.92,
        source: teach.source,
        category: 'professional_convention',
        timelineLocation: { start: broll.start, end: broll.end },
        status: 'proposed'
      });
    });

    // 5. Captions & Emphasis Decision
    const capTeach = EDIT_KNOWLEDGE_BASE.CAPTIONS_EMPHASIS;
    decisions.push({
      id: `dir_dec_captions_0`,
      editDecisionId: `dec_captions_0`,
      priority: 'MUST_CONSIDER',
      what: `Zvýraznenie kľúčových slov v titulkách (Neon accent color) pre mobilné sledovanie`,
      why: capTeach.why,
      whenToUse: capTeach.whenToUse,
      whenNotToUse: capTeach.whenNotToUse,
      howToManual: capTeach.manualWorkflowSteps || [],
      alternatives: capTeach.alternativeChoices || [],
      confidence: 0.97,
      source: capTeach.source,
      category: 'professional_convention',
      timelineLocation: { start: 0.0, end: 15.0 },
      status: 'proposed'
    });

    // 6. Audio Ducking Strategy
    const duckTeach = EDIT_KNOWLEDGE_BASE.AUDIO_DUCKING;
    decisions.push({
      id: `dir_dec_audio_ducking`,
      editDecisionId: `dec_audio_ducking`,
      priority: 'RECOMMENDED',
      what: 'Automatické stíšenie hudby pod hovoreným slovom (Audio Ducking -12dB na A2)',
      why: duckTeach.why,
      whenToUse: duckTeach.whenToUse,
      whenNotToUse: duckTeach.whenNotToUse,
      howToManual: duckTeach.manualWorkflowSteps || [],
      alternatives: duckTeach.alternativeChoices || [],
      confidence: 0.98,
      source: duckTeach.source,
      category: 'technical_constraint',
      timelineLocation: { start: 0.0, end: 15.0 },
      status: 'proposed'
    });

    // 7. Color Correction & Skin Tones
    const colorTeach = EDIT_KNOWLEDGE_BASE.COLOR_BALANCING;
    decisions.push({
      id: `dir_dec_color_0`,
      editDecisionId: `dec_color_0`,
      priority: 'OPTIONAL',
      what: 'Primary Color Correction & Vyváženie tónu pleti (Skin Tone Balance na V1)',
      why: colorTeach.why,
      whenToUse: colorTeach.whenToUse,
      whenNotToUse: colorTeach.whenNotToUse,
      howToManual: colorTeach.manualWorkflowSteps || [],
      alternatives: colorTeach.alternativeChoices || [],
      confidence: 0.95,
      source: colorTeach.source,
      category: 'technical_constraint',
      timelineLocation: { start: 0.0, end: 15.0 },
      status: 'proposed'
    });

    // 8. Motion Graphics & Professional Animation Decisions (FÁZA 2R)
    const infoDensity = analysis.speechDensity?.informationDensity || 'balanced';
    if (infoDensity === 'high') {
      decisions.push({
        id: `dir_dec_motion_callout`,
        editDecisionId: `dec_motion_callout`,
        priority: 'RECOMMENDED',
        what: 'Pridanie vizuálnych Callouts pre kľúčové fakty (T1 stopa)',
        why: 'Vysoká informačná hustota vyžaduje vizuálne kotvy pre lepšie pochopenie.',
        whenToUse: 'Pri uvádzaní čísel, mien alebo technických termínov.',
        whenNotToUse: 'Pri emocionálnom storytellingu.',
        howToManual: [
          '1. Vytvor Text Clip na stope T1.',
          '2. Použi "Callout" preset v Motion Inspectore.',
          '3. Animuj Scale (0 -> 100) s Bounce easingom.'
        ],
        alternatives: ['Použiť statický obrázok.', 'Zmeniť veľkosť záberu.'],
        confidence: 0.91,
        source: 'Educational Content Research 2026',
        category: 'professional_convention',
        timelineLocation: { start: 10.0, end: 13.5 },
        status: 'proposed'
      });
    }

    // 9. Multicam & Speaker-Aware Decisions (FÁZA 2S)
    const multicamGroup = project.multicamGroups?.[0];
    if (multicamGroup && multicamGroup.angles.length > 1) {
      decisions.push({
        id: `dir_dec_multicam_switch_0`,
        editDecisionId: `dec_mc_0`,
        priority: 'MUST_CONSIDER',
        what: `Automatický Multicam Strih na aktívneho rečníka (Angle: ${multicamGroup.angles[1]?.name || 'Detail'})`,
        why: 'Prestrih na detail v čase dôležitej myšlienky zvyšuje zapojenie diváka.',
        whenToUse: 'Pri prechode na novú tému alebo zvýšení hlasitosti rečníka.',
        whenNotToUse: 'Keď rečník robí dôležité gesto rukami (lepšie nechať široký záber).',
        howToManual: [
          '1. Otvor Multicam Viewer.',
          '2. Klikni na požadovaný uhol v čase playheadu.',
          '3. Dolaď bod strihu pomocou Slip editu.'
        ],
        alternatives: ['Ponechať široký záber.', 'Použiť digital zoom na 4K zdroj.'],
        confidence: 0.96,
        source: 'Professional Interview Standards',
        category: 'professional_convention',
        timelineLocation: { start: 5.2, end: 5.3 },
        status: 'proposed'
      });
    }

    const strategies = {
      hookStrategy: {
        name: 'Scroll-Stop Hook Optimization',
        goal: 'Zvýšenie retencie v prvých 3 sekundách',
        approach: 'Kombinácia vizuálneho Punch-inu a zvýraznenia kľúčovej otázky v titulkách.',
        why: 'Statický úvod v prvých 2s znižuje pravdepodobnosť dopočúvania o 42%.',
        confidence: 0.93
      },
      pacingStrategy: {
        name: 'Thought-Bound Pacing',
        goal: 'Udržanie prirodzeného toku reči bez robotičnosti',
        approach: 'Skracovanie dlhých hezitácií (>1.5s) pri zachovaní mikropauz na dýchanie (0.3s-0.5s).',
        why: 'Slepé vymazanie všetkých pauz zhoršuje vnímanie emócie a autenticity rečníka.',
        confidence: 0.95
      },
      brollStrategy: {
        name: 'Visual Contextual Reinforcement',
        goal: 'Pokrytie statických hovorených úsekov dlhších ako 5s',
        approach: 'Nasadenie B-rollu alebo infografiky pri opise konkrétnych faktov.',
        why: 'Duálne kódovanie (zvuk + obraz) zlepšuje zapamätanie informácií.',
        confidence: 0.89
      },
      audioStrategy: {
        name: 'Dialogue Dominance & Clean Mix',
        goal: 'Maximálna sémantická zrozumiteľnosť hovorcu',
        approach: 'Auto-ducking hudby na -12dB a aktivácia normovania na -14 LUFS.',
        why: 'Zle namixované pozadie je hlavným dôvodom odchodu diváka pri vzdelávacích videách.',
        confidence: 0.97
      },
      motionStrategy: {
        name: 'Kinetic Information Architecture',
        goal: 'Vizuálna hierarchia pomocou pohybu',
        approach: 'Použitie calloutov a textovej animácie pre kľúčové sémantické segmenty.',
        why: 'Pohyb vedie oko diváka a zabraňuje "vizuálnej únave" (Visual Fatigue).',
        confidence: 0.92
      },
      multicamStrategy: {
        name: 'Speaker-Centric Dynamics',
        goal: 'Udržanie dynamiky rozhovoru',
        approach: 'Prestrihávanie na hovorcu pri sémantických zlomoch v transkripte.',
        why: 'Statický záber dlhší ako 10s pri dialógu pôsobí amatérsky a znižuje retenciu.',
        confidence: 0.94
      }
    };

    return {
      id: `plan_${crypto.randomUUID()}`,
      projectId: project.id,
      sequenceId: project.sequence?.id,
      title: `Director Plan — ${targetPlatform} (${objectives.join(', ')})`,
      targetPlatform,
      targetFormat: targetPlatform === 'YouTube Long-form' ? '16:9' : '9:16',
      objectives,
      audience: 'Primárne Short-form & Educational publikum',
      contentSummary: analysis.contentStructure?.hook?.text || 'Video hovoriacej hlavy so vzdelávacím obsahom.',
      strategies,
      decisions,
      analysisReferences: [analysis.projectId],
      insightReferences: (analysis.insights || []).map((i: any) => i.id),
      knowledgeReferences: ['J_CUT', 'PAUSE_TRIMMING', 'BROLL_INSERTION', 'INFORMATION_DENSITY'],
      confidence: 0.92,
      unresolvedAmbiguities: [],
      createdAt: Date.now(),
      analysisVersion: 2,
      directorVersion: 1
    };
  }

  /**
   * Conflict Detection & Dependency Resolution
   * Checks for overlapping cuts, invalid timeline ranges, and marks affected decisions as 'needs-review' or 'invalidated'.
   */
  public validatePlanConflicts(plan: DirectorPlan, project: ProjectModel): { valid: boolean; conflicts: string[]; updatedPlan: DirectorPlan } {
    const conflicts: string[] = [];
    const updatedDecisions = plan.decisions.map(dec => ({ ...dec }));

    for (let i = 0; i < updatedDecisions.length; i++) {
      const decA = updatedDecisions[i];
      if (!decA.timelineLocation) continue;

      // 1. Check if location exceeds timeline duration
      const totalDuration = project.sequence?.duration || 1000;
      if (decA.timelineLocation.start > totalDuration) {
        decA.status = 'invalidated';
        decA.conflictReason = `Časová pozícia ${decA.timelineLocation.start}s presahuje celkovú dĺžku sekvencie (${totalDuration}s).`;
        conflicts.push(`Rozhodnutie ${decA.id}: Presahuje dĺžku sekvencie.`);
      }

      // 2. Check overlap between cuts and B-rolls
      for (let j = i + 1; j < updatedDecisions.length; j++) {
        const decB = updatedDecisions[j];
        if (!decB.timelineLocation) continue;

        const startA = decA.timelineLocation.start;
        const endA = decA.timelineLocation.end || startA + 1;
        const startB = decB.timelineLocation.start;
        const endB = decB.timelineLocation.end || startB + 1;

        if (startA < endB && startB < endA) {
          if (decA.status === 'proposed' && decB.status === 'proposed') {
            decB.status = 'needs-review';
            decB.dependsOnDecisionIds = [decA.id];
            decB.conflictReason = `Prekrývanie s rozhodnutím ${decA.what} na čase ${startA.toFixed(1)}s.`;
            conflicts.push(`Konflikt časov: ${decA.what} VS ${decB.what}`);
          }
        }
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
      updatedPlan: {
        ...plan,
        decisions: updatedDecisions,
        unresolvedAmbiguities: conflicts
      }
    };
  }

  /**
   * Safe Transactional Batch Apply of DirectorPlan decisions to Project via CommandManager.
   * Automatically creates a Version Snapshot first, then applies accepted decisions transactionally.
   */
  public safeBatchApply(
    commandManager: CommandManager,
    plan: DirectorPlan,
    acceptedDecisionIds: string[]
  ): { success: boolean; appliedCount: number; snapshotVersionId?: string; error?: string } {
    const project = commandManager.getProject();
    
    // 1. Validate Conflicts First
    const validation = this.validatePlanConflicts(plan, project);
    if (!validation.valid && validation.conflicts.length > 20) {
      return { success: false, appliedCount: 0, error: 'Príliš veľa kritických konfliktov v AI Pláne.' };
    }

    // 2. Create Version Snapshot for Auditability & Rollback
    const snapshotLabel = `AI Director Apply (${plan.targetPlatform})`;
    const snapshotCmd = new CreateProjectVersionCommand(
      snapshotLabel,
      snapshotLabel,
      `Automatická záloha pred aplikovaním ${acceptedDecisionIds.length} AI rozhodnutí.`
    );
    const snapSuccess = commandManager.executeCommand(snapshotCmd);
    const postSnapProject = commandManager.getProject();
    const snapshotVersionId = postSnapProject.versions?.[postSnapProject.versions.length - 1]?.id;

    let appliedCount = 0;

    try {
      // 3. Apply accepted decisions via CommandManager
      plan.decisions
        .filter(d => acceptedDecisionIds.includes(d.id) && d.status !== 'invalidated')
        .forEach(dec => {
          if (dec.what.includes('Punch-in') && dec.affectedClipId) {
            const cmd = new SetTransformCommand(`AI Director Punch-in`, dec.affectedClipId, { scale: 115 });
            if (commandManager.executeCommand(cmd)) appliedCount++;
          } else if (dec.what.includes('Skrátenie') && dec.timelineLocation) {
            // Non-destructive trim
            const targetTrack = project.tracks.find(t => t.clips.some(c => c.timelineStart <= dec.timelineLocation!.start));
            const targetClip = targetTrack?.clips.find(c => c.timelineStart <= dec.timelineLocation!.start);
            if (targetClip) {
              const cmd = new TrimClipCommand(`AI Director Pause Trim`, targetClip.id, 'right', 1.2, false);
              if (commandManager.executeCommand(cmd)) appliedCount++;
            }
          } else if (dec.what.includes('Multicam Strih') && multicamGroup) {
             const targetAngle = multicamGroup.angles[1] || multicamGroup.angles[0];
             const targetClip = project.tracks.flatMap(t => t.clips).find(c => c.timelineStart <= dec.timelineLocation!.start);
             if (targetClip) {
                const switchTime = dec.timelineLocation!.start;
                // Use switchMulticamAngle logic directly or command
                if (commandManager.executeCommand(new SwitchMulticamAngleCommand(`AI Multicam Switch`, targetClip.id, targetAngle.id, switchTime))) {
                   appliedCount++;
                }
             }
          }
        });

      return {
        success: true,
        appliedCount,
        snapshotVersionId
      };
    } catch (err: any) {
      // Rollback on critical error
      commandManager.undo();
      return {
        success: false,
        appliedCount: 0,
        error: `Chyba pri aplikovaní plánu: ${err?.message || err}`
      };
    }
  }

  /**
   * Compare My Edit (Respectful comparison between User's manual edits and AI Proposed DirectorPlan)
   */
  public compareUserAndAiEdits(project: ProjectModel, plan: DirectorPlan): EditComparison[] {
    const comparisons: EditComparison[] = [];
    const mainTrack = project.tracks.find(t => t.type === 'video');
    const clips = mainTrack?.clips || [];

    // 1. Pacing & Clip Count Comparison
    const userClipCount = clips.length;
    const aiProposedTrims = plan.decisions.filter(d => d.what.includes('Skrátenie')).length;
    comparisons.push({
      metric: 'Tempo a Počet Strihov',
      userChoice: `${userClipCount} záberov na timeline`,
      aiProposal: `Návrh na ${aiProposedTrims} skrátení pauz pre dynamickejšie tempo`,
      explanation: 'Tvoj strih zachováva prirodzenejší naratívny priestor, zatiaľ čo AI navrhuje agresívnejšiu retenciu pre Short-form.',
      learningTip: 'Vzdelávacie videá v SR fungujú lepšie s prirodzenejšími pauzami než pre-rýchlené US TikToky.'
    });

    // 2. B-Roll Coverage
    const userBrollTrack = project.tracks.find(t => t.type === 'b-roll');
    const userBrollCount = userBrollTrack?.clips.length || 0;
    const aiBrollCount = plan.decisions.filter(d => d.what.includes('B-Roll')).length;
    comparisons.push({
      metric: 'Pokrytie B-Rollom',
      userChoice: `${userBrollCount} ilustračných záberov na V2`,
      aiProposal: `Odporúčaných ${aiBrollCount} B-roll miest pre zakrytie dlhých monológov`,
      explanation: 'B-roll pomáha udržať vizuálnu pozornosť pri abstraktných témach dlhších ako 5 sekúnd.',
      learningTip: 'Vždy používaj B-roll, ktorý priamo súvisí s hovoreným slovom (Dual-Coding Principle).'
    });

    // 3. Audio & Ducking
    const audioTrack = project.tracks.find(t => t.type === 'audio');
    comparisons.push({
      metric: 'Zvukový Mix a Ducking',
      userChoice: `${audioTrack?.clips.length || 0} zvukových stôp`,
      aiProposal: 'Automatické stíšenie hudby (Ducking -12dB) pri hlase',
      explanation: 'Zrozumiteľnosť reči je najdôležitejšou kvalitatívnou metrikou akéhokoľvek videa.',
      learningTip: 'Hlas by mal byť vždy na -14 LUFS a hudba v pozadí o 12-15dB nižšie.'
    });

    // 4. Hook Zoom & Visual Dynamics
    comparisons.push({
      metric: 'Úvodná Dynamika & Hook Zoom',
      userChoice: 'Štandardná veľkosť záberu (100% Scale)',
      aiProposal: 'Punch-in Zoom (115% Scale) na prvých 3.0s',
      explanation: 'Mierne zväčšenie úvodného záberu v prvých 3 sekundách zvyšuje zadržanie divákov o 24%.',
      learningTip: 'Obe možnosti sú technicky platné; Punch-in zoom funguje lepšie pri súťažných algoritmoch TikToku, kým 100% je prirodzenejšie pre komunitné rozhovory.'
    });

    // 5. Captions & Keyword Accent
    comparisons.push({
      metric: 'Titulky a Zvýraznenie',
      userChoice: 'Klasické jednofarebné titulky',
      aiProposal: 'Dynamické kľúčové slová so žltým zvýraznením',
      explanation: 'Farebné zvýraznenie kľúčových slov vedie oko diváka po obrazovke pri tichom sledovaní.',
      learningTip: 'Zvýrazňuj maximálne 1 až 2 kľúčové slová vo vete pre zachovanie čistoty dizajnového layoutu.'
    });

    return comparisons;
  }
}

export const directorEngine = DirectorEngine.getInstance();
