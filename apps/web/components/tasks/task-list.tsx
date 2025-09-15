"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, MoreHorizontal } from "lucide-react"
import { format, isPast, isToday } from "date-fns"
import { useUpdateTask } from "@/api/hooks"
import { useToast } from "@/hooks/use-toast"
import type { Task, TaskStatus } from "@/lib/types"

const statusColors = {
  OPEN: "bg-gray-500",
  IN_PROGRESS: "bg-blue-500",
  BLOCKED: "bg-red-500",
  DONE: "bg-green-500",
}

const priorityColors = {
  3: "bg-red-500",
  2: "bg-yellow-500",
  1: "bg-blue-500",
  0: "bg-gray-500",
}

const sourceColors = {
  MANUAL: "bg-blue-500",
  EMAIL: "bg-green-500",
  MEETING: "bg-purple-500",
}

interface TaskListProps {
  tasks: Task[]
}

export function TaskList({ tasks }: TaskListProps) {
  const updateTask = useUpdateTask()
  const { toast } = useToast()

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateTask.mutateAsync({ id: taskId, status: newStatus })
      toast({
        title: "Task updated",
        description: "Task status has been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update task status.",
        variant: "destructive",
      })
    }
  }

  const sortedTasks = tasks.sort((a, b) => {
    // Sort by priority first (higher first), then by due date (sooner first)
    if (a.priority !== b.priority) return b.priority - a.priority
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    }
    return 0
  })

  return (
    <div className="space-y-3">
      {sortedTasks.map((task) => {
        const isOverdue =
          task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && task.status !== "DONE"

        return (
          <Card key={task.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className={`w-3 h-3 rounded-full ${priorityColors[task.priority as keyof typeof priorityColors]}`}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{task.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className={`text-xs ${statusColors[task.status]}`}>
                        {task.status.replace("_", " ")}
                      </Badge>
                      {task.projectCode && (
                        <Badge variant="outline" className="text-xs">
                          {task.projectCode}
                        </Badge>
                      )}
                      {task.source && (
                        <Badge variant="secondary" className={`text-xs ${sourceColors[task.source]}`}>
                          {task.source.toLowerCase()}
                        </Badge>
                      )}
                      {task.dueDate && (
                        <div
                          className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}
                        >
                          <Calendar className="h-3 w-3" />
                          Due {format(new Date(task.dueDate), "MMM d")}
                          {isOverdue && <span className="text-red-500 font-medium">(Overdue)</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">Priority {task.priority}</div>
                  <Select
                    value={task.status}
                    onValueChange={(value) => handleStatusChange(task.id, value as TaskStatus)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="BLOCKED">Blocked</SelectItem>
                      <SelectItem value="DONE">Done</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
