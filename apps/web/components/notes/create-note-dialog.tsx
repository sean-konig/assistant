"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText } from "lucide-react"
import { useCreateNote } from "@/api/hooks"
import { useToast } from "@/hooks/use-toast"
import type { Project } from "@/lib/types"

const availableTags = ["risk", "decision", "action", "training", "1:1"]

const tagColors = {
  risk: "bg-red-500",
  decision: "bg-blue-500",
  action: "bg-green-500",
  training: "bg-purple-500",
  "1:1": "bg-yellow-500",
}

interface CreateNoteDialogProps {
  children: React.ReactNode
  projects: Project[]
}

export function CreateNoteDialog({ children, projects }: CreateNoteDialogProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [projectCode, setProjectCode] = useState<string>("none")
  const [selectedTags, setSelectedTags] = useState<string[]>([])

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
        projectCode: projectCode === "none" ? undefined : projectCode,
        tags: selectedTags,
        authorEmail: "user@example.com", // In a real app, this would come from auth
      })

      toast({
        title: "Note created",
        description: "Your note has been saved successfully.",
      })

      // Reset form
      setContent("")
      setProjectCode("none")
      setSelectedTags([])
      setOpen(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create note. Please try again.",
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create New Note
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here... You can capture thoughts, decisions, action items, meeting notes, or any other important information."
              rows={8}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">Project (Optional)</Label>
            <Select value={projectCode} onValueChange={setProjectCode}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.code} value={project.code}>
                    {project.name} ({project.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
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
            <p className="text-xs text-muted-foreground">
              Click tags to add them to your note. Use tags to categorize and find your notes easily.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createNote.isPending}>
              {createNote.isPending ? "Creating..." : "Create Note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
