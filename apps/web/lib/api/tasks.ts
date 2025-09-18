import { api } from "./axios";

export interface TasksFilter {
  project?: string;
  bucket?: string; // P0,P1,P2,P3
  status?: "todo" | "in_progress" | "done";
  limit?: string;
}

export interface TaskResponse {
  id: string;
  title: string;
  description?: string | null;
  owner: string;
  dueDate?: string | null;
  status: string;
  priorityScore?: number | null;
  priorityBucket?: string | null;
  reason?: unknown; // JSON explanation from prioritizer
  projectId?: string | null;
  projectCode?: string | null;
  sourceItemId?: string | null;
  signals: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RescoreResponse {
  updated: number;
}

export const TasksApi = {
  async create(payload: {
    title: string;
    status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE";
    priority?: number;
    dueDate?: string | null;
    source?: "MANUAL" | "EMAIL" | "MEETING";
    projectCode?: string;
    signals?: string[];
  }): Promise<TaskResponse> {
    const response = await api.post(`/tasks`, payload);
    return response.data;
  },
  async list(filters: TasksFilter = {}): Promise<TaskResponse[]> {
    const params = new URLSearchParams();

    if (filters.project) params.append("project", filters.project);
    if (filters.bucket) params.append("bucket", filters.bucket);
    if (filters.status) params.append("status", filters.status);
    if (filters.limit) params.append("limit", filters.limit);

    const queryString = params.toString();
    const url = `/tasks${queryString ? `?${queryString}` : ""}`;

    const response = await api.get(url);
    return response.data;
  },

  async rescore(project?: string): Promise<RescoreResponse> {
    const params = new URLSearchParams();
    if (project) params.append("project", project);

    const queryString = params.toString();
    const url = `/tasks/rescore${queryString ? `?${queryString}` : ""}`;

    const response = await api.post(url);
    return response.data;
  },
};
