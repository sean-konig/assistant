import { http, HttpResponse } from "msw"
import { mockProjects, mockTasks, mockMeetings, mockNotes, mockDigest } from "./data"

const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"

export const handlers = [
  // Health check
  http.get(`${baseURL}/health`, () => {
    return HttpResponse.json({ status: "ok" })
  }),

  // Projects
  http.get(`${baseURL}/projects`, () => {
    return HttpResponse.json(mockProjects)
  }),

  http.get(`${baseURL}/projects/:code`, ({ params }) => {
    const project = mockProjects.find((p) => p.code === params.code)
    if (!project) {
      return new HttpResponse(null, { status: 404 })
    }

    const projectTasks = mockTasks.filter((t) => t.projectCode === project.code)
    const projectMeetings = mockMeetings.filter((m) => m.projectCode === project.code)
    const projectNotes = mockNotes.filter((n) => n.projectCode === project.code)

    return HttpResponse.json({
      ...project,
      tasks: projectTasks,
      meetings: projectMeetings,
      notes: projectNotes,
    })
  }),

  // Tasks
  http.get(`${baseURL}/tasks/today`, () => {
    const today = new Date().toISOString().split("T")[0]
    const todayTasks = mockTasks.filter((task) => task.dueDate && task.dueDate.startsWith(today))
    return HttpResponse.json(todayTasks)
  }),

  http.get(`${baseURL}/tasks/upcoming`, ({ request }) => {
    const url = new URL(request.url)
    const days = Number.parseInt(url.searchParams.get("days") || "7")
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)

    const upcomingTasks = mockTasks.filter((task) => task.dueDate && new Date(task.dueDate) <= futureDate)
    return HttpResponse.json(upcomingTasks)
  }),

  http.post(`${baseURL}/tasks`, async ({ request }) => {
    const newTask = (await request.json()) as any
    const task = {
      id: Math.random().toString(36).substr(2, 9),
      ...newTask,
      updatedAt: new Date().toISOString(),
    }
    mockTasks.push(task)
    return HttpResponse.json(task)
  }),

  http.patch(`${baseURL}/tasks/:id`, async ({ params, request }) => {
    const updates = (await request.json()) as any
    const taskIndex = mockTasks.findIndex((t) => t.id === params.id)

    if (taskIndex === -1) {
      return new HttpResponse(null, { status: 404 })
    }

    mockTasks[taskIndex] = {
      ...mockTasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    return HttpResponse.json(mockTasks[taskIndex])
  }),

  // Meetings
  http.get(`${baseURL}/meetings/today`, () => {
    const today = new Date().toISOString().split("T")[0]
    const todayMeetings = mockMeetings.filter((meeting) => meeting.startsAt.startsWith(today))
    return HttpResponse.json(todayMeetings)
  }),

  http.get(`${baseURL}/meetings`, ({ request }) => {
    const url = new URL(request.url)
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")

    let filteredMeetings = mockMeetings
    if (from) {
      filteredMeetings = filteredMeetings.filter((m) => m.startsAt >= from)
    }
    if (to) {
      filteredMeetings = filteredMeetings.filter((m) => m.startsAt <= to)
    }

    return HttpResponse.json(filteredMeetings)
  }),

  // Notes
  http.get(`${baseURL}/notes`, ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get("query")
    const project = url.searchParams.get("project")
    const tags = url.searchParams.get("tags")

    let filteredNotes = mockNotes

    if (query) {
      filteredNotes = filteredNotes.filter((note) => note.content.toLowerCase().includes(query.toLowerCase()))
    }

    if (project) {
      filteredNotes = filteredNotes.filter((note) => note.projectCode === project)
    }

    if (tags) {
      const tagList = tags.split(",")
      filteredNotes = filteredNotes.filter((note) => tagList.some((tag) => note.tags.includes(tag)))
    }

    return HttpResponse.json(filteredNotes)
  }),

  http.post(`${baseURL}/notes`, async ({ request }) => {
    const newNote = (await request.json()) as any
    const note = {
      id: Math.random().toString(36).substr(2, 9),
      ...newNote,
      createdAt: new Date().toISOString(),
    }
    mockNotes.push(note)
    return HttpResponse.json(note)
  }),

  // Digest
  http.get(`${baseURL}/digest/latest`, () => {
    return HttpResponse.json(mockDigest)
  }),
]
