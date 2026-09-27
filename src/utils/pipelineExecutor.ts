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
        await this.runStep(pipeline.projectId, step.type as any, step.priority);
        step.status = "completed";
        AIOrchestrator.updateQuota(routing.provider, 1);
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

  private async runStep(projectId: string, type: PipelineStepType, priority: string) {
    const routing = AIOrchestrator.routeTask(type);
    
    // In a real implementation, this maps steps to actual jobs in AIJobQueue
    AIJobQueue.addJob(projectId, type as any, priority as any);
    
    // Poll for completion
    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const queue = AIJobQueue.getQueue();
        const job = queue.find(j => j.project_id === projectId && j.type === (type as any) && j.status === 'completed');
        if (job) {
          clearInterval(interval);
          // Assuming successful completion updates quota
          AIOrchestrator.updateQuota(routing.provider, 1);
          resolve();
        }
      }, 1000);
    });
  }
}

export const PipelineExecutor = new PipelineExecutorClass();
