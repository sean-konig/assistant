"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { useProjects } from "@/api/hooks"
import { format } from "date-fns"
import Link from "next/link"

const statusColors = {
  ACTIVE: "bg-green-500",
  ON_HOLD: "bg-yellow-500",
  AT_RISK: "bg-red-500",
  ARCHIVED: "bg-gray-500",
}

export function ProjectsAtRiskCard() {
  const { data: projects = [], isLoading } = useProjects()

  const atRiskProjects = projects.filter((project) => project.riskScore >= 60).sort((a, b) => b.riskScore - a.riskScore)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Projects at Risk
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-2 bg-muted rounded w-full"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Projects at Risk
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {atRiskProjects.map((project) => (
            <div key={project.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{project.name}</h4>
                  <Badge variant="outline" className="text-xs">
                    {project.code}
                  </Badge>
                  <Badge variant="secondary" className={`text-xs ${statusColors[project.status]}`}>
                    {project.status.replace("_", " ")}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/projects/${project.code}`}>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Risk Score</span>
                  <span className="font-medium">{project.riskScore}%</span>
                </div>
                <Progress
                  value={project.riskScore}
                  className="h-2"
                  // Use red color for high risk
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Updated {format(new Date(project.updatedAt), "MMM d")}</span>
                {project.openTasks && <span>{project.openTasks} open tasks</span>}
              </div>
            </div>
          ))}
          {atRiskProjects.length === 0 && <p className="text-sm text-muted-foreground">No projects at risk</p>}
        </div>
      </CardContent>
    </Card>
  )
}
