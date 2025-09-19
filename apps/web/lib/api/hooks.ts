"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ProjectsApi } from "./projects";
import { IngestApi, type IngestManualReq, type IngestManualRes } from "./ingest";
import { TasksApi, TasksFilter, TaskResponse } from "./tasks";
import type { CreateProjectReq, UpdateProjectReq } from "@repo/types";
import type { Project as UiProject, Task, Meeting, Note, TaskStatus } from "@/lib/types";

export interface AgentReference {
  itemId: string;
  kind?: string | null;
  title?: string | null;
  distance?: number;
}

export interface AgentProposedTask {
  title: string;
  status: "TODO";
  dueDate?: string | null;
  projectId: string;
  note?: string | null;
}

export interface AgentProposedNote {
  body: string;
  projectId: string;
  title?: string | null;
  tags?: string[];
}

export interface AgentProposedReminder {
  content: string;
  dueAt: string;
}

export interface AgentProposedAction {
  kind: "create_task" | "add_note" | "set_reminder";
  args: any;
}

export interface AgentGuardrailInputDecision {
  tripwire: boolean;
  message: string;
  rewritten?: string;
  intent?: string;
}

export interface AgentGuardrailOutputDecision {
  tripwire: boolean;
  message?: string;
  patched?: string;
}

export interface AgentGuardrailBundle {
  input: AgentGuardrailInputDecision;
  output?: AgentGuardrailOutputDecision;
}

export interface ChatStreamMetadata {
  reply: string;
  intent?: string;
  references: AgentReference[];
  proposedTasks: AgentProposedTask[];
  proposedNotes: AgentProposedNote[];
  proposedReminders?: AgentProposedReminder[];
  actions?: AgentProposedAction[];
  guardrails?: AgentGuardrailBundle;
  version: number;
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: ProjectsApi.list,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectReq) => ProjectsApi.create(payload),
    onSuccess: (created) => {
      qc.setQueryData(["projects"], (prev: any) => {
        const list = Array.isArray(prev) ? prev : [];
        return [created, ...list.filter((p: any) => p.id !== created.id)];
      });
    },
  });
}

export function useUpdateProject(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProjectReq) => ProjectsApi.update(code, payload),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["project", code] });
      qc.setQueryData(["projects"], (prev: any) => {
        const list = Array.isArray(prev) ? prev : [];
        return [updated, ...list.filter((p: any) => p.id !== updated.id)];
      });
    },
  });
}

export function useProject(code?: string) {
  return useQuery({
    queryKey: ["project", code],
    enabled: Boolean(code),
    queryFn: async () => {
      const p = await ProjectsApi.getWithDetails(code!);
      const withExtras: UiProject & { tasks: Task[]; meetings: Meeting[]; notes: Note[] } = {
        ...(p as UiProject),
        tasks: (p.tasks ?? []) as Task[],
        meetings: (p.meetings ?? []) as Meeting[],
        notes: (p.notes ?? []) as Note[],
      };
      return withExtras;
    },
  });
}

export function useCreateNote(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      markdown: string;
      summaryMarkdown?: string;
      tags?: string[];
      authorEmail?: string;
      noteType?: string;
      vector?: number[];
      dim?: number;
    }) => ProjectsApi.addNote(code, payload),
    onSuccess: (note) => {
      qc.setQueryData(["project", code], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, notes: [note, ...(prev.notes ?? [])] };
      });
    },
  });
}

export function useCreateTask(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title: string;
      status: TaskStatus;
      priority: number;
      dueDate?: string | null;
      source?: "MANUAL" | "EMAIL" | "MEETING";
    }) => {
      const map: Record<TaskStatus, 'OPEN' | 'IN_PROGRESS' | 'DONE'> = {
        todo: 'OPEN',
        in_progress: 'IN_PROGRESS',
        done: 'DONE',
      };
      return ProjectsApi.addTask(code, { ...payload, status: map[payload.status] });
    },
    onSuccess: (task) => {
      qc.setQueryData(["project", code], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, tasks: [task, ...(prev.tasks ?? [])] };
      });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useCreateTaskDynamic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      projectCode?: string; // optional; if omitted, create global task
      status: TaskStatus;
      priority: number;
      dueDate?: string | null;
      source?: "MANUAL" | "EMAIL" | "MEETING";
    }) => {
      const { projectCode, ...rest } = payload;
      const map: Record<TaskStatus, 'OPEN' | 'IN_PROGRESS' | 'DONE'> = {
        todo: 'OPEN',
        in_progress: 'IN_PROGRESS',
        done: 'DONE',
      };
      if (projectCode) {
        return ProjectsApi.addTask(projectCode, { ...rest, status: map[payload.status] });
      }
      return TasksApi.create({ ...payload, status: map[payload.status] });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useProjectChat(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => ProjectsApi.chat(code, message),
    onSuccess: () => {
      // could refetch or update chat log later
      qc.invalidateQueries({ queryKey: ["project", code] });
    },
  });
}

export function useProjectChatStream(code: string) {
  const qc = useQueryClient();
  const [isStreaming, setStreaming] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ChatStreamMetadata | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(
    () => () => {
      esRef.current?.close();
    },
    []
  );

  async function send(message: string): Promise<string> {
    setError(null);
    setReply("");
    setStreaming(true);
    setMetadata(null);

    // Wrap the stream lifecycle in a Promise so callers can await the final text.
    return new Promise<string>((resolve) => {
      try {
        const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
        const url =
          `${base}/projects/${encodeURIComponent(code)}/agent/rag/chat/stream` +
          `?message=${encodeURIComponent(message)}&t=${Date.now()}`;

        // Ensure only one open stream
        esRef.current?.close();
        const es = new EventSource(url);
        esRef.current = es;

        let full = "";

        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.token) {
              const t = String(data.token);
              setReply((r) => r + t);
              full += t;
            }
            if (data.final) {
              const final = data.final as Partial<ChatStreamMetadata> & { reply?: string };
              setMetadata({
                reply: typeof final.reply === "string" ? final.reply : full,
                intent: typeof final.intent === "string" ? final.intent : undefined,
                references: Array.isArray(final.references) ? (final.references as AgentReference[]) : [],
                proposedTasks: Array.isArray(final.proposedTasks) ? (final.proposedTasks as AgentProposedTask[]) : [],
                proposedNotes: Array.isArray(final.proposedNotes) ? (final.proposedNotes as AgentProposedNote[]) : [],
                proposedReminders: Array.isArray((final as any).proposedReminders)
                  ? ((final as any).proposedReminders as AgentProposedReminder[])
                  : undefined,
                actions: Array.isArray((final as any).actions)
                  ? ((final as any).actions as AgentProposedAction[])
                  : undefined,
                guardrails: final.guardrails as AgentGuardrailBundle | undefined,
                version: Date.now(),
              });
            }
            if (data.done || data.error) {
              es.close();
              esRef.current = null;
              setStreaming(false);
              if (data.error) setError(String(data.error));
              // Trigger any consumers (e.g., to refresh project details)
              qc.invalidateQueries({ queryKey: ["project", code] });
              resolve(full);
            }
          } catch {
            // ignore malformed chunk
          }
        };

        es.onerror = () => {
          setError("stream error");
          es.close();
          esRef.current = null;
          setStreaming(false);
          qc.invalidateQueries({ queryKey: ["project", code] });
          resolve(full); // resolve with whatever we have so far
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "failed to start stream";
        setError(msg);
        setStreaming(false);
        qc.invalidateQueries({ queryKey: ["project", code] });
        resolve("");
      }
    });
  }

  function cancel() {
    esRef.current?.close();
    esRef.current = null;
    setStreaming(false);
  }

  function clearMetadata() {
    setMetadata(null);
  }

  return { send, cancel, isStreaming, reply, error, metadata, clearMetadata };
}


const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export const GlobalAgentApi = {
  async digest(date?: string) {
    const params = new URLSearchParams({ persist: 'false' });
    if (date) params.set('date', date);
    const res = await fetch(`${API_BASE}/agent/global/digest?${params.toString()}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('failed to fetch global digest');
    }
    return res.json();
  },
};

export const GlobalDigestsApi = {
  async latest() {
    const res = await fetch(`${API_BASE}/digests/latest`, { credentials: 'include' });
    if (!res.ok) {
      throw new Error('failed to load latest digest');
    }
    return res.json();
  },
};

export function useManualIngest() {
  return useMutation<IngestManualRes, Error, IngestManualReq>({
    mutationFn: (payload: IngestManualReq) => IngestApi.manual(payload),
  });
}

export function useGlobalDigest(date?: string) {
  return useQuery({
    queryKey: ['global-digest', date ?? 'today'],
    queryFn: () => GlobalAgentApi.digest(date),
  });
}

export function useLatestDigest() {
  return useQuery({
    queryKey: ['digests', 'latest'],
    queryFn: GlobalDigestsApi.latest,
  });
}
export function useCoreChatStream() {
  const [isStreaming, setStreaming] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(
    () => () => {
      esRef.current?.close();
    },
    []
  );

  async function send(message: string) {
    setError(null);
    setReply("");
    setStreaming(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
      const url = `${base}/core/chat/stream?message=${encodeURIComponent(message)}&t=${Date.now()}`;
      esRef.current?.close();
      const es = new EventSource(url);
      esRef.current = es;
      es.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.token) setReply((r) => r + data.token);
          if (data.done || data.error) {
            es.close();
            setStreaming(false);
            if (data.error) setError(data.error);
          }
        } catch {}
      };
      es.onerror = () => {
        setError("stream error");
        es.close();
        setStreaming(false);
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "failed to start stream";
      setError(msg);
      setStreaming(false);
    }
  }

  function cancel() {
    esRef.current?.close();
    setStreaming(false);
  }

  return { send, cancel, isStreaming, reply, error };
}

export function useGlobalChatStream() {
  const [isStreaming, setStreaming] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ChatStreamMetadata | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(
    () => () => {
      esRef.current?.close();
    },
    []
  );

  async function send(message: string) {
    setError(null);
    setReply("");
    setMetadata(null);
    setStreaming(true);
    try {
      const params = new URLSearchParams({ message, t: Date.now().toString() });
      const url = `${API_BASE}/agent/global/chat/stream?${params.toString()}`;
      esRef.current?.close();
      const es = new EventSource(url);
      esRef.current = es;
      let full = "";
      es.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.token) {
            const token = String(data.token);
            full += token;
            setReply((current) => current + token);
          }
          if (data.final) {
            const final = data.final as Partial<ChatStreamMetadata> & { reply?: string };
            setMetadata({
              reply: typeof final.reply === "string" ? final.reply : full,
              intent: typeof final.intent === "string" ? final.intent : undefined,
              references: Array.isArray(final.references) ? (final.references as AgentReference[]) : [],
              proposedTasks: Array.isArray(final.proposedTasks) ? (final.proposedTasks as AgentProposedTask[]) : [],
              proposedNotes: Array.isArray(final.proposedNotes) ? (final.proposedNotes as AgentProposedNote[]) : [],
              proposedReminders: Array.isArray((final as any).proposedReminders)
                ? ((final as any).proposedReminders as AgentProposedReminder[])
                : undefined,
              actions: Array.isArray((final as any).actions)
                ? ((final as any).actions as AgentProposedAction[])
                : undefined,
              guardrails: final.guardrails as AgentGuardrailBundle | undefined,
              version: Date.now(),
            });
          }
          if (Array.isArray(data.refs)) {
            setMetadata((prev) => {
              if (!prev) return prev;
              return { ...prev, references: data.refs as AgentReference[], version: Date.now() } as ChatStreamMetadata;
            });
          }
          if (data.done || data.error) {
            es.close();
            esRef.current = null;
            setStreaming(false);
            if (data.error) setError(String(data.error));
          }
        } catch {
          // ignore malformed chunk
        }
      };
      es.onerror = () => {
        setError('stream error');
        es.close();
        esRef.current = null;
        setStreaming(false);
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'failed to start stream';
      setError(msg);
      setStreaming(false);
    }
  }

  function cancel() {
    esRef.current?.close();
    esRef.current = null;
    setStreaming(false);
  }

  function clearMetadata() {
    setMetadata(null);
  }

  return { send, cancel, isStreaming, reply, error, metadata, clearMetadata };
}

// Tasks hooks
export function useTasks(filters: TasksFilter = {}) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => TasksApi.list(filters),
    select: (data) => data.map(mapApiTaskToUiTask),
  });
}

export function useTasksToday() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["tasks", "today", todayStr],
    queryFn: async () => {
      const tasks = await TasksApi.list();
      // Filter to tasks due today
      return tasks
        .filter((task) => {
          if (!task.dueDate) return false;
          const dueDate = new Date(task.dueDate);
          return dueDate.toDateString() === today.toDateString();
        })
        .map(mapApiTaskToUiTask);
    },
  });
}

export function useTasksUpcoming(days: number) {
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(today.getDate() + days);

  return useQuery({
    queryKey: ["tasks", "upcoming", days],
    queryFn: async () => {
      const tasks = await TasksApi.list();
      // Filter to tasks due within the specified days
      return tasks
        .filter((task) => {
          if (!task.dueDate) return false;
          const dueDate = new Date(task.dueDate);
          return dueDate >= today && dueDate <= endDate;
        })
        .map(mapApiTaskToUiTask);
    },
  });
}

export function useRescoreTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (project?: string) => TasksApi.rescore(project),
    onSuccess: () => {
      // Invalidate all tasks queries to refetch updated priorities
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Helper function to map API task response to UI Task type
function mapApiTaskToUiTask(apiTask: TaskResponse): Task {
  return {
    id: apiTask.id,
    projectCode: apiTask.projectCode ?? undefined,
    title: apiTask.title,
    status: mapApiStatusToUiStatus(apiTask.status),
    dueDate: apiTask.dueDate,
    priority: mapPriorityBucketToNumber(apiTask.priorityBucket),
    source: "MANUAL", // Default since API doesn't have this field yet
    updatedAt: apiTask.updatedAt,
  };
}

function mapApiStatusToUiStatus(apiStatus: string): TaskStatus {
  switch (apiStatus) {
    case "todo":
      return "todo";
    case "in_progress":
      return "in_progress";
    case "done":
      return "done";
    default:
      return "todo";
  }
}

function mapPriorityBucketToNumber(bucket?: string | null): number {
  if (!bucket) return 0;
  switch (bucket) {
    case "P0":
      return 3; // Highest priority
    case "P1":
      return 2;
    case "P2":
      return 1;
    case "P3":
      return 0;
    default:
      return 0;
  }
}
