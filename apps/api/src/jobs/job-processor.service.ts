import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { IngestProcessor } from '../ingest/ingest-processor.service';
import { IngestJobDetails } from '../ingest/dto/ingest-manual.dto';

@Injectable()
export class JobProcessor implements OnModuleInit {
  private readonly logger = new Logger(JobProcessor.name);
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly jobsService: JobsService,
    @Inject(forwardRef(() => IngestProcessor))
    private readonly ingestProcessor: IngestProcessor,
  ) {}

  onModuleInit() {
    // Start processing jobs every 5 seconds
    this.startProcessing();
  }

  private startProcessing() {
    this.processingInterval = setInterval(async () => {
      await this.processNextJob();
    }, 5000); // 5 seconds

    this.logger.log('Job processor started');
  }

  async processNextJob() {
    try {
      const jobs = await this.jobsService.getQueuedJobs(1);
      
      if (jobs.length === 0) {
        return; // No jobs to process
      }

      const job = jobs[0];
      if (!job) {
        return; // No valid job found
      }

      this.logger.log(`Processing job ${job.id} of type ${job.kind}`);

      await this.jobsService.markJobStarted(job.id);

      try {
        switch (job.kind) {
          case 'ingest':
            if (!job.details || typeof job.details !== 'object') {
              throw new Error('Invalid job details for ingest job');
            }
            await this.ingestProcessor.processIngestItem(job.details as unknown as IngestJobDetails);
            break;
          default:
            this.logger.warn(`Unknown job type: ${job.kind}`);
            throw new Error(`Unknown job type: ${job.kind}`);
        }

        await this.jobsService.markJobCompleted(job.id);
        this.logger.log(`Job ${job.id} completed successfully`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await this.jobsService.markJobFailed(job.id, errorMessage);
        this.logger.error(`Job ${job.id} failed:`, error);
      }

    } catch (error) {
      this.logger.error('Error processing jobs:', error);
    }
  }

  async stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      this.logger.log('Job processor stopped');
    }
  }
}