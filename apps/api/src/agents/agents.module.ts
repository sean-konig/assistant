import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmModule } from '../llm/openai.module';
import { ProjectAgentService } from './project-agent.service';
import { CoreAgentController } from './core.controller';

@Module({ imports: [PrismaModule, LlmModule], providers: [ProjectAgentService], controllers: [CoreAgentController], exports: [ProjectAgentService] })
export class AgentsModule {}
