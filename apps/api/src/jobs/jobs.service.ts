import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private hasJobRunModel: boolean | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async queue(userId: string, kind: string, details?: any) {
    if (!this.hasJobRunModelCached()) {
      this.logger.warn(`jobRun model missing on Prisma client; skipping persisted queue for ${kind}`);
      return {
        id: `noop-${Date.now()}`,
        userId,
        kind,
        status: "queued",
        details,
        startedAt: new Date(),
      } as any;
    }

    const job = await this.prisma.jobRun.create({
      data: {
        userId,
        kind,
        status: "queued",
        details,
      },
    });

    this.logger.log(`Queued job ${job.id} of type ${kind} for user ${userId}`);
    return job;
  }

  async getQueuedJobs(limit: number = 10) {
    return this.prisma.jobRun.findMany({
      where: { status: "queued" },
      orderBy: { startedAt: "asc" },
      take: limit,
    });
  }

  async markJobStarted(jobId: string) {
    return this.prisma.jobRun.update({
      where: { id: jobId },
      data: {
        status: "running",
        startedAt: new Date(),
      },
    });
  }

  async markJobCompleted(jobId: string, result?: any) {
    return this.prisma.jobRun.update({
      where: { id: jobId },
      data: {
        status: "completed",
        finishedAt: new Date(),
        details: result ? { ...result } : undefined,
      },
    });
  }

  async markJobFailed(jobId: string, error: string) {
    return this.prisma.jobRun.update({
      where: { id: jobId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        details: { error },
      },
    });
  }

  private hasJobRunModelCached(): boolean {
    if (this.hasJobRunModel === null) {
      this.hasJobRunModel = Boolean((this.prisma as any)?.jobRun?.create);
    }
    return this.hasJobRunModel;
  }
}
