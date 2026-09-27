/**
 * Text-Based Video Editor Engine
 * Detects word deletions in transcript and converts them into non-destructive Edit Plans.
 * Offers Review, Modify, Reject, and Apply options through Core Engine commands.
 */

import { WordItem } from './captionEngine';
import { ProjectModel } from '../../core/types/project';
import { coreEngine, SplitClipCommand, RemoveClipCommand } from '../../core';

export interface ProposedCut {
  id: string;
  deletedWordsText: string;
  startTime: number; // Seconds
  endTime: number;   // Seconds
  duration: number;  // Seconds
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
}

export interface EditPlan {
  id: string;
  createdAt: number;
  title: string;
  summary: string;
  proposedCuts: ProposedCut[];
  status: 'PROPOSED' | 'APPLIED' | 'REJECTED' | 'MODIFIED' | 'CANCELLED';
}

export class TextBasedEditor {
  /**
   * Scans word items for `isDeleted === true` and groups contiguous deleted words into ProposedCuts.
   */
  public generateEditPlanFromDeletedWords(
    words: WordItem[],
    planTitle: string = 'Text-Based Video Cut Plan'
  ): EditPlan {
    const proposedCuts: ProposedCut[] = [];
    let currentCutWords: WordItem[] = [];

    for (let i = 0; i < words.length; i++) {
      const w = words[i];

      if (w.isDeleted) {
        currentCutWords.push(w);
      } else {
        if (currentCutWords.length > 0) {
          const startTime = currentCutWords[0].start;
          const endTime = currentCutWords[currentCutWords.length - 1].end;
          const deletedWordsText = currentCutWords.map((cw) => cw.word).join(' ');

          proposedCuts.push({
            id: `cut_${crypto.randomUUID().slice(0, 6)}`,
            deletedWordsText,
            startTime: Number(startTime.toFixed(2)),
            endTime: Number(endTime.toFixed(2)),
            duration: Number((endTime - startTime).toFixed(2)),
            status: 'ACCEPTED'
          });

          currentCutWords = [];
        }
      }
    }

    // Trailing cut
    if (currentCutWords.length > 0) {
      const startTime = currentCutWords[0].start;
      const endTime = currentCutWords[currentCutWords.length - 1].end;
      const deletedWordsText = currentCutWords.map((cw) => cw.word).join(' ');

      proposedCuts.push({
        id: `cut_${crypto.randomUUID().slice(0, 6)}`,
        deletedWordsText,
        startTime: Number(startTime.toFixed(2)),
        endTime: Number(endTime.toFixed(2)),
        duration: Number((endTime - startTime).toFixed(2)),
        status: 'ACCEPTED'
      });
    }

    const totalDurationRemoved = proposedCuts.reduce((acc, c) => acc + c.duration, 0);

    return {
      id: `plan_${crypto.randomUUID()}`,
      createdAt: Date.now(),
      title: planTitle,
      summary: proposedCuts.length > 0
        ? `Nájdených ${proposedCuts.length} návrhov na vymazanie videa (spolu -${totalDurationRemoved.toFixed(1)}s)`
        : 'Žiadne vymazané slová. Video ostáva nezmenené.',
      proposedCuts,
      status: 'PROPOSED'
    };
  }

  /**
   * Non-destructively executes an accepted Edit Plan on the active project using Core Engine Commands.
   */
  public applyEditPlan(plan: EditPlan): boolean {
    if (plan.status === 'APPLIED' || plan.status === 'REJECTED' || plan.status === 'CANCELLED') {
      return false;
    }

    const acceptedCuts = plan.proposedCuts.filter((c) => c.status === 'ACCEPTED');
    if (acceptedCuts.length === 0) return false;

    // Sort cuts in reverse timeline order so splitting later times doesn't shift earlier times
    const sortedCuts = [...acceptedCuts].sort((a, b) => b.startTime - a.startTime);

    for (const cut of sortedCuts) {
      const project = coreEngine.getProject();
      
      // Find main video clips overlapping with cut.startTime and cut.endTime
      for (const track of project.tracks) {
        if (track.type !== 'video' && track.type !== 'audio') continue;

        for (const clip of track.clips) {
          const clipEnd = clip.start + clip.duration;

          if (cut.startTime > clip.start && cut.startTime < clipEnd) {
            // Split at start of cut
            coreEngine.commandManager.executeCommand(
              new SplitClipCommand(`Text-based cut split at ${cut.startTime}s`, clip.id, cut.startTime)
            );
          }

          const updatedProj = coreEngine.getProject();
          const freshTrack = updatedProj.tracks.find((t) => t.id === track.id);
          if (!freshTrack) continue;

          // Find newly created clip that corresponds to deleted speech range
          const clipToRemove = freshTrack.clips.find(
            (c) => c.start >= cut.startTime - 0.05 && c.start + c.duration <= cut.endTime + 0.1
          );

          if (clipToRemove) {
            coreEngine.commandManager.executeCommand(
              new RemoveClipCommand(`Remove speech video section [${cut.deletedWordsText}]`, clipToRemove.id)
            );
          }
        }
      }
    }

    plan.status = 'APPLIED';
    coreEngine.saveCurrentProject();
    return true;
  }

  /**
   * Modify time boundaries of a proposed cut in the Edit Plan.
   */
  public modifyCutRange(plan: EditPlan, cutId: string, newStart: number, newEnd: number): EditPlan {
    const updatedCuts = plan.proposedCuts.map((cut) => {
      if (cut.id === cutId) {
        return {
          ...cut,
          startTime: Math.max(0, newStart),
          endTime: Math.max(newStart + 0.1, newEnd),
          duration: Number((newEnd - newStart).toFixed(2))
        };
      }
      return cut;
    });

    return {
      ...plan,
      proposedCuts: updatedCuts,
      status: 'MODIFIED'
    };
  }

  /**
   * Toggle single cut acceptance status (Accept / Reject) in Edit Plan.
   */
  public toggleCutStatus(plan: EditPlan, cutId: string): EditPlan {
    const updatedCuts = plan.proposedCuts.map((cut) => {
      if (cut.id === cutId) {
        return {
          ...cut,
          status: (cut.status === 'ACCEPTED' ? 'REJECTED' : 'ACCEPTED') as 'ACCEPTED' | 'REJECTED'
        };
      }
      return cut;
    });

    return {
      ...plan,
      proposedCuts: updatedCuts
    };
  }
}

export const textBasedEditor = new TextBasedEditor();
