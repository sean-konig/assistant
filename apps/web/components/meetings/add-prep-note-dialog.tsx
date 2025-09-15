"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FileText } from "lucide-react"
import { format } from "date-fns"
import { useCreateNote } from "@/api/hooks"
import { useToast } from "@/hooks/use-toast"
import type { Meeting } from "@/lib/types"

const availableTags = ["action", "decision", "risk", "training", "1:1"]

interface AddPrepNoteDialogProps {
  children: React.ReactNode
  meeting: Meeting
}

export function AddPrepNoteDialog({ children, meeting }: AddPrepNoteDialogProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>(["action"])

  const createNote = useCreateNote()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Note content is required.",
        variant: "destructive",
      })
      return
    }

    try {
      await createNote.mutateAsync({
        content: content.trim(),
        projectCode: meeting.projectCode,
        meetingId: meeting.id,
        tags: selectedTags,
        authorEmail: "user@example.com", // In a real app, this would come from auth
      })

      toast({
        title: "Prep note added",
        description: "Your meeting preparation note has been saved.",
      })

      // Reset form
      setContent("")
      setSelectedTags(["action"])
      setOpen(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save prep note. Please try again.",
        variant: "destructive",
      })
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Add Prep Note
          </DialogTitle>
        </DialogHeader>

        {/* Meeting Info */}
        <div className="p-3 bg-muted rounded-lg">
          <h4 className="font-medium text-sm mb-1">{meeting.title}</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{format(new Date(meeting.startsAt), "MMMM d, yyyy 'at' h:mm a")}</span>
            {meeting.projectCode && (
              <Badge variant="outline" className="text-xs">
                {meeting.projectCode}
              </Badge>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Preparation Notes</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add your meeting preparation notes, agenda items, questions, or key points to discuss..."
              rows={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createNote.isPending}>
              {createNote.isPending ? "Saving..." : "Save Prep Note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
