import { Module } from '@nestjs/common'
import { ProjectsService } from './projects.service'
import { ProjectsController } from './projects.controller'
import { EmbeddingsModule } from '../embeddings/embeddings.module'

@Module({ imports: [EmbeddingsModule], controllers: [ProjectsController], providers: [ProjectsService] })
export class ProjectsModule {}
