"use client";

import { use, useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Calendar, FileText, CheckSquare, TrendingUp, Plus, Loader2 } from "lucide-react";
import {
  useProject,
  useCreateNote,
  useCreateTask,
  useProjectChatStream,
  type AgentProposedTask,
  type AgentProposedNote,
} from "@/lib/api/hooks";
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
  // const [noteOpen, setNoteOpen] = useState(false);
  // const [md, setMd] = useState("");
  // const [summary, setSummary] = useState("");
  // const [noteType, setNoteType] = useState("GENERAL");
  const [ingestOpen, setIngestOpen] = useState(false);
  const [ingestKind, setIngestKind] = useState<"NOTE" | "TASK" | "DOC">("NOTE");
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestBody, setIngestBody] = useState("");
  const [ingestRaw, setIngestRaw] = useState("");
  const [ingestOccurredAt, setIngestOccurredAt] = useState<string>("");
  const [messages, setMessages] = useState<
    Array<{ id?: string; role: "user" | "assistant"; content: string; createdAt?: string }>
  >([]);
  const [pendingTasks, setPendingTasks] = useState<AgentProposedTask[]>([]);
  const [pendingNotes, setPendingNotes] = useState<AgentProposedNote[]>([]);
  const [processingTask, setProcessingTask] = useState<number | null>(null);
  const [processingNote, setProcessingNote] = useState<number | null>(null);

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

  useEffect(() => {
    if (!chat.metadata) {
      setPendingTasks([]);
      setPendingNotes([]);
      return;
    }
    setPendingTasks(chat.metadata.proposedTasks ?? []);
    setPendingNotes(chat.metadata.proposedNotes ?? []);
  }, [chat.metadata?.version]);

  const references = chat.metadata?.references ?? [];
  const intent = chat.metadata?.intent;

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
              <div className="flex-1 min-h-0 p-2 flex flex-col gap-4">
                <ChatPanel
                  className="flex-1"
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
                {(pendingTasks.length > 0 || pendingNotes.length > 0 || references.length > 0 || intent) && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Agent Suggestions
                      </span>
                      {intent ? (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                          {intent.replace(/_/g, " ")}
                        </Badge>
                      ) : null}
                    </div>
                    {references.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          References
                        </h4>
                        <ul className="space-y-1">
                          {references.map((ref) => (
                            <li key={ref.itemId} className="text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{ref.title || ref.itemId.slice(0, 8)}</span>
                              {ref.kind ? (
                                <span className="ml-2 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground">
                                  {ref.kind}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {pendingTasks.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Proposed Tasks
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setPendingTasks([])}
                            disabled={processingTask !== null}
                          >
                            Dismiss all
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {pendingTasks.map((task, idx) => {
                            const dueLabel = (() => {
                              if (!task.dueDate) return null;
                              const parsed = new Date(task.dueDate);
                              if (Number.isNaN(parsed.getTime())) return null;
                              return format(parsed, "MMM d");
                            })();
                            return (
                              <div
                                key={`${task.title}-${idx}`}
                                className="rounded-md border bg-background/60 p-3 space-y-2"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                                    {task.note ? (
                                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                                        {task.note}
                                      </p>
                                    ) : null}
                                  </div>
                                  {dueLabel ? (
                                    <Badge variant="secondary" className="text-[11px]">
                                      Due {dueLabel}
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => setPendingTasks((prev) => prev.filter((_, i) => i !== idx))}
                                    disabled={processingTask === idx}
                                  >
                                    Dismiss
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8"
                                    disabled={processingTask === idx}
                                    onClick={async () => {
                                      setProcessingTask(idx);
                                      try {
                                        await createTask.mutateAsync({
                                          title: task.title,
                                          status: "todo",
                                          priority: 1,
                                          dueDate: task.dueDate ?? undefined,
                                          source: "MANUAL",
                                        });
                                        setPendingTasks((prev) => prev.filter((_, i) => i !== idx));
                                        toast({
                                          title: "Task created",
                                          description: `Added \"${task.title}\" to the backlog.`,
                                        });
                                      } catch (err: unknown) {
                                        const message = err instanceof Error ? err.message : "Unable to create task";
                                        toast({
                                          title: "Task creation failed",
                                          description: message,
                                          variant: "destructive",
                                        });
                                      } finally {
                                        setProcessingTask(null);
                                      }
                                    }}
                                  >
                                    {processingTask === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add task"}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {pendingNotes.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Proposed Notes
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setPendingNotes([])}
                            disabled={processingNote !== null}
                          >
                            Dismiss all
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {pendingNotes.map((note, idx) => (
                            <div
                              key={`${note.title ?? note.body.slice(0, 20)}-${idx}`}
                              className="rounded-md border bg-background/60 p-3 space-y-2"
                            >
                              {note.title ? (
                                <p className="text-sm font-semibold text-foreground">{note.title}</p>
                              ) : null}
                              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{note.body}</p>
                              {note.tags && note.tags.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {note.tags.map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="secondary"
                                      className="text-[10px] uppercase tracking-wide"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              ) : null}
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => setPendingNotes((prev) => prev.filter((_, i) => i !== idx))}
                                  disabled={processingNote === idx}
                                >
                                  Dismiss
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-8"
                                  disabled={processingNote === idx}
                                  onClick={async () => {
                                    setProcessingNote(idx);
                                    try {
                                      await createNote.mutateAsync({
                                        markdown: note.body,
                                        summaryMarkdown: note.title ?? undefined,
                                        tags: note.tags ?? [],
                                        noteType: "GENERAL",
                                      });
                                      setPendingNotes((prev) => prev.filter((_, i) => i !== idx));
                                      toast({ title: "Note added", description: "Saved to project notes." });
                                    } catch (err: unknown) {
                                      const message = err instanceof Error ? err.message : "Unable to create note";
                                      toast({
                                        title: "Note creation failed",
                                        description: message,
                                        variant: "destructive",
                                      });
                                    } finally {
                                      setProcessingNote(null);
                                    }
                                  }}
                                >
                                  {processingNote === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add note"}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
          <EditProjectDialog project={project}>
            <Button variant="secondary" size="sm">
              Edit Project
            </Button>
          </EditProjectDialog>

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
                        toast({ title: "Ingest queued", description: `Item ${res.id} created` });
                        setIngestTitle("");
                        setIngestBody("");
                        setIngestRaw("");
                        setIngestOccurredAt("");
                        setIngestOpen(false);
                      } catch (e: any) {
                        toast({ title: "Ingest failed", description: e?.message ?? "Unknown error" });
                      }
                    }}
                  >
                    {manualIngest.isPending ? "Ingesting…" : "Ingest"}
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
              {project.tasks?.filter((t) => t.status !== "done").length || 0}
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
