"use client"

import { useEffect, useMemo, useState } from "react"
import type { Project, Task, Meeting, Note, Digest } from "@/lib/types"
import { mockProjects, mockTasks, mockMeetings, mockNotes, mockDigest } from "@/mocks/data"

type AsyncState<T> = { data: T | undefined; isLoading: boolean; error?: unknown }

function useMockData<T>(resolver: () => T): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, isLoading: true })
  useEffect(() => {
    // Simulate async fetch
    const id = setTimeout(() => {
      try {
        setState({ data: resolver(), isLoading: false })
      } catch (e) {
        setState({ data: undefined, isLoading: false, error: e })
      }
    }, 0)
    return () => clearTimeout(id)
  }, [resolver])
  return state
}

export function useProjects() {
  return useMockData<Project[]>(() => mockProjects)
}

export function useProject(code?: string) {
  return useMockData<Project | undefined>(() => mockProjects.find((p) => p.code === code))
}

export function useNotes(projectCode?: string) {
  return useMockData<Note[]>(() =>
    projectCode ? mockNotes.filter((n) => n.projectCode === projectCode) : mockNotes,
  )
}

export function useCreateNote() {
  const [isPending, setIsPending] = useState(false)
  return useMemo(
    () => ({
      isPending,
      mutateAsync: async (_: {
        projectCode?: string
        meetingId?: string
        content: string
        tags?: string[]
        authorEmail?: string
      }) => {
        setIsPending(true)
        try {
          return { ok: true } as const
        } finally {
          setIsPending(false)
        }
      },
    }),
    [isPending],
  )
}

export function useUpdateTask() {
  const [isPending, setIsPending] = useState(false)
  return useMemo(
    () => ({
      isPending,
      mutateAsync: async (_: { id: string; status?: Task["status"]; title?: string }) => {
        setIsPending(true)
        try {
          return { ok: true } as const
        } finally {
          setIsPending(false)
        }
      },
    }),
    [isPending],
  )
}

export function useCreateTask() {
  const [isPending, setIsPending] = useState(false)
  return useMemo(
    () => ({
      isPending,
      mutateAsync: async (_: {
        title: string
        projectCode?: string
        status: Task["status"]
        priority: number
        dueDate?: string
        source?: Task["source"]
      }) => {
        setIsPending(true)
        try {
          return { ok: true } as const
        } finally {
          setIsPending(false)
        }
      },
    }),
    [isPending],
  )
}

export function useTasksToday() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  return useMockData<Task[]>(() =>
    mockTasks.filter((t) => {
      if (!t.dueDate) return false
      const d = new Date(t.dueDate)
      return d >= start && d < end
    }),
  )
}

export function useTasksUpcoming(days: number) {
  const now = new Date()
  const end = new Date(now)
  end.setDate(end.getDate() + days)
  return useMockData<Task[]>(() =>
    mockTasks.filter((t) => {
      if (!t.dueDate) return false
      const d = new Date(t.dueDate)
      return d >= now && d <= end
    }),
  )
}

export function useMeetingsToday() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  return useMockData<Meeting[]>(() =>
    mockMeetings.filter((m) => {
      const d = new Date(m.startsAt)
      return d >= start && d < end
    }),
  )
}

export function useMeetingsRange(startISO: string, endISO: string) {
  const start = new Date(startISO)
  const end = new Date(endISO)
  return useMockData<Meeting[]>(() =>
    mockMeetings.filter((m) => {
      const d = new Date(m.startsAt)
      return d >= start && d <= end
    }),
  )
}

export function useLatestDigest() {
  return useMockData<Digest>(() => mockDigest)
}
