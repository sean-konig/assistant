export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "AT_RISK" | "ARCHIVED"
export type TaskStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "DONE"

export interface Person {
  id: string
  name: string
  email?: string
  role?: string
}

export interface Project {
  id: string
  name: string
  code: string // short handle e.g., 'VAS'
  status: ProjectStatus
  riskScore: number // 0-100
  owner?: Person
  openTasks?: number
  nextDueDate?: string | null
  updatedAt: string
}

export interface Task {
  id: string
  projectCode?: string
  title: string
  status: TaskStatus
  dueDate?: string | null
  priority: number // 0-3
  source?: "MANUAL" | "EMAIL" | "MEETING"
  updatedAt: string
}

export interface Meeting {
  id: string
  projectCode?: string
  title: string
  startsAt: string
  endsAt?: string | null
  attendees?: Array<{ name?: string; email?: string }>
  googleEventId?: string
}

export interface Note {
  id: string
  projectCode?: string
  meetingId?: string
  authorEmail?: string
  content: string
  tags: string[]
  createdAt: string
}

export interface Digest {
  id: string
  createdAt: string
  markdown: string // rendered into the dashboard preview
}
