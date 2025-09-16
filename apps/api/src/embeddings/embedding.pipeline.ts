import { Injectable } from '@nestjs/common';
import { OpenAiService } from '../llm/openai.service';
import { EmbeddingsService } from './embeddings.service';

@Injectable()
export class EmbeddingPipeline {
  constructor(private readonly llm: OpenAiService, private readonly embeddings: EmbeddingsService) {}

  async generateAndIndex(userId: string, itemId: string | null, markdown: string) {
    const plain = this.stripMarkdown(markdown).slice(0, 2000);
    const vectors = await this.llm.embed([plain]);
    const vector = vectors?.[0];
    if (!vector || !vector.length) return { dim: 0 };
    const dim = vector.length;
    await this.embeddings.indexVector(userId, itemId, vector, dim);
    return { dim };
  }

  private stripMarkdown(md: string) {
    return md
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/!\[[^\]]*\]\([^\)]*\)/g, ' ')
      .replace(/\[[^\]]*\]\([^\)]*\)/g, ' ')
      .replace(/^#+\s+/gm, '')
      .replace(/^>+\s?/gm, '')
      .replace(/[*_~`>#-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
