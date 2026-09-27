import { RenderPlan, QCGateResult } from "../types/renderEngine";
import { RenderProgressInfo, RenderArtifact } from "./renderCapabilities";

export interface RenderBackend {
  id: string;
  name: string;
  isOffline: boolean;

  canRender(plan: RenderPlan): Promise<boolean>;

  prepare(plan: RenderPlan, onProgress: (info: RenderProgressInfo) => void): Promise<void>;

  render(
    plan: RenderPlan,
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    onProgress: (info: RenderProgressInfo) => void
  ): Promise<RenderArtifact>;

  cancel(): Promise<void>;
}
