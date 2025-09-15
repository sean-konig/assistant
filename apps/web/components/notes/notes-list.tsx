"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Calendar, User } from "lucide-react"
import { format } from "date-fns"
import type { Note } from "@/lib/types"

const tagColors = {
  risk: "bg-red-500",
  decision: "bg-blue-500",
  action: "bg-green-500",
  training: "bg-purple-500",
  "1:1": "bg-yellow-500",
}

interface NotesListProps {
  notes: Note[]
}

export function NotesList({ notes }: NotesListProps) {
  const sortedNotes = notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="space-y-4">
      {sortedNotes.map((note) => (
        <Card key={note.id} className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(note.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
                {note.authorEmail && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{note.authorEmail}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {note.projectCode && (
                  <Badge variant="outline" className="text-xs">
                    {note.projectCode}
                  </Badge>
                )}
                {note.meetingId && (
                  <Badge variant="secondary" className="text-xs">
                    Meeting Note
                  </Badge>
                )}
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
              </div>

              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
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
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
