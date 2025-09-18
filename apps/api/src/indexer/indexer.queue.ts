import { Inject, Injectable } from "@nestjs/common";
import { IndexerService } from "./indexer.service";

@Injectable()
export class IndexQueueService {
  private readonly pending = new Set<string>();
  private readonly queue: string[] = [];
  private processing = false;

  constructor(@Inject(IndexerService) private readonly indexer: IndexerService) {}

  enqueue(itemId: string) {
    if (!itemId) {
      return;
    }
    if (this.pending.has(itemId)) {
      return;
    }
    this.pending.add(itemId);
    this.queue.push(itemId);
    if (!this.processing) {
      this.processing = true;
      void this.drain();
    }
  }

  private async drain() {
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) {
        continue;
      }
      try {
        await this.indexer.processItem(next);
      } catch (err) {
        console.error(`[INDEX] ERROR item=${next}`, err);
      } finally {
        this.pending.delete(next);
      }
    }
    this.processing = false;
  }
}
