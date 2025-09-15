// Projects
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'AT_RISK' | 'ARCHIVED';

export interface ProjectOwner {
  id: string;
  name: string | null;
  email?: string | null;
}

export interface Project {
  id: string;
  name: string;
  code: string;           // slug/code used in routes
  status: ProjectStatus;
  riskScore: number;      // 0..100
  openTasks?: number | null;
  owner?: ProjectOwner | null;
  nextDueDate?: string | null;
  updatedAt: string;
  createdAt: string;
}

// API contracts
export interface CreateProjectReq { name: string; code?: string }
export type CreateProjectRes = Project;
export type ListProjectsRes = Project[];

