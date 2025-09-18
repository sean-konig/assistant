import { Module, forwardRef } from "@nestjs/common";
import { IngestController } from "./ingest.controller";
import { IngestService } from "./ingest.service";
import { IngestProcessor } from "./ingest-processor.service";
import { PrismaModule } from "../prisma/prisma.module";
import { JobsModule } from "../jobs/jobs.module";
import { EmbeddingsModule } from "../embeddings/embeddings.module";
import { LlmModule } from "../llm/openai.module";
import { IndexerModule } from "../indexer/indexer.module";

@Module({
  imports: [PrismaModule, JobsModule, EmbeddingsModule, LlmModule, IndexerModule],
  controllers: [IngestController],
  providers: [IngestService, IngestProcessor],
  exports: [IngestService, IngestProcessor],
})
export class IngestModule {}
