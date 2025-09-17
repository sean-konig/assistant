import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobProcessor } from '../job-processor.service';
import { JobsService } from '../jobs.service';
import { IngestProcessor } from '../../ingest/ingest-processor.service';
import { IngestJobDetails } from '../../ingest/dto/ingest-manual.dto';

describe('JobProcessor', () => {
  let service: JobProcessor;
  let jobsService: any;
  let ingestProcessor: any;

  beforeEach(async () => {
    const mockJobsService = {
      getQueuedJobs: vi.fn(),
      markJobStarted: vi.fn(),
      markJobCompleted: vi.fn(),
      markJobFailed: vi.fn(),
    };

    const mockIngestProcessor = {
      processIngestItem: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobProcessor,
        { provide: JobsService, useValue: mockJobsService },
        { provide: IngestProcessor, useValue: mockIngestProcessor },
      ],
    }).compile();

    service = module.get<JobProcessor>(JobProcessor);
    jobsService = module.get(JobsService);
    ingestProcessor = module.get(IngestProcessor);

    // Mock logger to avoid console output during tests
    vi.spyOn(service['logger'], 'log').mockImplementation(() => {});
    vi.spyOn(service['logger'], 'warn').mockImplementation(() => {});
    vi.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process no jobs when queue is empty', async () => {
    jobsService.getQueuedJobs.mockResolvedValue([]);

    await service.processNextJob();

    expect(jobsService.getQueuedJobs).toHaveBeenCalledWith(1);
    expect(jobsService.markJobStarted).not.toHaveBeenCalled();
  });

  it('should process an ingest job successfully', async () => {
    const mockJob = {
      id: 'job-123',
      kind: 'ingest',
      details: {
        itemId: 'item-123',
        userId: 'user-123',
        projectId: 'project-123',
        text: 'Sample text to process',
      } as IngestJobDetails,
    };

    jobsService.getQueuedJobs.mockResolvedValue([mockJob as any]);
    ingestProcessor.processIngestItem.mockResolvedValue();

    await service.processNextJob();

    expect(jobsService.getQueuedJobs).toHaveBeenCalledWith(1);
    expect(jobsService.markJobStarted).toHaveBeenCalledWith('job-123');
    expect(ingestProcessor.processIngestItem).toHaveBeenCalledWith(mockJob.details);
    expect(jobsService.markJobCompleted).toHaveBeenCalledWith('job-123');
  });

  it('should handle job processing failure', async () => {
    const mockJob = {
      id: 'job-456',
      kind: 'ingest',
      details: {
        itemId: 'item-456',
        userId: 'user-456',
        projectId: 'project-456',
        text: 'Text that will fail',
      } as IngestJobDetails,
    };

    const processingError = new Error('Processing failed');

    jobsService.getQueuedJobs.mockResolvedValue([mockJob as any]);
    ingestProcessor.processIngestItem.mockRejectedValue(processingError);

    await service.processNextJob();

    expect(jobsService.markJobStarted).toHaveBeenCalledWith('job-456');
    expect(ingestProcessor.processIngestItem).toHaveBeenCalledWith(mockJob.details);
    expect(jobsService.markJobFailed).toHaveBeenCalledWith('job-456', 'Processing failed');
    expect(jobsService.markJobCompleted).not.toHaveBeenCalled();
  });

  it('should handle unknown job types', async () => {
    const mockJob = {
      id: 'job-unknown',
      kind: 'unknown-type',
      details: {},
    };

    jobsService.getQueuedJobs.mockResolvedValue([mockJob as any]);

    await service.processNextJob();

    expect(jobsService.markJobStarted).toHaveBeenCalledWith('job-unknown');
    expect(jobsService.markJobFailed).toHaveBeenCalledWith('job-unknown', 'Unknown job type: unknown-type');
    expect(ingestProcessor.processIngestItem).not.toHaveBeenCalled();
  });

  it('should handle invalid job details', async () => {
    const mockJob = {
      id: 'job-invalid',
      kind: 'ingest',
      details: null,
    };

    jobsService.getQueuedJobs.mockResolvedValue([mockJob as any]);

    await service.processNextJob();

    expect(jobsService.markJobStarted).toHaveBeenCalledWith('job-invalid');
    expect(jobsService.markJobFailed).toHaveBeenCalledWith('job-invalid', 'Invalid job details for ingest job');
    expect(ingestProcessor.processIngestItem).not.toHaveBeenCalled();
  });

  it('should handle service failures gracefully', async () => {
    const serviceError = new Error('Service unavailable');
    jobsService.getQueuedJobs.mockRejectedValue(serviceError);

    await service.processNextJob();

    expect(service['logger'].error).toHaveBeenCalledWith('Error processing jobs:', serviceError);
  });
});