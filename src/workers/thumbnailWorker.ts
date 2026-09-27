// src/workers/thumbnailWorker.ts
import { Input, UrlSource, ALL_FORMATS, CanvasSink } from 'mediabunny';

self.onmessage = async (e: MessageEvent) => {
  const { videoUrl, timestamp = 0, width = 320, height = 180 } = e.data;
  try {
    const input = new Input({ source: new UrlSource(videoUrl), formats: ALL_FORMATS });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      input.dispose();
      self.postMessage({ status: "error", thumbnailData: "" });
      return;
    }

    const canvasSink = new CanvasSink(videoTrack, { width, height, fit: 'contain' });
    const wrapped = await canvasSink.getCanvas(timestamp);
    if (!wrapped || !wrapped.canvas) {
      input.dispose();
      self.postMessage({ status: "error", thumbnailData: "" });
      return;
    }

    const blob = await (wrapped.canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: 0.75 });
    const reader = new FileReader();
    reader.onloadend = () => {
      input.dispose();
      self.postMessage({
        status: "completed",
        timestamp,
        thumbnailData: reader.result
      });
    };
    reader.readAsDataURL(blob);
  } catch (err: any) {
    self.postMessage({
      status: "error",
      error: err?.message || 'Thumbnail extraction error',
      thumbnailData: ""
    });
  }
};
