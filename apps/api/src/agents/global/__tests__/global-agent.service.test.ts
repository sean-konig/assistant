import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalAgentService } from '../global-agent.service';

const emptyRetrieval = { snippets: [], references: [], tasks: [], meetings: [], risks: [] };

describe('GlobalAgentService guardrails', () => {
  let llm: any;
  let context: any;
  let service: GlobalAgentService;

  beforeEach(() => {
    llm = {
      isEnabled: vi.fn().mockReturnValue(true),
      chatMarkdown: vi.fn(),
    };
    context = { fetch: vi.fn().mockResolvedValue(emptyRetrieval) };
    service = new GlobalAgentService(llm, context);
  });

  it('parses input guardrail decision', async () => {
    llm.chatMarkdown.mockResolvedValue(
      JSON.stringify({ tripwire: false, message: 'ok', rewritten: 'refined prompt', intent: 'daily_digest' })
    );
    const decision = await (service as any).evaluateInputGuardrail('user-1', 'raw prompt', [], undefined);
    expect(decision.tripwire).toBe(false);
    expect(decision.rewritten).toBe('refined prompt');
    expect(decision.intent).toBe('daily_digest');
  });

  it('honours tripwire responses from guardrail', async () => {
    llm.chatMarkdown.mockResolvedValue(JSON.stringify({ tripwire: true, message: 'blocked', intent: 'general_q' }));
    const decision = await (service as any).evaluateInputGuardrail('user-1', 'unsafe', [], undefined);
    expect(decision.tripwire).toBe(true);
    expect(decision.message).toBe('blocked');
  });

  it('extracts machine tail JSON block', () => {
    const reply = [
      "## Today's Overview",
      '- One item',
      '```json',
      '{"intent":"daily_digest","followups":["confirm agenda"]}',
      '```',
    ].join('\n');

    const tail = (service as any).extractMachineTail(reply);
    expect(tail?.intent).toBe('daily_digest');
    expect(Array.isArray(tail?.followups)).toBe(true);
    expect(tail?.followups?.[0]).toBe('confirm agenda');
  });
});
