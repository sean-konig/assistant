"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, FileText, CheckSquare, TrendingUp } from "lucide-react"
import { format } from "date-fns"
import type { Project, Task, Meeting, Note } from "@/lib/types"

interface ProjectOverviewProps {
  project: Project & { tasks: Task[]; meetings: Meeting[]; notes: Note[] }
}

export function ProjectOverview({ project }: ProjectOverviewProps) {
  const recentNotes = project.notes
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)

  const dueSoonTasks = project.tasks
    .filter((task) => task.status !== "DONE" && task.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5)

  const upcomingMeetings = project.meetings
    .filter((meeting) => new Date(meeting.startsAt) > new Date())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .slice(0, 3)

  // Mock risk trend data - in a real app this would come from the API
  const riskTrendData = [65, 70, 68, 72, project.riskScore]

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Recent Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentNotes.map((note) => (
              <div key={note.id} className="border-l-2 border-muted pl-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(note.createdAt), "MMM d, h:mm a")}
                  </span>
                  {note.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm">{note.content}</p>
              </div>
            ))}
            {recentNotes.length === 0 && <p className="text-sm text-muted-foreground">No recent notes</p>}
          </div>
        </CardContent>
      </Card>

      {/* Due Soon Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Due Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dueSoonTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{task.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {task.status.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Due {format(new Date(task.dueDate!), "MMM d")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {dueSoonTasks.length === 0 && <p className="text-sm text-muted-foreground">No upcoming due dates</p>}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Meetings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Meetings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingMeetings.map((meeting) => (
              <div key={meeting.id}>
                <h4 className="font-medium text-sm">{meeting.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-blue-400">{format(new Date(meeting.startsAt), "MMM d, h:mm a")}</span>
                  {meeting.attendees && meeting.attendees.length > 0 && (
                    <span className="text-xs text-muted-foreground">{meeting.attendees.length} attendees</span>
                  )}
                </div>
              </div>
            ))}
            {upcomingMeetings.length === 0 && <p className="text-sm text-muted-foreground">No upcoming meetings</p>}
          </div>
        </CardContent>
      </Card>

      {/* Risk Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Risk Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-2xl font-bold">{project.riskScore}%</div>
            <div className="text-sm text-muted-foreground">
              Current risk level based on task completion, deadlines, and team feedback
            </div>
            {/* Simple sparkline representation */}
            <div className="flex items-end gap-1 h-12">
              {riskTrendData.map((value, index) => (
                <div
                  key={index}
                  className="bg-blue-500 rounded-sm flex-1"
                  style={{ height: `${(value / 100) * 100}%` }}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground">Last 5 weeks</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
