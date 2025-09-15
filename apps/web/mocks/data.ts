import type { Project, Task, Meeting, Note, Digest } from "@/lib/types"

export const mockProjects: Project[] = [
  {
    id: "1",
    name: "Virtual Assistant System",
    code: "VAS",
    status: "ACTIVE",
    riskScore: 25,
    owner: { id: "1", name: "Sarah Chen", email: "sarah@company.com", role: "Product Manager" },
    openTasks: 8,
    nextDueDate: "2024-01-15",
    updatedAt: "2024-01-10T10:00:00Z",
  },
  {
    id: "2",
    name: "Axis Platform",
    code: "AXIS",
    status: "AT_RISK",
    riskScore: 85,
    owner: { id: "2", name: "Mike Johnson", email: "mike@company.com", role: "Tech Lead" },
    openTasks: 15,
    nextDueDate: "2024-01-12",
    updatedAt: "2024-01-09T15:30:00Z",
  },
  {
    id: "3",
    name: "ReflectAI Integration",
    code: "RAI",
    status: "ACTIVE",
    riskScore: 40,
    owner: { id: "3", name: "Emma Davis", email: "emma@company.com", role: "AI Engineer" },
    openTasks: 5,
    nextDueDate: "2024-01-20",
    updatedAt: "2024-01-08T09:15:00Z",
  },
]

export const mockTasks: Task[] = [
  {
    id: "1",
    projectCode: "VAS",
    title: "Implement voice recognition API",
    status: "IN_PROGRESS",
    dueDate: "2024-01-15",
    priority: 3,
    source: "MANUAL",
    updatedAt: "2024-01-10T10:00:00Z",
  },
  {
    id: "2",
    projectCode: "AXIS",
    title: "Fix authentication bug",
    status: "BLOCKED",
    dueDate: "2024-01-12",
    priority: 3,
    source: "EMAIL",
    updatedAt: "2024-01-09T15:30:00Z",
  },
  {
    id: "3",
    projectCode: "RAI",
    title: "Train new model on customer data",
    status: "OPEN",
    dueDate: "2024-01-18",
    priority: 2,
    source: "MEETING",
    updatedAt: "2024-01-08T09:15:00Z",
  },
  {
    id: "4",
    projectCode: "VAS",
    title: "Update user interface mockups",
    status: "DONE",
    dueDate: "2024-01-10",
    priority: 1,
    source: "MANUAL",
    updatedAt: "2024-01-07T14:20:00Z",
  },
  {
    id: "5",
    projectCode: "AXIS",
    title: "Performance optimization",
    status: "OPEN",
    dueDate: "2024-01-25",
    priority: 2,
    source: "MANUAL",
    updatedAt: "2024-01-06T11:45:00Z",
  },
]

export const mockMeetings: Meeting[] = [
  {
    id: "1",
    projectCode: "VAS",
    title: "Sprint Planning",
    startsAt: "2024-01-11T09:00:00Z",
    endsAt: "2024-01-11T10:00:00Z",
    attendees: [
      { name: "Sarah Chen", email: "sarah@company.com" },
      { name: "John Doe", email: "john@company.com" },
    ],
    googleEventId: "event1",
  },
  {
    id: "2",
    projectCode: "AXIS",
    title: "Architecture Review",
    startsAt: "2024-01-11T14:00:00Z",
    endsAt: "2024-01-11T15:30:00Z",
    attendees: [
      { name: "Mike Johnson", email: "mike@company.com" },
      { name: "Emma Davis", email: "emma@company.com" },
    ],
    googleEventId: "event2",
  },
  {
    id: "3",
    projectCode: "RAI",
    title: "Model Training Discussion",
    startsAt: "2024-01-12T10:00:00Z",
    endsAt: "2024-01-12T11:00:00Z",
    attendees: [{ name: "Emma Davis", email: "emma@company.com" }],
    googleEventId: "event3",
  },
]

export const mockNotes: Note[] = [
  {
    id: "1",
    projectCode: "VAS",
    meetingId: "1",
    authorEmail: "sarah@company.com",
    content: "Discussed API integration timeline. Need to prioritize voice recognition feature.",
    tags: ["decision", "action"],
    createdAt: "2024-01-10T10:30:00Z",
  },
  {
    id: "2",
    projectCode: "AXIS",
    authorEmail: "mike@company.com",
    content: "Authentication bug is blocking deployment. High priority fix needed.",
    tags: ["risk", "action"],
    createdAt: "2024-01-09T16:00:00Z",
  },
  {
    id: "3",
    projectCode: "RAI",
    authorEmail: "emma@company.com",
    content: "Model performance improved by 15% after latest training run.",
    tags: ["training"],
    createdAt: "2024-01-08T11:00:00Z",
  },
  {
    id: "4",
    projectCode: "VAS",
    authorEmail: "john@company.com",
    content: "Weekly 1:1 with Sarah. Discussed career development and project goals.",
    tags: ["1:1"],
    createdAt: "2024-01-07T15:00:00Z",
  },
]

export const mockDigest: Digest = {
  id: "1",
  createdAt: "2024-01-11T06:00:00Z",
  markdown: `# Daily Executive Digest - January 11, 2024

## 🎯 Top Priorities Today
- **AXIS Platform**: Critical authentication bug needs immediate attention
- **VAS Project**: Sprint planning meeting at 9 AM
- **RAI Integration**: Model training discussion scheduled

## ⚠️ Projects at Risk
- **AXIS Platform** (Risk Score: 85%) - Authentication issues blocking deployment
- **RAI Integration** (Risk Score: 40%) - Dependency on external data source

## 📅 Key Meetings
- 9:00 AM - VAS Sprint Planning (Sarah, John)
- 2:00 PM - AXIS Architecture Review (Mike, Emma)

## 📊 Progress Summary
- **15 tasks** completed this week
- **3 projects** on track
- **1 project** needs attention

*Generated at 6:00 AM*`,
}
