import { Module } from "@nestjs/common";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";
import { PrismaModule } from "../prisma/prisma.module";
import { IngestModule } from "../ingest/ingest.module";
import { EmbeddingsModule } from "../embeddings/embeddings.module";

@Module({
  imports: [PrismaModule, IngestModule, EmbeddingsModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
