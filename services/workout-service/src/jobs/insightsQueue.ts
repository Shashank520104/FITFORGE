import { Job, Queue } from "bullmq";
import { Redis } from "ioredis";

export const workoutInsightsQueueName = "workout-insights";

export type WorkoutInsightsJobData = {
  ownerId: string;
  sessionId: string;
};

export type WorkoutInsightsJobState =
  "waiting" | "delayed" | "active" | "completed" | "failed" | "unknown";

export interface WorkoutInsightsJob {
  id: string;
  ownerId: string;
  getState(): Promise<WorkoutInsightsJobState>;
  getResult(): unknown;
  getFailure(): string | undefined;
}

export interface WorkoutInsightsQueue {
  enqueue(data: WorkoutInsightsJobData): Promise<string>;
  getJob(id: string): Promise<WorkoutInsightsJob | undefined>;
  close(): Promise<void>;
}

function jobState(value: string): WorkoutInsightsJobState {
  if (
    value === "waiting" ||
    value === "delayed" ||
    value === "active" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value;
  }
  return "unknown";
}

function createJobView(job: Job<WorkoutInsightsJobData>): WorkoutInsightsJob {
  return {
    id: job.id ?? "",
    ownerId: job.data.ownerId,
    async getState() {
      return jobState(await job.getState());
    },
    getResult() {
      return job.returnvalue;
    },
    getFailure() {
      return job.failedReason || undefined;
    },
  };
}

export class BullWorkoutInsightsQueue implements WorkoutInsightsQueue {
  private readonly queue: Queue<WorkoutInsightsJobData>;

  constructor(redis: Redis) {
    this.queue = new Queue<WorkoutInsightsJobData>(workoutInsightsQueueName, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 86_400, count: 1000 },
        removeOnFail: { age: 604_800, count: 5000 },
      },
    });
  }

  async enqueue(data: WorkoutInsightsJobData): Promise<string> {
    const job = await this.queue.add("refresh", data, {
      jobId: `insights-${data.sessionId}`,
    });
    if (!job.id) {
      throw new Error("BullMQ did not return a workout-insights job ID");
    }
    return job.id;
  }

  async getJob(id: string): Promise<WorkoutInsightsJob | undefined> {
    const job = await this.queue.getJob(id);
    return job ? createJobView(job) : undefined;
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
