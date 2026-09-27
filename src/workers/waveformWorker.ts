// src/workers/waveformWorker.ts
import { Input, UrlSource, ALL_FORMATS, AudioBufferSink } from 'mediabunny';

self.onmessage = async (e: MessageEvent) => {
  const { videoUrl, samplesCount = 100 } = e.data;
  try {
    const input = new Input({ source: new UrlSource(videoUrl), formats: ALL_FORMATS });
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!audioTrack) {
      input.dispose();
      self.postMessage({ status: "completed", waveformData: new Array(samplesCount).fill(0) });
      return;
    }

    let duration = await input.getDurationFromMetadata();
    if (duration === null || duration <= 0) {
      duration = await input.computeDuration();
    }

    const peaks = new Array(samplesCount).fill(0);
    const audioSink = new AudioBufferSink(audioTrack);

    for await (const wrapped of audioSink.buffers()) {
      const channelData = wrapped.buffer.getChannelData(0);
      const bufferTimestamp = wrapped.timestamp;
      const step = Math.max(1, Math.floor(channelData.length / 32));

      for (let i = 0; i < channelData.length; i += step) {
        const sampleTime = bufferTimestamp + (i / wrapped.buffer.sampleRate);
        const peakIdx = Math.min(samplesCount - 1, Math.floor((sampleTime / (duration || 1)) * samplesCount));
        if (peakIdx >= 0 && peakIdx < samplesCount) {
          const scaled = Math.abs(channelData[i]);
          if (scaled > peaks[peakIdx]) {
            peaks[peakIdx] = scaled;
          }
        }
      }
    }

    input.dispose();
    self.postMessage({
      status: "completed",
      waveformData: peaks
    });
  } catch (err: any) {
    self.postMessage({
      status: "error",
      error: err?.message || 'Waveform extraction error',
      waveformData: new Array(samplesCount).fill(0)
    });
  }
};
