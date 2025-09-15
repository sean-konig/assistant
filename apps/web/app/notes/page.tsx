"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Search, Filter, Plus, CalendarIcon, FileText, Tag } from "lucide-react"
import { useNotes, useProjects } from "@/api/hooks"
import { format } from "date-fns"
import { CreateNoteDialog } from "@/components/notes/create-note-dialog"
import { NotesList } from "@/components/notes/notes-list"
import { cn } from "@/lib/utils"

const availableTags = ["risk", "decision", "action", "training", "1:1"]

const tagColors = {
  risk: "bg-red-500",
  decision: "bg-blue-500",
  action: "bg-green-500",
  training: "bg-purple-500",
  "1:1": "bg-yellow-500",
}

export default function NotesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [projectFilter, setProjectFilter] = useState<string>("ALL")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState<Date>()
  const [dateTo, setDateTo] = useState<Date>()

  const { data: projects = [] } = useProjects()
  const { data: notes = [], isLoading } = useNotes(
    searchQuery || undefined,
    projectFilter === "ALL" ? undefined : projectFilter,
    selectedTags.length > 0 ? selectedTags.join(",") : undefined,
    dateFrom?.toISOString(),
    dateTo?.toISOString(),
  )

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const clearFilters = () => {
    setSearchQuery("")
    setProjectFilter("ALL")
    setSelectedTags([])
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  const hasActiveFilters = searchQuery || projectFilter !== "ALL" || selectedTags.length > 0 || dateFrom || dateTo

  // Calculate stats
  const noteStats = {
    total: notes.length,
    byProject: projects.reduce(
      (acc, project) => {
        acc[project.code] = notes.filter((note) => note.projectCode === project.code).length
        return acc
      },
      {} as Record<string, number>,
    ),
    byTag: availableTags.reduce(
      (acc, tag) => {
        acc[tag] = notes.filter((note) => note.tags.includes(tag)).length
        return acc
      },
      {} as Record<string, number>,
    ),
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notes</h1>
          <p className="text-muted-foreground">Capture and organize your thoughts</p>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notes</h1>
          <p className="text-muted-foreground">Capture and organize your thoughts</p>
        </div>
        <CreateNoteDialog projects={projects}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Button>
        </CreateNoteDialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Total Notes</span>
            </div>
            <div className="text-2xl font-bold mt-2">{noteStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Action Items</span>
            </div>
            <div className="text-2xl font-bold mt-2">{noteStats.byTag.action || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Risk Items</span>
            </div>
            <div className="text-2xl font-bold mt-2">{noteStats.byTag.risk || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Decisions</span>
            </div>
            <div className="text-2xl font-bold mt-2">{noteStats.byTag.decision || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear All
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Project Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.code} value={project.code}>
                      {project.name} ({project.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Tags</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className={`cursor-pointer text-xs ${
                      selectedTags.includes(tag) ? tagColors[tag as keyof typeof tagColors] || "bg-gray-500" : ""
                    }`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">From Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-[200px] justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">To Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full sm:w-[200px] justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      <NotesList notes={notes} />

      {notes.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">{hasActiveFilters ? "No notes found" : "No notes yet"}</h3>
          <p className="text-muted-foreground mb-4">
            {hasActiveFilters
              ? "Try adjusting your filters to find what you're looking for."
              : "Start capturing your thoughts and ideas by creating your first note."}
          </p>
          {!hasActiveFilters && (
            <CreateNoteDialog projects={projects}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Note
              </Button>
            </CreateNoteDialog>
          )}
        </div>
      )}
    </div>
  )
}
