/**
 * Local AI Architecture Types & Interfaces
 * Non-mandatory, lazy-loaded local AI contracts.
 */

export type ModelState = 'NOT_LOADED' | 'LOADING' | 'READY' | 'PROCESSING' | 'COMPLETE' | 'ERROR';

export interface ModelProgress {
  status: ModelState;
  progress: number; // 0 to 100
  message?: string;
  error?: string;
  modelName?: string;
}

export interface WordTimestamp {
  word: string;
  start: number; // Seconds
  end: number;   // Seconds
  confidence: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  words: WordTimestamp[];
  segments: {
    start: number;
    end: number;
    text: string;
  }[];
}

export interface SilentSegment {
  start: number; // Start time in seconds
  end: number;   // End time in seconds
  duration: number; // Duration in seconds
}

export interface VADResult {
  silentSegments: SilentSegment[];
  speechSegments: { start: number; end: number; duration: number }[];
  totalSilenceDuration: number;
}

export interface SceneBoundary {
  timestamp: number; // Time in seconds
  score: number;     // Scene change confidence (0-1)
  thumbnailUrl?: string;
}

export interface VisionResult {
  scenes: SceneBoundary[];
  faceDetected: boolean;
  averageBrightness: number;
  colorHistogram?: number[];
}

export interface TTSResult {
  audioBlob: Blob;
  audioUrl: string;
  duration: number;
}

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
}

export interface AIProvider<TInput, TOutput> {
  id: string;
  name: string;
  getStatus(): ModelProgress;
  subscribe(listener: (status: ModelProgress) => void): () => void;
  loadModel(): Promise<void>;
  unloadModel(): Promise<void>;
  cancel(): void;
  retry(): Promise<void>;
  process(input: TInput, forceRefresh?: boolean): Promise<TOutput>;
}
