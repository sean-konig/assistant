import { Module } from "@nestjs/common";
import { EmbeddingsController } from "./embeddings.controller";
import { EmbeddingsService } from "./embeddings.service";
import { EmbeddingPipeline } from "./embedding.pipeline";
import { PrismaModule } from "../prisma/prisma.module";
import { LlmModule } from "../llm/openai.module";

@Module({
  imports: [PrismaModule, LlmModule],
  controllers: [EmbeddingsController],
  providers: [EmbeddingsService, EmbeddingPipeline],
  exports: [EmbeddingsService, EmbeddingPipeline], // Export both for other modules
})
export class EmbeddingsModule {}
