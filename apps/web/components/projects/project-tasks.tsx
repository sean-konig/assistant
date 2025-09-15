"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Grid, List } from "lucide-react"
import { format } from "date-fns"
import type { Task } from "@/lib/types"

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

interface ProjectTasksProps {
  tasks: Task[]
  projectCode: string
}

export function ProjectTasks({ tasks, projectCode }: ProjectTasksProps) {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban")

  const tasksByStatus = {
    OPEN: tasks.filter((task) => task.status === "OPEN"),
    IN_PROGRESS: tasks.filter((task) => task.status === "IN_PROGRESS"),
    BLOCKED: tasks.filter((task) => task.status === "BLOCKED"),
    DONE: tasks.filter((task) => task.status === "DONE"),
  }

  const TaskCard = ({ task }: { task: Task }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-2 h-2 rounded-full mt-2 ${priorityColors[task.priority as keyof typeof priorityColors]}`}
          />
          <div className="flex-1">
            <h4 className="font-medium text-sm">{task.title}</h4>
            <div className="flex items-center gap-2 mt-2">
              {task.dueDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(task.dueDate), "MMM d")}
                </div>
              )}
              {task.source && (
                <Badge variant="outline" className="text-xs">
                  {task.source.toLowerCase()}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("kanban")}
          >
            <Grid className="h-4 w-4 mr-2" />
            Kanban
          </Button>
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="grid gap-6 md:grid-cols-4">
          {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
            <div key={status}>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-semibold text-sm">{status.replace("_", " ")}</h3>
                <Badge variant="secondary" className="text-xs">
                  {statusTasks.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {statusTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`w-3 h-3 rounded-full ${priorityColors[task.priority as keyof typeof priorityColors]}`}
                    />
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className={`text-xs ${statusColors[task.status]}`}>
                          {task.status.replace("_", " ")}
                        </Badge>
                        {task.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            Due {format(new Date(task.dueDate), "MMM d")}
                          </span>
                        )}
                        {task.source && (
                          <Badge variant="outline" className="text-xs">
                            {task.source.toLowerCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Select defaultValue={task.status}>
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No tasks found for this project</p>
        </div>
      )}
    </div>
  )
}
