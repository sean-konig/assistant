'use client';

import { api } from './axios';
import type { CreateProjectReq, CreateProjectRes, ListProjectsRes, UpdateProjectReq, UpdateProjectRes } from '@repo/types';
import type { Project as UiProject, Note, Task, Meeting } from '@/lib/types';

export type ProjectDetails = UiProject & {
  notes: Note[];
  tasks: Task[];
  meetings: Meeting[];
  chat: { id: string; role: 'assistant' | 'user'; content: string; createdAt: string }[];
};

export interface ProjectChatResponse {
  reply: string;
  intent?: string;
  references?: Array<{ itemId: string; kind?: string | null; title?: string | null; distance?: number }>;
  proposedTasks?: Array<{
    title: string;
    status: 'TODO';
    dueDate?: string | null;
    projectId: string;
    note?: string | null;
  }>;
  proposedNotes?: Array<{
    body: string;
    projectId: string;
    title?: string | null;
    tags?: string[];
  }>;
  guardrails?: {
    input: { tripwire: boolean; message: string; rewritten?: string; intent?: string };
    output?: { tripwire: boolean; message?: string; patched?: string };
  };
}

export const ProjectsApi = {
  list: async () => (await api.get<ListProjectsRes>('/projects')).data,
  create: async (payload: CreateProjectReq) => (await api.post<CreateProjectRes>('/projects', payload)).data,
  get: async (code: string) => (await api.get<CreateProjectRes>(`/projects/${code}`)).data,
  getWithDetails: async (code: string) => (await api.get<ProjectDetails>(`/projects/${code}`)).data,
  update: async (code: string, payload: UpdateProjectReq) => (await api.patch<UpdateProjectRes>(`/projects/${code}`, payload)).data,
  addNote: async (
    code: string,
    payload: { markdown: string; summaryMarkdown?: string; tags?: string[]; authorEmail?: string; noteType?: string; vector?: number[]; dim?: number },
  ) => (await api.post<Note>(`/projects/${code}/notes`, payload)).data,
  addTask: async (
    code: string,
    payload: { title: string; status: 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE'; priority: number; dueDate?: string | null; source?: 'MANUAL' | 'EMAIL' | 'MEETING' },
  ) => (await api.post<Task>(`/projects/${code}/tasks`, payload)).data,
  chat: async (code: string, message: string) =>
    (await api.post<ProjectChatResponse>(`/projects/${code}/chat`, { message })).data,
};
