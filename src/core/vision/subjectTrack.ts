/**
 * Subject track — where the subject (speaker) really is in the frame.
 *
 * The only source of a sample is a real browser face detector (Shape Detection API). This module
 * never guesses a position: when the detector is not available it returns an empty track and the
 * caller has to say so. That is the difference between "face-safe reframe" and a made-up box.
 *
 * Samples are stored in TIMELINE seconds (the time in the edit), while x/y are in pixels of the
 * analysed source frame. `subjectInMedia()` converts them to the dimensions of the media element
 * that is actually being drawn.
 */

export interface SubjectSample {
  /** Timeline time (seconds) this sample was measured at. */
  time: number;
  /** Subject centre in source-frame pixels. */
  x: number;
  y: number;
  /** Detected box size in source-frame pixels (0 when the detector gave no box). */
  width: number;
  height: number;
  confidence: number;
  /** Dimensions of the frame the sample was measured on (needed for scaling). */
  frameWidth: number;
  frameHeight: number;
  /** Which detector produced the sample — never a guess. */
  source: 'FACE_DETECTOR';
}

export interface SubjectPoint {
  x: number;
  y: number;
  confidence: number;
  /** How many measured samples the point stands on. */
  sampleCount: number;
}

/** Two samples further apart than this are not the same moment. */
export const SUBJECT_TOLERANCE_SECONDS = 1.2;

interface FaceDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ boundingBox: { x: number; y: number; width: number; height: number } }>>;
}
interface FaceDetectorCtor {
  new (options?: { fastMode?: boolean; maxDetectedFaces?: number }): FaceDetectorLike;
}

/** Real feature detection — no assumption that the API exists. */
export function faceDetectionAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as { FaceDetector?: unknown }).FaceDetector === 'function';
}

function getFaceDetectorCtor(): FaceDetectorCtor | null {
  if (!faceDetectionAvailable()) return null;
  return (window as unknown as { FaceDetector: FaceDetectorCtor }).FaceDetector;
}

/** Nearest measured sample around `time`, or null when nothing was measured there. */
export function subjectAt(samples: SubjectSample[], time: number, tolerance = SUBJECT_TOLERANCE_SECONDS): SubjectSample | null {
  let best: SubjectSample | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const distance = Math.abs(sample.time - time);
    if (distance <= tolerance && distance < bestDistance) {
      best = sample;
      bestDistance = distance;
    }
  }
  return best;
}

/** Average of every sample inside a range (confidence-weighted), or null when the range has none. */
export function subjectWithin(samples: SubjectSample[], start: number, end: number): SubjectPoint | null {
  const inside = samples.filter(sample => sample.time >= start && sample.time <= end);
  if (inside.length === 0) return null;
  const weight = inside.reduce((sum, sample) => sum + Math.max(0.0001, sample.confidence), 0);
  return {
    x: inside.reduce((sum, sample) => sum + sample.x * Math.max(0.0001, sample.confidence), 0) / weight,
    y: inside.reduce((sum, sample) => sum + sample.y * Math.max(0.0001, sample.confidence), 0) / weight,
    confidence: inside.reduce((sum, sample) => sum + sample.confidence, 0) / inside.length,
    sampleCount: inside.length,
  };
}

/**
 * Converts a sample into the pixel space of the media element that is being drawn.
 * Identity when the detector ran on the same frame size; scales otherwise (e.g. proxy frames).
 */
export function subjectInMedia(
  sample: SubjectSample,
  mediaWidth: number,
  mediaHeight: number
): { x: number; y: number } | null {
  if (!(sample.frameWidth > 0) || !(sample.frameHeight > 0) || !(mediaWidth > 0) || !(mediaHeight > 0)) return null;
  return {
    x: sample.x * (mediaWidth / sample.frameWidth),
    y: sample.y * (mediaHeight / sample.frameHeight),
  };
}

/**
 * Runs the real detector over sampled timeline times.
 *
 * Returns only what was actually measured. When the API is missing, the video has no dimensions or
 * a seek/detect call fails, the samples measured so far are returned (possibly an empty array) —
 * nothing is invented and no error is swallowed into a fake success.
 */
export async function detectFacesInVideo(
  video: HTMLVideoElement,
  timelineTimes: number[],
  options: { timelineToSource?: (time: number) => number; maxDetectedFaces?: number } = {}
): Promise<SubjectSample[]> {
  const Detector = getFaceDetectorCtor();
  if (!Detector) return [];
  if (!video || !(video.videoWidth > 0) || !(video.videoHeight > 0)) return [];

  const detector = new Detector({ fastMode: true, maxDetectedFaces: options.maxDetectedFaces ?? 1 });
  const samples: SubjectSample[] = [];

  for (const timelineTime of timelineTimes) {
    const sourceTime = options.timelineToSource ? options.timelineToSource(timelineTime) : timelineTime;
    try {
      await seekVideo(video, sourceTime);
      const faces = await detector.detect(video);
      if (faces.length === 0) continue;
      const best = faces
        .slice()
        .sort((a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height)[0];
      samples.push({
        time: timelineTime,
        x: best.boundingBox.x + best.boundingBox.width / 2,
        y: best.boundingBox.y + best.boundingBox.height / 2,
        width: best.boundingBox.width,
        height: best.boundingBox.height,
        confidence: 1,
        frameWidth: video.videoWidth,
        frameHeight: video.videoHeight,
        source: 'FACE_DETECTOR',
      });
    } catch {
      // A failed seek/detect ends the scan; the caller sees exactly what was measured.
      break;
    }
  }

  return samples;
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', done);
      video.removeEventListener('error', done);
      resolve();
    };
    video.addEventListener('seeked', done);
    video.addEventListener('error', done);
    video.currentTime = time;
    setTimeout(done, 400);
  });
}
