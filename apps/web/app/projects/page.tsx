"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Grid, List, ExternalLink } from "lucide-react"
import { useProjects } from "@/lib/api/hooks"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { format } from "date-fns"
import Link from "next/link"
import { useProjectStore } from "@/lib/state/project.store"
import type { ProjectStatus } from "@/lib/types"

const statusColors = {
  ACTIVE: "bg-green-500",
  ON_HOLD: "bg-yellow-500",
  AT_RISK: "bg-red-500",
  ARCHIVED: "bg-gray-500",
}

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects()
  const setProject = useProjectStore((s) => s.set)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "ALL">("ALL")
  const [riskThreshold, setRiskThreshold] = useState(0)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "ALL" || project.status === statusFilter
    const matchesRisk = project.riskScore >= riskThreshold

    return matchesSearch && matchesStatus && matchesRisk
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Manage and track all your projects</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        <div className="flex items-center gap-3">
          <p className="text-muted-foreground">Manage and track all your projects</p>
          <CreateProjectDialog>
            <Button size="sm">New Project</Button>
          </CreateProjectDialog>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ProjectStatus | "ALL")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ON_HOLD">On Hold</SelectItem>
              <SelectItem value="AT_RISK">At Risk</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={riskThreshold.toString()} onValueChange={(value) => setRiskThreshold(Number(value))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">All Risk</SelectItem>
              <SelectItem value="25">Risk ≥ 25%</SelectItem>
              <SelectItem value="50">Risk ≥ 50%</SelectItem>
              <SelectItem value="75">Risk ≥ 75%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")}>
            <Grid className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Projects Display */}
      {viewMode === "grid" ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {project.code}
                      </Badge>
                      <Badge variant="secondary" className={`text-xs ${statusColors[project.status]}`}>
                        {project.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild onClick={() => setProject(project.code)}>
                    <Link href={`/projects/${project.code}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Risk Score</span>
                      <span className="font-medium">{project.riskScore}%</span>
                    </div>
                    <Progress value={project.riskScore} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Owner</span>
                      <p className="font-medium">{project.owner?.name || "Unassigned"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Open Tasks</span>
                      <p className="font-medium">{project.openTasks || 0}</p>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Updated {format(new Date(project.updatedAt), "MMM d, yyyy")}
                    {project.nextDueDate && (
                      <span className="block">Next due: {format(new Date(project.nextDueDate), "MMM d")}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project) => (
            <Card key={project.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{project.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {project.code}
                        </Badge>
                        <Badge variant="secondary" className={`text-xs ${statusColors[project.status]}`}>
                          {project.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{project.owner?.name || "Unassigned"}</p>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{project.riskScore}%</div>
                        <div className="text-muted-foreground">Risk</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{project.openTasks || 0}</div>
                        <div className="text-muted-foreground">Tasks</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">
                          {project.nextDueDate ? format(new Date(project.nextDueDate), "MMM d") : "—"}
                        </div>
                        <div className="text-muted-foreground">Next Due</div>
                      </div>
                    </div>
                  </div>

                  <Button variant="ghost" size="sm" asChild onClick={() => setProject(project.code)}>
                    <Link href={`/projects/${project.code}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No projects found matching your criteria</p>
        </div>
      )}
    </div>
  )
}
