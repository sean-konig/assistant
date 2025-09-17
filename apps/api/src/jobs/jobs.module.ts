import { Module, forwardRef } from '@nestjs/common'
import { JobsService } from './jobs.service'
import { JobsController } from './jobs.controller'
import { JobProcessor } from './job-processor.service'
import { IngestModule } from '../ingest/ingest.module'

@Module({ 
  imports: [forwardRef(() => IngestModule)],
  controllers: [JobsController], 
  providers: [JobsService, JobProcessor],
  exports: [JobsService],
})
export class JobsModule {}

