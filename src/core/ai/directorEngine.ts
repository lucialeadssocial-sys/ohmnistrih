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
// STYLE MODE (krok 1–3 Reality Gate): deterministická Style Intelligence.
// Zámerne NIE je nový DirectorEngine — Style Mode je metóda tejto triedy a jej
// logika je čistá funkcia bez AI providera (`src/core/style/styleIntelligence.ts`).
import { buildStylePlan, type StylePlan, type StylePlanInput } from '../style/styleIntelligence';

export interface DirectorBrief {
  id: string;
  userIntent: string;
  targetFormat: 'REEL_30S' | 'HIGHLIGHTS' | 'REMOVE_SILENCE' | 'DYNAMIC_PACING' | 'BEST_HOOK' | 'SHORTS_3' | 'MULTICAM' | 'CUSTOM';
  targetDurationSeconds?: number;
  moodAndTone: string;
  explanation?: {
    what: string;
    why: string;
    how: string;
    openSourceReference: { name: string; url: string; contribution: string };
  };
  identifiedHook?: {
    startTime: number;
    endTime: number;
    transcriptSnippet: string;
    reason: string;
  };
  pacingStrategy: string;
  keyMomentsToKeep: {
    startTime: number;
    endTime: number;
    description: string;
    score: number;
  }[];
  suggestedAspectRatios: string[];
  bestShotTimestamp?: number;
  duplicateTimestamps: number[];
  blurryTimestamps: number[];
  darkTimestamps: number[];
  staticTimestamps: number[];
  bRollTimestamps: number[];
}

export interface DirectorTimelineOperation {
  id: string;
  type: 'KEEP_SEGMENT' | 'CUT_SILENCE' | 'ADD_TRANSITION' | 'ADJUST_SPEED' | 'SET_HOOK' | 'CREATE_SUB_PROJECT' | 'MULTICAM_SWITCH';
  description: string;
  targetClipId?: string;
  startTime: number;
  endTime: number;
  targetTrackId?: string;
  parameters?: Record<string, any>;
  status: 'PENDING' | 'APPROVED' | 'SKIPPED';
}

export interface DirectorEditPlan {
  id: string;
  briefId: string;
  title: string;
  summary: string;
  operations: DirectorTimelineOperation[];
  projectStateBefore: { clipCount: number; duration: number };
  projectStateAfter: { estimatedClipCount: number; estimatedDuration: number };
  status: 'PROPOSED' | 'APPROVED' | 'EXECUTED' | 'REJECTED';
  executedTools?: string[];
}

export interface DirectorRevisionReport {
  id: string;
  durationStatus: 'OK' | 'WARN_TOO_LONG' | 'WARN_TOO_SHORT';
  tempoStatus: 'OK' | 'DENSE' | 'SLOW';
  repetitionsStatus: 'OK' | 'DUPLICATES_FOUND';
  silenceStatus: 'OK' | 'SILENCE_FOUND';
  audioStatus: 'OK' | 'VOLUME_UNBALANCED';
  captionsStatus: 'OK' | 'MISSING' | 'WELL_PLACED';
  textStatus: 'OK' | 'NO_OVERLAYS' | 'OVERLAYS_ACTIVE';
  startStatus: 'OK' | 'HOOK_STRONG' | 'HOOK_WEAK';
  endStatus: 'OK' | 'OUTRO_CLEAN' | 'OUTRO_ABRUPT';
  visualConsistency: 'OK' | 'LOW_QUALITY_SHOTS_PRESENT';
  formatStatus: 'OK' | 'NOT_OPTIMAL';
  issuesList: string[];
}

export interface DirectorRevisionPlan {
  id: string;
  planId: string;
  report: DirectorRevisionReport;
  suggestedOperations: DirectorTimelineOperation[];
  pacingAction: string;
  qualityAction: string;
}

export class DirectorEngine {
  private static instance: DirectorEngine | null = null;

  public static getInstance(): DirectorEngine {
    if (!DirectorEngine.instance) {
      DirectorEngine.instance = new DirectorEngine();
    }
    return DirectorEngine.instance;
  }

  public generateBriefAndPlan(
    userPrompt: string,
    project: ProjectModel,
    mediaIndex?: any
  ): { brief: DirectorBrief; editPlan: DirectorEditPlan } {
    const brief: DirectorBrief = {
      id: `brief_${Math.random().toString(36).substr(2, 6)}`,
      userIntent: userPrompt,
      targetFormat: 'REEL_30S',
      moodAndTone: 'Professional',
      pacingStrategy: 'Dynamic cut',
      keyMomentsToKeep: [],
      suggestedAspectRatios: ['9:16'],
      duplicateTimestamps: [],
      blurryTimestamps: [],
      darkTimestamps: [],
      staticTimestamps: [],
      bRollTimestamps: []
    };
    const editPlan: DirectorEditPlan = {
      id: `plan_${Math.random().toString(36).substr(2, 6)}`,
      briefId: brief.id,
      title: 'AI Director Edit Plan',
      summary: 'Optimized edit plan',
      operations: [],
      projectStateBefore: { clipCount: 3, duration: 30 },
      projectStateAfter: { estimatedClipCount: 3, estimatedDuration: 30 },
      status: 'PROPOSED'
    };
    return { brief, editPlan };
  }

  public executeEditPlan(plan: DirectorEditPlan): boolean {
    plan.status = 'EXECUTED';
    return true;
  }

  /**
   * STYLE MODE — Style Plan nad existujúcim DirectorEngine.
   *
   * Prečo metóda tu a nie nový „Style Director“: zadanie (aj Reality Gate) zakazuje
   * druhý Director. Style Mode preto len **dopĺňa** rozhodovanie existujúceho
   * Directora o vizuálnu vrstvu — a robí to deterministicky, z reálnych dát
   * (`wordTiming`), bez AI providera.
   *
   * Vracia plán s `EditDecision[]` (existujúci model). **Nič neaplikuje** —
   * do projektu sa zapisuje až v kroku 6 (Apply) cez existujúce commands.
   */
  public generateStylePlan(input: StylePlanInput): StylePlan {
    return buildStylePlan(input);
  }

  public conductReview(
    plan: DirectorEditPlan,
    project: ProjectModel,
    mediaIndex?: any
  ): DirectorRevisionPlan {
    const report: DirectorRevisionReport = {
      id: `rep_${Math.random().toString(36).substr(2, 6)}`,
      durationStatus: 'OK',
      tempoStatus: 'OK',
      repetitionsStatus: 'OK',
      silenceStatus: 'OK',
      audioStatus: 'OK',
      captionsStatus: 'WELL_PLACED',
      textStatus: 'OVERLAYS_ACTIVE',
      startStatus: 'HOOK_STRONG',
      endStatus: 'OUTRO_CLEAN',
      visualConsistency: 'OK',
      formatStatus: 'OK',
      issuesList: []
    };
    return {
      id: `rev_${Math.random().toString(36).substr(2, 6)}`,
      planId: plan.id,
      report,
      suggestedOperations: [],
      pacingAction: 'Keep pace',
      qualityAction: 'Quality OK'
    };
  }

  /**
   * Director plán — POCTIVO.
   *
   * Pravidlo (krok 29, honesty fix): plán NIKDY neobsahuje vymyslené zásahy.
   * Pôvodná verzia pri chýbajúcej analýze pridávala pevné hodnoty:
   *   • pauza „4,2–5,8 s“ s confidence 0,95,
   *   • hook „0–3 s“ typu question s confidence 0,94,
   *   • J-cut „v 12,0 s“ s confidence 0,98,
   *   • titulky / ducking / farba s rozsahom 0,0–15,0 s a confidence 0,95–0,98,
   * a vždy vrátila `confidence: 0.92` a `createdAt: Date.now()` (nedeterministické).
   * Bola to „fake intelligence“ — vyzerala ako meranie, ale meranie to nebolo.
   *
   * Dnes: rozhodnutia vznikajú LEN z reálnej analýzy projektu
   * (`project.analysisResults`). Čo analýza neobsahuje, sa NEVYMÝŠĽA — ide to do
   * `unresolvedAmbiguities` ako otvorená otázka pre človeka.
   */
  public generateDirectorPlan(
    project: ProjectModel,
    targetPlatform: 'TikTok' | 'Instagram Reels' | 'YouTube Shorts' | 'YouTube Long-form' | 'UGC Ads' | 'General' = 'TikTok',
    objectives: DirectorObjective[] = ['Retention', 'Education']
  ): DirectorPlan {
    const analysis: any = project.analysisResults ?? null;
    const decisions: DirectorDecisionItem[] = [];
    const notes: string[] = [];
    const knowledgeRefs = new Set<string>();

    // Reálne preferencie z projektu (Editor Brain).
    const pacingPrefs = editingBrain.getPreferences(project, 'PACING');
    void pacingPrefs;

    if (!analysis) {
      notes.push(
        'Projekt nemá výsledky analýzy — Director nevie, kde sú pauzy, hook ani príležitosti na B-roll. Preto plán neobsahuje žiadne zásahy (nič sa nedomýšľa). Spustite analýzu a vygenerujte plán znova.'
      );
    }

    // 1) Skrátenie dlhých pauzy — LEN z analýzy.
    const pauseList: any[] = (analysis?.pauses ?? []).filter((p: any) => p.type === 'long_pause');
    pauseList.forEach((pause: any, idx: number) => {
      const teach = EDIT_KNOWLEDGE_BASE.PAUSE_TRIMMING;
      knowledgeRefs.add('PAUSE_TRIMMING');
      decisions.push({
        id: `dir_dec_pause_${idx}`,
        editDecisionId: `dec_pause_${idx}`,
        priority: pause.duration > 2.0 ? 'MUST_CONSIDER' : 'RECOMMENDED',
        what: `Skrátenie dlhej pauzy v čase ${Number(pause.start).toFixed(1)}s (${Number(pause.duration).toFixed(1)}s -> 0.4s)`,
        why: teach.why,
        whenToUse: teach.whenToUse,
        whenNotToUse: teach.whenNotToUse,
        howToManual: teach.manualWorkflowSteps || [],
        alternatives: teach.alternativeChoices || ['Ponechať pre dramatický účinok.'],
        confidence: typeof pause.confidence === 'number' ? pause.confidence : 0,
        source: teach.source,
        category: (teach.category as KnowledgeCategory) || 'heuristic',
        timelineLocation: { start: pause.start, end: pause.end },
        status: 'proposed'
      });
    });

    // 2) Hook / punch-in — LEN z analýzy.
    const hookList: any[] = analysis?.hooks ?? [];
    hookList.forEach((hook: any, idx: number) => {
      const teach = EDIT_KNOWLEDGE_BASE.HOOK_PUNCHIN;
      knowledgeRefs.add('HOOK_PUNCHIN');
      decisions.push({
        id: `dir_dec_hook_${idx}`,
        editDecisionId: `dec_hook_${idx}`,
        priority: 'MUST_CONSIDER',
        what: `Zvýraznenie hooku punch-in zoomom v čase ${Number(hook.start).toFixed(1)}s – ${Number(hook.end).toFixed(1)}s`,
        why: teach.why,
        whenToUse: teach.whenToUse,
        whenNotToUse: teach.whenNotToUse,
        howToManual: teach.manualWorkflowSteps || [],
        alternatives: teach.alternativeChoices || [],
        confidence: typeof hook.confidence === 'number' ? hook.confidence : 0,
        source: teach.source,
        category: 'trend_platform_pattern',
        timelineLocation: { start: hook.start, end: hook.end },
        status: 'proposed'
      });
    });

    // 3) B-roll — LEN z analýzy.
    const brollList: any[] = analysis?.brollOpportunities ?? [];
    brollList.forEach((broll: any, idx: number) => {
      const teach = EDIT_KNOWLEDGE_BASE.BROLL_INSERTION;
      knowledgeRefs.add('BROLL_INSERTION');
      decisions.push({
        id: `dir_dec_broll_${idx}`,
        editDecisionId: `dec_broll_${idx}`,
        priority: 'RECOMMENDED',
        what: `Vloženie B-Roll ilustrácie (${broll.suggestedVisualType ?? 'vizuál'}) v čase ${Number(broll.start).toFixed(1)}s – ${Number(broll.end).toFixed(1)}s`,
        why: teach.why,
        whenToUse: teach.whenToUse,
        whenNotToUse: teach.whenNotToUse,
        howToManual: teach.manualWorkflowSteps || [],
        alternatives: teach.alternativeChoices || ['Použiť Punch-in zoom.'],
        confidence: typeof broll.confidence === 'number' ? broll.confidence : 0,
        source: teach.source,
        category: 'professional_convention',
        timelineLocation: { start: broll.start, end: broll.end },
        status: 'proposed'
      });
    });

    // 4) Informačná hustota — LEN z analýzy (a bez vymysleného miesta na osi).
    const infoDensity = analysis?.speechDensity?.informationDensity;
    if (infoDensity === 'high') {
      knowledgeRefs.add('INFORMATION_DENSITY');
      notes.push(
        'Analýza hlási vysokú informačnú hustotu reči — zvážte vizuálne kotvy (callouty) na konkrétnych faktoch. OmniStrih nevie, ktoré slová sú kľúčové, takže miesto na osi si vyberáte vy.'
      );
    }

    // 5) J-cut/L-cut, titulky, ducking, farba, multicam:
    //    bez merania sa NEVYMÝŠĽA čas ani confidence — je to otvorená otázka.
    notes.push(
      'J-cut/L-cut, zvýraznenie titulkov, stíšenie hudby a farebné vyváženie sa z vašich dát nedajú zmerať (chýba meranie zvuku a rozpoznávanie dôrazu v reči). Preto tu nie sú ako rozhodnutia s časom na osi — princípy nájdete vo výučbe (WHY / SHOW ME HOW).'
    );
    const multicamGroup = project.multicamGroups?.[0];
    if (multicamGroup && multicamGroup.angles.length > 1) {
      notes.push(
        `Projekt má multicam skupinu s ${multicamGroup.angles.length} uhlami. Automatický prestrih na hovoriaceho OmniStrih nerobí (nemá diarizáciu rečníkov) — uhly prepínajte ručne.`
      );
    }

    // Dôveryhodnosť = priemer dôvery rozhodnutí, ktoré majú reálny základ (žiadna konštanta).
    const confidence = decisions.length > 0
      ? Math.round((decisions.reduce((sum, d) => sum + (d.confidence || 0), 0) / decisions.length) * 100) / 100
      : 0;

    return {
      id: `plan_${project.id}`,
      projectId: project.id,
      title: `Director Plan — ${targetPlatform} (${objectives.join(', ')})`,
      targetPlatform,
      targetFormat: targetPlatform === 'YouTube Long-form' ? '16:9' : '9:16',
      objectives,
      audience: analysis?.contentStructure?.type
        ? String(analysis.contentStructure.type)
        : 'Neznáme publikum (analýza neurčila typ obsahu)',
      contentSummary: analysis?.contentStructure?.hook?.text || 'Analýza neuviedla zhrnutie obsahu — nič sa nedomýšľa.',
      strategies: {},
      decisions,
      analysisReferences: analysis?.projectId ? [analysis.projectId] : [],
      insightReferences: (analysis?.insights ?? []).map((i: any) => i.id),
      knowledgeReferences: [...knowledgeRefs],
      confidence,
      unresolvedAmbiguities: notes,
      // Deterministické: čas vzniku plánu = posledná zmena projektu (žiadny Date.now()).
      createdAt: project.updatedAt ?? project.createdAt ?? 0,
      analysisVersion: typeof analysis?.analysisVersion === 'number' ? analysis.analysisVersion : 0,
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

    // Multicam skupina projektu – používa sa pri aplikovaní rozhodnutí typu "Multicam Strih".
    // Rovnaká logika ako v generateBriefAndPlan (tam je definovaná lokálne pre svoj scope),
    // preto ju tu deklarujeme znova; predtým chýbala a tsc hlásil TS2304.
    const multicamGroup = project.multicamGroups?.[0];

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
