## Step 1 — Agent service (streaming from the start)

What you’ll build
	•	A ProjectAgentService that creates a project-scoped agent and streams text deltas.
	•	A minimal stream endpoint: GET /projects/:code/agent/chat/stream.
	•	Keep your existing SSE helper + EventSource client. No embeddings yet.

Install

pnpm add @openai/agents

Set OPENAI_API_KEY (and optionally OPENAI_MODEL, e.g. gpt-4.1-mini).

Service

apps/api/src/agents/project-agent.service.ts

import { Injectable } from '@nestjs/common';
import {
  Agent,
  run,
  user,
  extractAllTextOutput,
  setDefaultOpenAIKey,
} from '@openai/agents';

type ProjectLite = { id: string; slug: string; description?: string | null };

@Injectable()
export class ProjectAgentService {
  constructor() {
    setDefaultOpenAIKey(process.env.OPENAI_API_KEY!);
  }

  private createAgent(project: ProjectLite) {
    return new Agent({
      name: `project:${project.slug}`,
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
      instructions: [
        'You are the project-specific agent.',
        'Answer clearly and concisely using markdown.',
        `Project description:\n${project.description ?? 'N/A'}`,
      ].join('\n'),
    });
  }

  // Non-stream variant (handy for tests)
  async replyOnce(project: ProjectLite, message: string) {
    const agent = this.createAgent(project);
    const result = await run(agent, user(message), {
      context: { projectId: project.id },
    });
    return extractAllTextOutput(result);
  }

  // STREAMING: async generator of text chunks
  async *replyStream(project: ProjectLite, message: string) {
    const agent = this.createAgent(project);
    const streamed = await run(agent, user(message), {
      context: { projectId: project.id },
      stream: true,
    });
    for await (const delta of streamed.textStream) {
      yield delta; // plain text
    }
  }
}

Controller (add new endpoints; don’t break your current /chat/stream)

In projects.controller.ts (inject ProjectAgentService), add:

@Post(':code/agent/chat')
async projectAgentChat(@Param('code') code: string, @Body() body: { message: string }) {
  const project = await this.projects.getLocalBySlug(code);
  const reply = await this.projAgent.replyOnce(
    { id: project.id, slug: project.slug, description: project.description ?? null },
    body.message
  );
  await this.projects.appendChatMessage(project.userId, project.id, { role: 'user', content: body.message });
  await this.projects.appendChatMessage(project.userId, project.id, { role: 'assistant', content: reply });
  return { reply };
}

@Get(':code/agent/chat/stream')
async projectAgentChatStream(@Param('code') code: string, @Query('message') message: string, @Res() res: any, @Req() req: any) {
  const sse = createSse(res, req, { pingMs: 15000 });
  try {
    const project = await this.projects.getLocalBySlug(code);
    await this.projects.appendChatMessage(project.userId, project.id, { role: 'user', content: message });

    let full = '';
    for await (const delta of this.projAgent.replyStream(
      { id: project.id, slug: project.slug, description: project.description ?? null },
      message
    )) {
      full += delta;
      sse.write({ token: delta }); // UI already expects { token }
    }

    await this.projects.appendChatMessage(project.userId, project.id, { role: 'assistant', content: full });
    sse.write({ done: true });
  } catch (e: any) {
    sse.write({ error: e?.message || 'stream failed' });
  } finally {
    sse.close(5);
  }
}

You can now “say hello” to the per-project agent with streaming.

⸻

Step 2 — Add context to conversation (project chat history)

What you’ll add
	•	Pull the recent conversation turns (from your DB) and pass them to the agent so replies are aware of prior messages.
	•	Keep it simple: no summarization yet. Just the last N turns (e.g., 10).

Service tweak (accept prior messages)

import { user as u, assistant as a } from '@openai/agents';

type Turn = { role: 'user' | 'assistant'; content: string };

private toMessageSequence(history: Turn[], latest: string) {
  // Convert DB turns into agent message sequence
  const seq = [];
  for (const t of history) {
    if (t.role === 'user') seq.push(u(t.content));
    else seq.push(a(t.content));
  }
  seq.push(u(latest));
  return seq;
}

async *replyStreamWithHistory(project: ProjectLite, latest: string, history: Turn[]) {
  const agent = this.createAgent(project);
  const seq = this.toMessageSequence(history, latest);
  const streamed = await run(agent, seq, { context: { projectId: project.id }, stream: true });
  for await (const delta of streamed.textStream) yield delta;
}

Controller tweak

@Get(':code/agent/chat/stream')
async projectAgentChatStream(@Param('code') code: string, @Query('message') message: string, @Res() res: any, @Req() req: any) {
  const sse = createSse(res, req, { pingMs: 15000 });
  try {
    const project = await this.projects.getLocalBySlug(code);

    // 1) Persist the user turn
    await this.projects.appendChatMessage(project.userId, project.id, { role: 'user', content: message });

    // 2) Load recent history (e.g., last 10 turns)
    const history = await this.projects.getRecentChat(project.id, 10); // -> Turn[]

    // 3) Stream with history
    let full = '';
    for await (const delta of this.projAgent.replyStreamWithHistory(
      { id: project.id, slug: project.slug, description: project.description ?? null },
      message,
      history
    )) {
      full += delta;
      sse.write({ token: delta });
    }

    await this.projects.appendChatMessage(project.userId, project.id, { role: 'assistant', content: full });
    sse.write({ done: true });
  } catch (e: any) {
    sse.write({ error: e?.message || 'stream failed' });
  } finally {
    sse.close(5);
  }
}

This gives you true conversation behavior while still staying minimal. Later, you can swap getRecentChat for “last 50 summarized to 3–4 bullets + last 6 raw turns” if you need tighter tokens.

⸻

Step 3 — Embed data (RAG), then stitch into the run

What you’ll add
	•	Index vectors for your items/notes (you already have most of this).
	•	At query time: embed the user message, fetch top-k, and prepend a Context block to the message sequence.

a) Ensure a simple embeddings interface

apps/api/src/embeddings/embeddings.service.ts

import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingsService {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  private model = process.env.EMBED_MODEL ?? 'text-embedding-3-small'; // 1536-d

  async embed(texts: string[]): Promise<number[][]> {
    const res = await this.client.embeddings.create({ input: texts, model: this.model });
    return res.data.map((d) => d.embedding);
  }
}

b) Query time: fetch top-k context with pgvector

Snippet you can reuse (close to what you already wrote):

async getTopKContext(projectId: string, query: string, k = 6): Promise<string[]> {
  const [qvec] = await this.embeddings.embed([query]);
  if (!qvec?.length) return [];

  const qstr = `[${qvec.join(',')}]`;
  const rows = await this.prisma.$queryRawUnsafe<any[]>(
    `SELECT i.body, i.raw
     FROM embeddings e
     JOIN items i ON i.id = e."itemId"
     WHERE i."projectId" = $1
     ORDER BY e.vector <-> $2::vector
     LIMIT ${k}`,
    projectId,
    qstr
  );
  return rows.map((r) => r.body || r.raw?.markdown || '').filter(Boolean);
}

c) Service: include context in the run (still streaming)

import { system as s, user as u, assistant as a } from '@openai/agents';

async *replyStreamWithHistoryAndRag(
  project: ProjectLite,
  latest: string,
  history: Turn[],
  fetchContext: (q: string) => Promise<string[]>
) {
  const agent = this.createAgent(project);

  const contextSnippets = await fetchContext(latest);
  const contextBlock = contextSnippets.length
    ? `Context (top ${contextSnippets.length}):\n` + contextSnippets.map(c => `- ${c}`).join('\n')
    : '';

  const seq = [];
  if (contextBlock) seq.push(s('Use the following context if relevant. If not relevant, ignore it.\n' + contextBlock));
  for (const h of history) seq.push(h.role === 'user' ? u(h.content) : a(h.content));
  seq.push(u(latest));

  const streamed = await run(agent, seq, { context: { projectId: project.id }, stream: true });
  for await (const delta of streamed.textStream) yield delta;
}

d) Controller: call the RAG version

const history = await this.projects.getRecentChat(project.id, 10);
let full = '';
for await (const delta of this.projAgent.replyStreamWithHistoryAndRag(
  { id: project.id, slug: project.slug, description: project.description ?? null },
  message,
  history,
  (q) => this.getTopKContext(project.id, q, 6)
)) {
  full += delta;
  sse.write({ token: delta });
}


⸻

Guardrails & small QoL (do after the basics)
	•	Dim validation when indexing (1536) and clear errors.
	•	Rate limiting on the stream route (IP/user + sliding window).
	•	Request size guard for message.
	•	Citations: after you fetch rows, also return {id, score} and stream tiny { ref: [...] } events alongside token for UI pills (optional).
	•	Tests: unit test for getTopKContext and a small integration test for the stream endpoint.

⸻

Summary
	1.	Step 1: minimal streaming agent per project (hello world).
	2.	Step 2: add conversation context (recent turns → message sequence).
	3.	Step 3: add embeddings and stitch RAG into the same streaming flow.
