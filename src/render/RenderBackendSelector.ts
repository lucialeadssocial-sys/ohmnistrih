import { RenderPlan } from "../types/renderEngine";
import { detectRenderCapabilities } from "./renderCapabilities";
import { RenderBackend } from "./RenderBackend";
import { WebCodecsOfflineBackend } from "./WebCodecsOfflineBackend";
import { RealtimeCanvasBackend } from "./RealtimeCanvasBackend";

export class RenderBackendSelector {
  static async selectBackend(plan: RenderPlan): Promise<RenderBackend> {
    const caps = await detectRenderCapabilities();

    const offlineBackend = new WebCodecsOfflineBackend();
    if (await offlineBackend.canRender(plan)) {
      return offlineBackend;
    }

    return new RealtimeCanvasBackend();
  }
}

