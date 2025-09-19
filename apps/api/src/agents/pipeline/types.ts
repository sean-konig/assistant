export type GuardrailIntent = "status" | "plan" | "task_query" | "meeting_prep" | "general_q";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface InputGuardrailRequest {
  projectId: string;
  projectSlug: string;
  userPrompt: string;
  history?: ChatTurn[];
}

export interface InputGuardrailResponse {
  tripwire: boolean;
  message: string;
  rewritten?: string;
  intent: GuardrailIntent;
}

export interface RetrievedSnippet {
  itemId: string;
  kind: string;
  title?: string | null;
  snippet: string;
  distance: number;
}

export interface DbTaskSummary {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
}

export interface RetrievalBundle {
  snippets: RetrievedSnippet[];
  references: Array<{ itemId: string; confidence: number }>;
  dbTasks: DbTaskSummary[];
}

export interface ContextProviderRequest {
  projectId: string;
  query: string;
  k?: number;
  intent?: GuardrailIntent;
}

export interface OutputGuardrailRequest {
  draftReply: string;
  context: RetrievalBundle;
  intent: GuardrailIntent;
}

export interface OutputGuardrailResponse {
  tripwire: boolean;
  message: string;
  patched_reply?: string;
}

export interface OrchestratorStreamOptions {
  onToken: (token: string) => Promise<void> | void;
  onEvent?: (event: string, payload: unknown) => Promise<void> | void;
}

export interface ConversationParams {
  project: { id: string; slug: string; description?: string | null; userId: string };
  latestUserMessage: string;
  history: ChatTurn[];
}
