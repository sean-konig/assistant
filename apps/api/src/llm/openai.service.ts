import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
  private readonly client: OpenAI | null;
  private readonly chatModel: string;
  private readonly embedModel: string;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const apiKey = this.config?.get<string>('OPENAI_API_KEY') || this.config?.get<string>('openai.apiKey') || process.env.OPENAI_API_KEY;
    this.chatModel = this.config?.get<string>('OPENAI_CHAT_MODEL') || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
    this.embedModel = this.config?.get<string>('OPENAI_EMBED_MODEL') || process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  isEnabled() {
    return Boolean(this.client);
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.client) throw new Error('OpenAI not configured');
    const res = await this.client.embeddings.create({ model: this.embedModel, input: texts });
    return res.data.map((d) => d.embedding as unknown as number[]);
  }

  async chatMarkdown(system: string, user: string): Promise<string> {
    if (!this.client) throw new Error('OpenAI not configured');
    const res = await this.client.chat.completions.create({
      model: this.chatModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    });
    return res.choices[0]?.message?.content ?? '';
  }

  async summarizeNote(markdown: string): Promise<{ summaryMarkdown: string; tags: string[]; noteType: string }> {
    if (!this.client) throw new Error('OpenAI not configured');
    const schema = `Return JSON with keys summaryMarkdown (string, concise markdown), tags (array of short lowercase strings), noteType (one of MEETING|ONE_ON_ONE|DAILY|GENERAL|OTHER).`;
    const sys = 'You are a precise assistant that outputs valid JSON only.';
    const prompt = `${schema}\n\nNote Markdown:\n\n${markdown}`;
    const raw = await this.chatMarkdown(sys, prompt);
    try {
      const parsed = JSON.parse(raw);
      const noteType = String(parsed.noteType || 'GENERAL').toUpperCase();
      return { summaryMarkdown: String(parsed.summaryMarkdown || ''), tags: Array.isArray(parsed.tags) ? parsed.tags : [], noteType };
    } catch {
      return { summaryMarkdown: '', tags: [], noteType: 'GENERAL' };
    }
  }

  async streamChatMarkdown(
    system: string,
    user: string,
    onDelta: (text: string) => void,
  ): Promise<string> {
    if (!this.client) throw new Error('OpenAI not configured');
    const stream = await this.client.chat.completions.create({
      model: this.chatModel,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      stream: true,
    });
    let full = '';
    for await (const part of stream) {
      const delta = part.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }
    return full;
  }
}
