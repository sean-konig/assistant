'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ProjectsApi } from './projects';
import type { CreateProjectReq } from '@repo/types';
import type { Project as UiProject, Task, Meeting, Note } from '@/lib/types';

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: ProjectsApi.list,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectReq) => ProjectsApi.create(payload),
    onSuccess: (created) => {
      qc.setQueryData(['projects'], (prev: any) => {
        const list = Array.isArray(prev) ? prev : [];
        return [created, ...list.filter((p: any) => p.id !== created.id)];
      });
    },
  });
}

export function useProject(code?: string) {
  return useQuery({
    queryKey: ['project', code],
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
    mutationFn: (payload: { markdown: string; summaryMarkdown?: string; tags?: string[]; authorEmail?: string; vector?: number[]; dim?: number }) =>
      ProjectsApi.addNote(code, payload),
    onSuccess: (note) => {
      qc.setQueryData(['project', code], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, notes: [note, ...(prev.notes ?? [])] };
      });
    },
  });
}

export function useCreateTask(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; status: 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'; priority: number; dueDate?: string | null; source?: 'MANUAL' | 'EMAIL' | 'MEETING' }) =>
      ProjectsApi.addTask(code, payload),
    onSuccess: (task) => {
      qc.setQueryData(['project', code], (prev: any) => {
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
      qc.invalidateQueries({ queryKey: ['project', code] });
    },
  });
}

export function useProjectChatStream(code: string) {
  const qc = useQueryClient();
  const [isStreaming, setStreaming] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  async function send(message: string): Promise<string> {
    setError(null);
    setReply('');
    setStreaming(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';
      const ts = Date.now();
      const url = `${base}/projects/${encodeURIComponent(code)}/chat/stream?message=${encodeURIComponent(message)}&t=${ts}`;
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch(url, {
        method: 'GET',
        credentials: 'omit',
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-store',
      });
      if (!res.ok || !res.body) throw new Error('stream failed to start');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // split on double newlines into events
        const parts = buf.split(/\n\n/);
        buf = parts.pop() || '';
        for (const chunk of parts) {
          // ignore comments
          const line = chunk.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          const payload = line.replace(/^data:\s?/, '');
          try {
            const data = JSON.parse(payload);
            if (data.token) {
              setReply((r) => r + data.token);
              full += data.token as string;
            }
            if (data.error) {
              setError(String(data.error));
            }
            if (data.done) {
              setStreaming(false);
              qc.invalidateQueries({ queryKey: ['project', code] });
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
      setStreaming(false);
      const final = full;
      setReply('');
      qc.invalidateQueries({ queryKey: ['project', code] });
      return final;
    } catch (e: any) {
      setError(e?.message || 'failed to start stream');
      setStreaming(false);
      return '';
    }
  }

  function cancel() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  return { send, cancel, isStreaming, reply, error };
}
export function useCoreChatStream() {
  const [isStreaming, setStreaming] = useState(false);
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => () => { esRef.current?.close(); }, []);

  async function send(message: string) {
    setError(null);
    setReply('');
    setStreaming(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';
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
        setError('stream error');
        es.close();
        setStreaming(false);
      };
    } catch (e: any) {
      setError(e?.message || 'failed to start stream');
      setStreaming(false);
    }
  }

  function cancel() {
    esRef.current?.close();
    setStreaming(false);
  }

  return { send, cancel, isStreaming, reply, error };
}
