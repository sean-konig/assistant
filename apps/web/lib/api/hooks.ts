'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
