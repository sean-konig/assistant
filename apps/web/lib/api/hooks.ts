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
      const p = await ProjectsApi.get(code!);
      const withExtras: UiProject & { tasks: Task[]; meetings: Meeting[]; notes: Note[] } = {
        // API returns superset of UI fields; spread and coerce
        ...(p as unknown as UiProject),
        tasks: [],
        meetings: [],
        notes: [],
      };
      return withExtras;
    },
  });
}
