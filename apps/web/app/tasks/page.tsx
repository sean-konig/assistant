"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Grid, List, Plus } from "lucide-react";
import { useTasksToday, useTasksUpcoming, useProjects } from "@/api/hooks";
import { isToday, isTomorrow, isPast } from "date-fns";
import { TaskKanban } from "@/components/tasks/task-kanban";
import { TaskList } from "@/components/tasks/task-list";
import dynamic from "next/dynamic";
// Dynamically import the dialog to avoid SSR context issues during static prerender
const CreateTaskDialog = dynamic(
  () => import("@/components/tasks/create-task-dialog").then((m) => m.CreateTaskDialog),
  { ssr: false }
);
import type { Task, TaskStatus } from "@/lib/types";

export default function TasksPage() {
  const { data: todayTasks = [] } = useTasksToday();
  const { data: upcomingTasks = [] } = useTasksUpcoming(30); // Get tasks for next 30 days
  const { data: projects = [] } = useProjects();

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [projectFilter, setProjectFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<number | "ALL">("ALL");
  const [dueDateFilter, setDueDateFilter] = useState<"ALL" | "TODAY" | "TOMORROW" | "OVERDUE" | "THIS_WEEK">("ALL");

  // Combine all tasks
  const allTasks = [...todayTasks, ...upcomingTasks].reduce((unique, task) => {
    if (!unique.find((t) => t.id === task.id)) {
      unique.push(task);
    }
    return unique;
  }, [] as Task[]);

  // Apply filters
  const filteredTasks = allTasks.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
    const matchesProject = projectFilter === "ALL" || task.projectCode === projectFilter;
    const matchesPriority = priorityFilter === "ALL" || task.priority === priorityFilter;

    let matchesDueDate = true;
    if (dueDateFilter !== "ALL" && task.dueDate) {
      const dueDate = new Date(task.dueDate);
      switch (dueDateFilter) {
        case "TODAY":
          matchesDueDate = isToday(dueDate);
          break;
        case "TOMORROW":
          matchesDueDate = isTomorrow(dueDate);
          break;
        case "OVERDUE":
          matchesDueDate = isPast(dueDate) && !isToday(dueDate);
          break;
        case "THIS_WEEK": {
          const weekFromNow = new Date();
          weekFromNow.setDate(weekFromNow.getDate() + 7);
          matchesDueDate = dueDate <= weekFromNow;
          break;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesProject && matchesPriority && matchesDueDate;
  });

  const taskStats = {
    total: allTasks.length,
    open: allTasks.filter((t) => t.status === "OPEN").length,
    inProgress: allTasks.filter((t) => t.status === "IN_PROGRESS").length,
    blocked: allTasks.filter((t) => t.status === "BLOCKED").length,
    done: allTasks.filter((t) => t.status === "DONE").length,
    overdue: allTasks.filter(
      (t) => t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate)) && t.status !== "DONE"
    ).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">Manage and track all your tasks</p>
        </div>
        <CreateTaskDialog projects={projects}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </CreateTaskDialog>
      </div>

      {/* Task Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{taskStats.total}</div>
            <p className="text-xs text-muted-foreground">Total Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-500">{taskStats.open}</div>
            <p className="text-xs text-muted-foreground">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-500">{taskStats.inProgress}</div>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-500">{taskStats.blocked}</div>
            <p className="text-xs text-muted-foreground">Blocked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-500">{taskStats.done}</div>
            <p className="text-xs text-muted-foreground">Done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{taskStats.overdue}</div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as TaskStatus | "ALL")}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="BLOCKED">Blocked</SelectItem>
                <SelectItem value="DONE">Done</SelectItem>
              </SelectContent>
            </Select>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.code} value={project.code}>
                    {project.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={priorityFilter.toString()}
              onValueChange={(value) => setPriorityFilter(value === "ALL" ? "ALL" : Number(value))}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Priority</SelectItem>
                <SelectItem value="3">High (3)</SelectItem>
                <SelectItem value="2">Medium (2)</SelectItem>
                <SelectItem value="1">Low (1)</SelectItem>
                <SelectItem value="0">None (0)</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dueDateFilter} onValueChange={(value) => setDueDateFilter(value as typeof dueDateFilter)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Due Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Dates</SelectItem>
                <SelectItem value="TODAY">Today</SelectItem>
                <SelectItem value="TOMORROW">Tomorrow</SelectItem>
                <SelectItem value="THIS_WEEK">This Week</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

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

      {/* Tasks Display */}
      {viewMode === "kanban" ? <TaskKanban tasks={filteredTasks} /> : <TaskList tasks={filteredTasks} />}

      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No tasks found matching your criteria</p>
        </div>
      )}
    </div>
  );
}
