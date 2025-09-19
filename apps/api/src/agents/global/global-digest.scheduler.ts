import { Inject, Injectable, Logger } from "@nestjs/common";
import { GlobalAgentService, GlobalDigestResult } from "./global-agent.service";
import { DigestsService } from "../../digests/digests.service";

@Injectable()
export class GlobalDigestScheduler {
  private readonly logger = new Logger(GlobalDigestScheduler.name);

  constructor(
    @Inject(GlobalAgentService) private readonly globalAgent: GlobalAgentService,
    @Inject(DigestsService) private readonly digests: DigestsService
  ) {}

  async runDailyDigest(userId: string, date?: string): Promise<GlobalDigestResult> {
    const result = await this.globalAgent.generateDailyDigest(userId, date ?? new Date().toISOString().slice(0, 10));
    await this.digests.saveGlobalDigest(userId, result.payload);
    this.logger.log(`[GLOBAL:DIGEST] persisted daily digest for ${result.payload.date}`);
    return result;
  }
}
