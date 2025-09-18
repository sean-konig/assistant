import { Module } from "@nestjs/common";
import { IndexerService } from "./indexer.service";
import { IndexQueueService } from "./indexer.queue";
import { PrismaModule } from "../prisma/prisma.module";
import { EmbeddingsModule } from "../embeddings/embeddings.module";

@Module({
  imports: [PrismaModule, EmbeddingsModule],
  providers: [IndexerService, IndexQueueService],
  exports: [IndexerService, IndexQueueService],
})
export class IndexerModule {}
