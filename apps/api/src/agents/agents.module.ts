import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { LlmModule } from "../llm/openai.module";
import { EmbeddingsModule } from "../embeddings/embeddings.module";
import { DigestsModule } from "../digests/digests.module";
import { ProjectAgentService } from "./project-agent.service";
import { CoreAgentController } from "./core.controller";
import { InputGuardrailService } from "./pipeline/input-guardrail.service";
import { GlobalAgentService } from "./global/global-agent.service";
import { GlobalContextService } from "./global/global-context.service";
import { GlobalAgentController } from "./global/global-agent.controller";
import { GlobalDigestScheduler } from "./global/global-digest.scheduler";
import { ContextProviderService } from "./pipeline/context-provider.service";
import { OutputGuardrailService } from "./pipeline/output-guardrail.service";
import { ProjectConversationOrchestrator } from "./pipeline/orchestrator.service";

@Module({
  imports: [PrismaModule, LlmModule, EmbeddingsModule, DigestsModule],
  providers: [
    ProjectAgentService,
    InputGuardrailService,
    ContextProviderService,
    OutputGuardrailService,
    ProjectConversationOrchestrator,
    GlobalAgentService,
    GlobalContextService,
    GlobalDigestScheduler,
  ],
  controllers: [CoreAgentController, GlobalAgentController],
  exports: [
    ProjectAgentService,
    InputGuardrailService,
    ContextProviderService,
    OutputGuardrailService,
    ProjectConversationOrchestrator,
    GlobalAgentService,
    GlobalContextService,
    GlobalDigestScheduler,
  ],
})
export class AgentsModule {}
