import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { LlmModule } from '../llm/openai.module';
import { ProjectAgent } from './project-agent.service';
import { CoreAgentController } from './core.controller';

@Module({ imports: [PrismaModule, EmbeddingsModule, LlmModule], providers: [ProjectAgent], controllers: [CoreAgentController], exports: [ProjectAgent] })
export class AgentsModule {}
