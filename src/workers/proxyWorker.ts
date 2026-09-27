// src/workers/proxyWorker.ts

self.onmessage = async (e: MessageEvent) => {
  const { sourceUrl } = e.data;
  // Non-destructive passthrough without simulated delay or fake params
  self.postMessage({
    status: "completed",
    proxyUrl: sourceUrl
  });
};
