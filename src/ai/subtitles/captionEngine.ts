/**
 * Local Caption & Subtitle Engine
 * Pipeline: VIDEO/AUDIO -> STT (Whisper) -> WORD TIMESTAMPS -> TRANSCRIPT -> CAPTION SEGMENTS
 * Manages segment splitting, merging, word edits, timing, position, and animation options.
 */

import { localSpeechProvider } from '../providers/LocalSpeechProvider';
import { WordTimestamp } from '../types/ai';

export interface CaptionStyleOptions {
  fontFamily: string;
  fontSize: number;       // in px
  color: string;          // hex/rgba
  backgroundColor: string; // hex/rgba or transparent
  strokeColor?: string;
  strokeWidth?: number;
  position: 'bottom' | 'middle' | 'top';
  animation: 'NONE' | 'POP_IN' | 'FADE' | 'WORD_HIGHLIGHT';
  alignment: 'center' | 'left' | 'right';
  maxWordsPerSegment: number; // default 4-6 words per caption card
}

export interface WordItem {
  id: string;
  word: string;
  start: number; // seconds
  end: number;   // seconds
  confidence: number;
  isDeleted?: boolean; // marked for text-based editing
}

export interface CaptionSegment {
  id: string;
  words: WordItem[];
  text: string;
  start: number; // seconds
  end: number;   // seconds
  style: CaptionStyleOptions;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyleOptions = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 36,
  color: '#FFFFFF',
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
  strokeColor: '#000000',
  strokeWidth: 2,
  position: 'bottom',
  animation: 'POP_IN',
  alignment: 'center',
  maxWordsPerSegment: 5
};

export class CaptionEngine {
  /**
   * Runs the STT pipeline and converts raw word timestamps into structured caption segments.
   */
  public async generateCaptions(
    mediaBlob: Blob | File,
    style: Partial<CaptionStyleOptions> = {}
  ): Promise<{
    transcript: string;
    words: WordItem[];
    segments: CaptionSegment[];
  }> {
    const activeStyle: CaptionStyleOptions = { ...DEFAULT_CAPTION_STYLE, ...style };

    // 1. Run STT (Whisper ONNX)
    const sttResult = await localSpeechProvider.process(mediaBlob);

    // 2. Format WordItems
    const words: WordItem[] = sttResult.words.map((w, idx) => ({
      id: `w_${idx}_${crypto.randomUUID().slice(0, 5)}`,
      word: w.word,
      start: w.start,
      end: w.end,
      confidence: w.confidence || 0.95,
      isDeleted: false
    }));

    // 3. Chunk words into CaptionSegments
    const segments = this.chunkWordsIntoSegments(words, activeStyle);

    return {
      transcript: sttResult.text,
      words,
      segments
    };
  }

  /**
   * Group words into caption cards based on maxWordsPerSegment and silence gaps.
   */
  public chunkWordsIntoSegments(
    words: WordItem[],
    style: CaptionStyleOptions
  ): CaptionSegment[] {
    const activeWords = words.filter((w) => !w.isDeleted);
    if (activeWords.length === 0) return [];

    const segments: CaptionSegment[] = [];
    let currentChunk: WordItem[] = [];

    for (let i = 0; i < activeWords.length; i++) {
      const currentWord = activeWords[i];
      currentChunk.push(currentWord);

      const isLastWord = i === activeWords.length - 1;
      const nextWord = activeWords[i + 1];

      // Check gap to next word (> 0.8s creates a new caption card)
      const hasGap = nextWord ? nextWord.start - currentWord.end > 0.8 : false;
      const reachedMaxWords = currentChunk.length >= style.maxWordsPerSegment;

      if (isLastWord || hasGap || reachedMaxWords) {
        const segStart = currentChunk[0].start;
        const segEnd = currentChunk[currentChunk.length - 1].end;
        const segText = currentChunk.map((w) => w.word).join(' ');

        segments.push({
          id: `seg_${crypto.randomUUID()}`,
          words: [...currentChunk],
          text: segText,
          start: Number(segStart.toFixed(2)),
          end: Number(segEnd.toFixed(2)),
          style: { ...style }
        });

        currentChunk = [];
      }
    }

    return segments;
  }

  /**
   * Split a caption segment at a specific word index.
   */
  public splitSegment(
    segments: CaptionSegment[],
    segmentId: string,
    atWordIndex: number
  ): CaptionSegment[] {
    const targetIdx = segments.findIndex((s) => s.id === segmentId);
    if (targetIdx === -1) return segments;

    const target = segments[targetIdx];
    if (atWordIndex <= 0 || atWordIndex >= target.words.length) return segments;

    const leftWords = target.words.slice(0, atWordIndex);
    const rightWords = target.words.slice(atWordIndex);

    const leftSeg: CaptionSegment = {
      id: `seg_${crypto.randomUUID()}`,
      words: leftWords,
      text: leftWords.map((w) => w.word).join(' '),
      start: leftWords[0].start,
      end: leftWords[leftWords.length - 1].end,
      style: { ...target.style }
    };

    const rightSeg: CaptionSegment = {
      id: `seg_${crypto.randomUUID()}`,
      words: rightWords,
      text: rightWords.map((w) => w.word).join(' '),
      start: rightWords[0].start,
      end: rightWords[rightWords.length - 1].end,
      style: { ...target.style }
    };

    const newSegments = [...segments];
    newSegments.splice(targetIdx, 1, leftSeg, rightSeg);
    return newSegments;
  }

  /**
   * Merge two adjacent caption segments.
   */
  public mergeSegments(
    segments: CaptionSegment[],
    segId1: string,
    segId2: string
  ): CaptionSegment[] {
    const idx1 = segments.findIndex((s) => s.id === segId1);
    const idx2 = segments.findIndex((s) => s.id === segId2);

    if (idx1 === -1 || idx2 === -1 || Math.abs(idx1 - idx2) !== 1) return segments;

    const first = segments[Math.min(idx1, idx2)];
    const second = segments[Math.max(idx1, idx2)];

    const mergedWords = [...first.words, ...second.words];
    const mergedSeg: CaptionSegment = {
      id: `seg_${crypto.randomUUID()}`,
      words: mergedWords,
      text: mergedWords.map((w) => w.word).join(' '),
      start: first.start,
      end: second.end,
      style: { ...first.style }
    };

    const minIdx = Math.min(idx1, idx2);
    const newSegments = [...segments];
    newSegments.splice(minIdx, 2, mergedSeg);
    return newSegments;
  }
}

export const captionEngine = new CaptionEngine();
