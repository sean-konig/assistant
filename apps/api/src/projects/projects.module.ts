import { Module } from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { ProjectNotesService } from './project-notes.service'
import { ProjectTasksService } from './project-tasks.service'
import { ProjectChatService } from './project-chat.service'
import { ProjectDetailsService } from './project-details.service'
import { ProjectsController } from './projects.controller'
import { EmbeddingsModule } from '../embeddings/embeddings.module'
import { AgentsModule } from '../agents/agents.module'
import { LlmModule } from '../llm/openai.module'

@Module({ imports: [EmbeddingsModule, AgentsModule, LlmModule], controllers: [ProjectsController], providers: [ProjectsService, ProjectNotesService, ProjectTasksService, ProjectChatService, ProjectDetailsService] })
export class ProjectsModule {}
