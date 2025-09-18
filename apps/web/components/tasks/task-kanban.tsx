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

const statusColors: Record<TaskStatus, string> = {
  todo: "bg-gray-500",
  in_progress: "bg-blue-500",
  done: "bg-green-500",
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

interface TaskKanbanProps {
  tasks: Task[]
}

export function TaskKanban({ tasks }: TaskKanbanProps) {
  const updateTask = useUpdateTask()
  const { toast } = useToast()

  const tasksByStatus: Record<TaskStatus, Task[]> = {
    todo: tasks.filter((task) => task.status === "todo"),
    in_progress: tasks.filter((task) => task.status === "in_progress"),
    done: tasks.filter((task) => task.status === "done"),
  }

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

  const TaskCard = ({ task }: { task: Task }) => {
    const isOverdue =
      task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && task.status !== "done"

    return (
      <Card className="mb-3 hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-2 h-2 rounded-full mt-2 ${priorityColors[task.priority as keyof typeof priorityColors]}`}
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
                {task.projectCode && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {task.projectCode}
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {task.dueDate && (
                  <div
                    className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}
                  >
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.dueDate), "MMM d")}
                  </div>
                )}
                {task.source && (
                  <Badge variant="secondary" className={`text-xs ${sourceColors[task.source]}`}>
                    {task.source.toLowerCase()}
                  </Badge>
                )}
              </div>

              <Select value={task.status} onValueChange={(value) => handleStatusChange(task.id, value as TaskStatus)}>
                <SelectTrigger className="w-24 h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-xs text-muted-foreground">Updated {format(new Date(task.updatedAt), "MMM d")}</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-4">
      {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
        <div key={status}>
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-semibold text-sm">{status.replace("_", " ")}</h3>
            <Badge variant="secondary" className="text-xs">
              {statusTasks.length}
            </Badge>
          </div>
          <div className="space-y-3 min-h-[200px]">
            {statusTasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
