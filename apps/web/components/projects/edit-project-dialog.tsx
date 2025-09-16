"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useUpdateProject } from "@/lib/api/hooks";
import type { Project } from "@/lib/types";

interface EditProjectDialogProps {
  project: Project & { description?: string | null };
  children: React.ReactNode;
}

export function EditProjectDialog({ project, children }: EditProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [code, setCode] = useState(project.code);
  const [description, setDescription] = useState(project.description || "");
  const update = useUpdateProject(project.code);

  useEffect(() => {
    setName(project.name);
    setCode(project.code);
    setDescription(project.description || "");
  }, [project, open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ name: name.trim() || undefined, code: code.trim() || undefined, description });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="code">Code</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="desc">Description (Markdown)</Label>
            <Textarea id="desc" rows={8} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

