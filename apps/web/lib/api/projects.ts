'use client';

import { api } from './axios';
import type { CreateProjectReq, CreateProjectRes, ListProjectsRes } from '@repo/types';

export const ProjectsApi = {
  list: async () => (await api.get<ListProjectsRes>('/projects')).data,
  create: async (payload: CreateProjectReq) => (await api.post<CreateProjectRes>('/projects', payload)).data,
  get: async (code: string) => (await api.get<CreateProjectRes>(`/projects/${code}`)).data,
};

