/**
 * Media Engine Types & Worker Messaging
 */

export type MediaWorkerMessageType = 
  | 'INIT'
  | 'PING'
  | 'INIT_DECODER'
  | 'GET_FRAME_AT'
  | 'DECODE_FRAME'
  | 'GENERATE_THUMBNAIL'
  | 'GENERATE_WAVEFORM'
  | 'GET_METADATA'
  | 'CANCEL_JOB'
  | 'DISPOSE';

export interface MediaWorkerRequest {
  jobId: string;
  type: MediaWorkerMessageType;
  payload: any;
}

export interface MediaWorkerResponse {
  jobId: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  progress?: number;
  result?: any;
  error?: string;
}

export interface MetadataPayload {
  file: File | string; // File object or URL
}

export interface DecodeFramePayload {
  file: File | string;
  timestamp: number;
  quality?: 'low' | 'medium' | 'high';
}

export interface ThumbnailPayload {
  file: File | string;
  timestamp: number;
  width?: number;
  height?: number;
}

export interface WaveformPayload {
  file: File | string;
  samplesCount?: number;
}

export interface MediaMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  hasVideo: boolean;
  sampleRate?: number;
  channels?: number;
}
