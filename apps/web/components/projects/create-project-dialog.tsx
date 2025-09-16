"use client";

import type React from "react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCreateProject } from "@/lib/api/hooks";

interface CreateProjectDialogProps {
  children: React.ReactNode;
}

export function CreateProjectDialog({ children }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateProject();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name: name.trim(), code: code.trim() || undefined, description: description || undefined };
    if (!payload.name) return;
    await create.mutateAsync(payload as any);
    setName("");
    setCode("");
    setDescription("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Migration" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="code">Code (optional)</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ACME" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="desc">Description (Markdown)</Label>
            <Textarea id="desc" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="# Project Overview\nGoals, scope, stakeholders..." />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

