import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { LlmModule } from '../llm/openai.module';
import { ProjectAgent } from './project-agent.service';

@Module({ imports: [PrismaModule, EmbeddingsModule, LlmModule], providers: [ProjectAgent], exports: [ProjectAgent] })
export class AgentsModule {}

