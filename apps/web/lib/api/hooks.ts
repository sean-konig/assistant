"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ProjectsApi } from "./projects";
import type { CreateProjectReq, UpdateProjectReq } from "@repo/types";
import type { Project as UiProject, Task, Meeting, Note } from "@/lib/types";

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
      status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE";
      priority: number;
      dueDate?: string | null;
      source?: "MANUAL" | "EMAIL" | "MEETING";
    }) => ProjectsApi.addTask(code, payload),
    onSuccess: (task) => {
      qc.setQueryData(["project", code], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, tasks: [task, ...(prev.tasks ?? [])] };
      });
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

  return { send, cancel, isStreaming, reply, error };
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
