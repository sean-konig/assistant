"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Plus } from "lucide-react"
import { format } from "date-fns"
import type { Note } from "@/lib/types"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const tagColors = {
  risk: "bg-red-500",
  decision: "bg-blue-500",
  action: "bg-green-500",
  training: "bg-purple-500",
  "1:1": "bg-yellow-500",
}

interface ProjectNotesProps {
  notes: Note[]
  projectCode: string
}

export function ProjectNotes({ notes, projectCode }: ProjectNotesProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const allTags = Array.from(new Set(notes.flatMap((note) => note.tags)))

  const filteredNotes = notes.filter((note) => {
    const matchesSearch = note.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => note.tags.includes(tag))
    return matchesSearch && matchesTags
  })

  const sortedNotes = filteredNotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => (
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

        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </div>

      <div className="space-y-4">
        {sortedNotes.map((note) => (
          <Card key={note.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
                  </span>
                  {note.authorEmail && <span className="text-sm text-muted-foreground">by {note.authorEmail}</span>}
                </div>
                <div className="flex gap-1">
                  {note.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className={`text-xs ${tagColors[tag as keyof typeof tagColors] || "bg-gray-500"}`}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
              {note.meetingId && <div className="mt-2 text-xs text-muted-foreground">Related to meeting</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {sortedNotes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery || selectedTags.length > 0
              ? "No notes found matching your criteria"
              : "No notes found for this project"}
          </p>
        </div>
      )}
    </div>
  )
}
