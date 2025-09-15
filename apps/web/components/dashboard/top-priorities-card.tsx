"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Target, Calendar, ArrowRight } from "lucide-react"
import { useTasksToday, useTasksUpcoming } from "@/api/hooks"
import { format } from "date-fns"

const priorityColors = {
  3: "bg-red-500",
  2: "bg-yellow-500",
  1: "bg-blue-500",
  0: "bg-gray-500",
}

const statusColors = {
  OPEN: "bg-gray-500",
  IN_PROGRESS: "bg-blue-500",
  BLOCKED: "bg-red-500",
  DONE: "bg-green-500",
}

export function TopPrioritiesCard() {
  const { data: todayTasks = [] } = useTasksToday()
  const { data: upcomingTasks = [] } = useTasksUpcoming(7)

  // Combine and sort by priority and due date
  const allTasks = [...todayTasks, ...upcomingTasks]
  const topTasks = allTasks
    .filter((task) => task.status !== "DONE")
    .sort((a, b) => {
      // First by priority (higher first)
      if (a.priority !== b.priority) return b.priority - a.priority
      // Then by due date (sooner first)
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      return 0
    })
    .slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Top Priorities
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topTasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card/50">
              <div
                className={`w-2 h-2 rounded-full mt-2 ${priorityColors[task.priority as keyof typeof priorityColors]}`}
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{task.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  {task.projectCode && (
                    <Badge variant="outline" className="text-xs">
                      {task.projectCode}
                    </Badge>
                  )}
                  <Badge variant="secondary" className={`text-xs ${statusColors[task.status]}`}>
                    {task.status.replace("_", " ")}
                  </Badge>
                  {task.dueDate && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(task.dueDate), "MMM d")}
                    </div>
                  )}
                </div>
                {task.source && <p className="text-xs text-muted-foreground mt-1">From {task.source.toLowerCase()}</p>}
              </div>
              <Button variant="ghost" size="sm">
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {topTasks.length === 0 && <p className="text-sm text-muted-foreground">No high priority tasks</p>}
        </div>
      </CardContent>
    </Card>
  )
}
