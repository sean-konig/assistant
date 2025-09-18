"use client";

import { use, useEffect, useRef, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Calendar, FileText, CheckSquare, TrendingUp, Plus } from "lucide-react";
import { useProject, useCreateNote, useCreateTask, useProjectChatStream } from "@/lib/api/hooks";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ProjectOverview } from "@/components/projects/project-overview";
import { EditProjectDialog } from "@/components/projects/edit-project-dialog";
import { ProjectTasks } from "@/components/projects/project-tasks";
import { ProjectMeetings } from "@/components/projects/project-meetings";
import { ProjectNotes } from "@/components/projects/project-notes";
import { ChatPanel, type ChatMessage } from "@/components/chat/chat-panel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useManualIngest } from "@/lib/api/hooks";
import { useToast } from "@/components/ui/use-toast";

const statusColors = {
  ACTIVE: "bg-green-500",
  ON_HOLD: "bg-yellow-500",
  AT_RISK: "bg-red-500",
  ARCHIVED: "bg-gray-500",
};

interface ProjectDetailPageProps {
  params: Promise<{ code: string }>;
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { code } = use(params);
  const { data: project, isLoading } = useProject(code);
  const createNote = useCreateNote(code);
  const createTask = useCreateTask(code);
  const chat = useProjectChatStream(code);
  const manualIngest = useManualIngest();
  const { toast } = useToast();
  const [noteOpen, setNoteOpen] = useState(false);
  const [md, setMd] = useState("");
  const [summary, setSummary] = useState("");
  const [noteType, setNoteType] = useState("GENERAL");
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestKind, setIngestKind] = useState<"NOTE" | "TASK" | "DOC">("NOTE");
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestBody, setIngestBody] = useState("");
  const [ingestRaw, setIngestRaw] = useState("");
  const [ingestOccurredAt, setIngestOccurredAt] = useState<string>("");
  const [messages, setMessages] = useState<
    Array<{ id?: string; role: "user" | "assistant"; content: string; createdAt?: string }>
  >([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Sync server messages into local thread
  useEffect(() => {
    if (project?.chat) {
      setMessages(
        project.chat.map((m: { id?: string; role: "user" | "assistant"; content: string; createdAt?: string }) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        }))
      );
    }
  }, [project?.chat]);

  // Auto-scroll on new tokens or message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, chat.reply]);

  //const canSend = useMemo(() => !chat.isStreaming, [chat.isStreaming]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-muted rounded w-1/4"></div>
        </div>
        <div className="h-96 bg-muted rounded animate-pulse"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
        <p className="text-muted-foreground">The project with code &quot;{code}&quot; could not be found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="outline">{project.code}</Badge>
            <Badge variant="secondary" className={`${statusColors[project.status]}`}>
              {project.status.replace("_", " ")}
            </Badge>
          </div>
          {project.owner && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {project.owner.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {project.owner.name} • {project.owner.email}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="default" size="sm">
                Chat
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-xl">
              <SheetHeader>
                <SheetTitle>Project Chat</SheetTitle>
              </SheetHeader>
              <div className="flex-1 min-h-0 p-2">
                <ChatPanel
                  context={`### ${project.name}\n${project.description ? project.description : "_No description yet._"}`}
                  contextKey={project.code}
                  messages={messages as ChatMessage[]}
                  streaming={chat.isStreaming}
                  streamText={chat.reply}
                  onSend={async (text) => {
                    setMessages((prev) => [...prev, { role: "user", content: text }]);
                    const final = await chat.send(text);
                    setMessages((prev) => [...prev, { role: "assistant", content: final }]);
                  }}
                  onStop={() => chat.cancel()}
                />
              </div>
            </SheetContent>
          </Sheet>
          <EditProjectDialog project={project}>
            <Button variant="secondary" size="sm">
              Edit Project
            </Button>
          </EditProjectDialog>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const title = window.prompt("Task title?");
              if (!title) return;
              await createTask.mutateAsync({ title, status: "todo", priority: 1 });
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
          <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Add Project Note (Markdown)</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Note Type</Label>
                  <Select value={noteType} onValueChange={setNoteType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL">General</SelectItem>
                      <SelectItem value="MEETING">Meeting</SelectItem>
                      <SelectItem value="ONE_ON_ONE">1:1</SelectItem>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Markdown</Label>
                  <Textarea
                    rows={10}
                    value={md}
                    onChange={(e) => setMd(e.target.value)}
                    placeholder="# Title\n\nNotes..."
                  />
                </div>
                <div className="space-y-1">
                  <Label>Summary (optional, Markdown)</Label>
                  <Textarea
                    rows={4}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="- Key point 1\n- Key point 2"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNoteOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!md.trim()) return;
                      await createNote.mutateAsync({
                        markdown: md.trim(),
                        summaryMarkdown: summary || undefined,
                        noteType,
                      });
                      setMd("");
                      setSummary("");
                      setNoteOpen(false);
                    }}
                  >
                    Save Note
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Manual Ingest
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Manual Ingestion</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Kind</Label>
                    <Select value={ingestKind} onValueChange={(v) => setIngestKind(v as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select kind" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NOTE">NOTE</SelectItem>
                        <SelectItem value="TASK">TASK</SelectItem>
                        <SelectItem value="DOC">DOC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Occurred At</Label>
                    <Input
                      type="datetime-local"
                      value={ingestOccurredAt}
                      onChange={(e) => setIngestOccurredAt(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Title (optional)</Label>
                  <Input value={ingestTitle} onChange={(e) => setIngestTitle(e.target.value)} placeholder="Title" />
                </div>
                <div className="space-y-1">
                  <Label>Body (plain text)</Label>
                  <Textarea
                    rows={8}
                    value={ingestBody}
                    onChange={(e) => setIngestBody(e.target.value)}
                    placeholder="Plain text body (preferred)"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Raw JSON (optional)</Label>
                  <Textarea
                    rows={6}
                    value={ingestRaw}
                    onChange={(e) => setIngestRaw(e.target.value)}
                    placeholder='{"markdown":"# ...","status":"TODO","dueDate":"2025-09-22"}'
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIngestOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={manualIngest.isPending}
                    onClick={async () => {
                      try {
                        const raw = ingestRaw.trim() ? JSON.parse(ingestRaw) : undefined;
                        const occurredAtIso = ingestOccurredAt ? new Date(ingestOccurredAt).toISOString() : undefined;
                        const res = await manualIngest.mutateAsync({
                          projectId: project.id,
                          kind: ingestKind,
                          title: ingestTitle || undefined,
                          body: ingestBody || undefined,
                          raw,
                          occurredAt: occurredAtIso,
                        });
                        toast({ title: 'Ingest queued', description: `Item ${res.id} created` });
                        setIngestTitle("");
                        setIngestBody("");
                        setIngestRaw("");
                        setIngestOccurredAt("");
                        setIngestOpen(false);
                      } catch (e: any) {
                        toast({ title: 'Ingest failed', description: e?.message ?? 'Unknown error' });
                      }
                    }}
                  >
                    {manualIngest.isPending ? 'Ingesting…' : 'Ingest'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Project Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Risk Score</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{project.riskScore}%</div>
              <Progress value={project.riskScore} className="mt-2 h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Open Tasks</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {project.tasks?.filter((t) => t.status !== "DONE").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Next Due</span>
            </div>
            <div className="text-2xl font-bold mt-2">
              {project.nextDueDate ? format(new Date(project.nextDueDate), "MMM d") : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Notes</span>
            </div>
            <div className="text-2xl font-bold mt-2">{project.notes?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Project Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({project.tasks?.length || 0})</TabsTrigger>
          <TabsTrigger value="meetings">Meetings ({project.meetings?.length || 0})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({project.notes?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ProjectOverview project={project} />
        </TabsContent>

        <TabsContent value="tasks">
          <ProjectTasks tasks={project.tasks || []} projectCode={project.code} />
        </TabsContent>

        <TabsContent value="meetings">
          <ProjectMeetings meetings={project.meetings || []} />
        </TabsContent>

        <TabsContent value="notes">
          <ProjectNotes notes={project.notes || []} projectCode={project.code} />
        </TabsContent>
      </Tabs>

      {/* Chat moved into right-side Sheet */}
    </div>
  );
}
