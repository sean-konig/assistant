import { Module } from '@nestjs/common'
import { EmbeddingsService } from './embeddings.service'
import { EmbeddingsController } from './embeddings.controller'
import { LlmModule } from '../llm/openai.module'
import { EmbeddingPipeline } from './embedding.pipeline'

@Module({
  imports: [LlmModule],
  controllers: [EmbeddingsController],
  providers: [EmbeddingsService, EmbeddingPipeline],
  exports: [EmbeddingsService, EmbeddingPipeline],
})
export class EmbeddingsModule {}
