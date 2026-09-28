// src/utils/pipelineExecutor.ts
import { Pipeline, PipelineStepType } from "../types";
import { AIJobQueue } from "./performanceEngine";
import { AIOrchestrator } from "./aiRouter";

class PipelineExecutorClass {
  private pipelines: Map<string, Pipeline> = new Map();

  public registerPipeline(pipeline: Pipeline) {
    this.pipelines.set(pipeline.id, pipeline);
  }

  public async startPipeline(pipelineId: string) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) return;

    for (let i = pipeline.currentStepIndex; i < pipeline.steps.length; i++) {
      pipeline.currentStepIndex = i;
      const step = pipeline.steps[i];

      // Handle Human Review Pause
      if (step.type === "HUMAN_REVIEW") {
        step.status = "waiting_for_human";
        console.log(`[Autopilot] Pipeline paused for Human Review at step ${i}`);
        return; // Stop here until user manually triggers resume
      }

      step.status = "running";
      const routing = AIOrchestrator.routeTask(step.type);

      if (routing.isCached) {
        console.log(`[Autopilot] Step ${step.type} served from cache`);
        step.status = "completed";
      } else {
        try {
          await this.runStep(pipeline.projectId, step.type as any, step.priority);
          step.status = "completed";
          AIOrchestrator.updateQuota(routing.provider, 1);
        } catch (err: any) {
          // A step that cannot run must stop the pipeline with the real reason instead
          // of advancing as if the work had been done.
          step.status = "failed";
          console.error(`[Autopilot] Step ${step.type} failed:`, err?.message || err);
          return;
        }
      }
    }
  }

  public async resumePipeline(pipelineId: string) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline || pipeline.steps[pipeline.currentStepIndex].status !== "waiting_for_human") return;
    
    console.log(`[Autopilot] Resuming pipeline ${pipelineId}`);
    pipeline.steps[pipeline.currentStepIndex].status = "completed";
    pipeline.currentStepIndex++;
    this.startPipeline(pipelineId);
  }

  /**
   * Runs a single pipeline step.
   *
   * This used to enqueue a job with no executor and then poll the queue forever waiting
   * for a `completed` status that could only ever arrive from the old timer-based fake
   * progress. With the honest queue the job fails immediately, so the poll must resolve
   * on failure and time out instead of leaking an interval for the lifetime of the tab.
   */
  private async runStep(projectId: string, type: PipelineStepType, priority: string): Promise<void> {
    const routing = AIOrchestrator.routeTask(type);

    const jobId = AIJobQueue.addJob(projectId, type as any, priority as any);

    return new Promise<void>((resolve, reject) => {
      const POLL_INTERVAL_MS = 500;
      const TIMEOUT_MS = 120_000;
      const startedAt = Date.now();

      const interval = setInterval(() => {
        const job = AIJobQueue.getQueue().find(j => j.job_id === jobId);

        if (!job) {
          clearInterval(interval);
          reject(new Error(`Pipeline step ${type} disappeared from the job queue.`));
          return;
        }

        if (job.status === 'completed') {
          clearInterval(interval);
          AIOrchestrator.updateQuota(routing.provider, 1);
          resolve();
          return;
        }

        if (job.status === 'failed') {
          clearInterval(interval);
          reject(new Error(`Pipeline step ${type} failed: ${job.error || 'unknown error'}`));
          return;
        }

        if (Date.now() - startedAt > TIMEOUT_MS) {
          clearInterval(interval);
          reject(new Error(`Pipeline step ${type} timed out after ${TIMEOUT_MS / 1000}s.`));
        }
      }, POLL_INTERVAL_MS);
    });
  }
}

export const PipelineExecutor = new PipelineExecutorClass();
