import { Module } from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { ProjectsController } from './projects.controller'
import { EmbeddingsModule } from '../embeddings/embeddings.module'
import { AgentsModule } from '../agents/agents.module'
import { LlmModule } from '../llm/openai.module'

@Module({ imports: [EmbeddingsModule, AgentsModule, LlmModule], controllers: [ProjectsController], providers: [ProjectsService] })
export class ProjectsModule {}
