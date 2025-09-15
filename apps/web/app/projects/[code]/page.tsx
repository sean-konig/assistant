"use client"

import { use } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Calendar, FileText, CheckSquare, TrendingUp, Plus } from "lucide-react"
import { useProject } from "@/lib/api/hooks"
import { format } from "date-fns"
import { ProjectOverview } from "@/components/projects/project-overview"
import { ProjectTasks } from "@/components/projects/project-tasks"
import { ProjectMeetings } from "@/components/projects/project-meetings"
import { ProjectNotes } from "@/components/projects/project-notes"

const statusColors = {
  ACTIVE: "bg-green-500",
  ON_HOLD: "bg-yellow-500",
  AT_RISK: "bg-red-500",
  ARCHIVED: "bg-gray-500",
}

interface ProjectDetailPageProps {
  params: Promise<{ code: string }>
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { code } = use(params)
  const { data: project, isLoading } = useProject(code)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/4"></div>
        </div>
        <div className="h-96 bg-muted rounded animate-pulse"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
        <p className="text-muted-foreground">The project with code "{code}" could not be found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="outline">{project.code}</Badge>
            <Badge variant="secondary" className={`${statusColors[project.status]}`}>
              {project.status.replace("_", " ")}
            </Badge>
          </div>
          {project.owner && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {project.owner.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {project.owner.name} • {project.owner.email}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>
      </div>

      {/* Project Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Risk Score</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{project.riskScore}%</div>
              <Progress value={project.riskScore} className="mt-2 h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Open Tasks</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {project.tasks?.filter((t) => t.status !== "DONE").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Next Due</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {project.nextDueDate ? format(new Date(project.nextDueDate), "MMM d") : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Notes</span>
            </div>
            <div className="text-2xl font-bold mt-2">{project.notes?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Project Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({project.tasks?.length || 0})</TabsTrigger>
          <TabsTrigger value="meetings">Meetings ({project.meetings?.length || 0})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({project.notes?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ProjectOverview project={project} />
        </TabsContent>

        <TabsContent value="tasks">
          <ProjectTasks tasks={project.tasks || []} projectCode={project.code} />
        </TabsContent>

        <TabsContent value="meetings">
          <ProjectMeetings meetings={project.meetings || []} />
        </TabsContent>

        <TabsContent value="notes">
          <ProjectNotes notes={project.notes || []} projectCode={project.code} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
