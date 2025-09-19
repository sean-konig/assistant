"use client";

import { useMemo, useRef, useState } from "react";

import { MeetingsTodayCard } from "@/components/dashboard/meetings-today-card";
import { TopPrioritiesCard } from "@/components/dashboard/top-priorities-card";
import { ProjectsAtRiskCard } from "@/components/dashboard/projects-at-risk-card";
import { DeepWorkPlannerCard } from "@/components/dashboard/deep-work-planner-card";
import { DigestPreviewCard } from "@/components/dashboard/digest-preview-card";
import { useGlobalChatStream } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageCircle, Send, Maximize2, Minimize2 } from "lucide-react";

const markdownComponents: Components = {
  h2: ({ children }) => (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6 first:mt-0">
      {children}
    </h2>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-foreground">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-foreground">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  code: ({ inline, children }) =>
    inline ? (
      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{children}</code>
    ) : (
      <code className="block rounded bg-muted p-3 text-xs">{children}</code>
    ),
};


export default function DashboardPage() {
  const chat = useGlobalChatStream();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  const parsedReply = useMemo(() => {
    if (!chat.reply) return { human: '', tailRaw: null as string | null, tailPretty: null as string | null };
    const match = chat.reply.match(/```(?:json|yaml)?\s*([\s\S]+?)```\s*$/i);
    const tailRaw = match ? match[1].trim() : null;
    const human = match ? chat.reply.replace(match[0], '').trim() : chat.reply.trim();
    let tailPretty: string | null = null;
    if (tailRaw) {
      try {
        tailPretty = JSON.stringify(JSON.parse(tailRaw), null, 2);
      } catch {
        tailPretty = tailRaw;
      }
    }
    return { human, tailRaw, tailPretty };
  }, [chat.reply]);

  const sheetWidth = fullScreen ? "w-full max-w-full sm:max-w-full" : "sm:max-w-xl";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Your executive overview for today</p>
        </div>
        <Sheet
          open={chatOpen}
          onOpenChange={(open) => {
            setChatOpen(open);
            if (!open) setFullScreen(false);
          }}
        >
          <SheetTrigger asChild>
            <Button variant="default" size="sm" className="inline-flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Chat
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className={`flex h-full flex-col gap-4 p-4 ${sheetWidth}`}
          >
            <SheetHeader className="flex flex-row items-center justify-between space-y-0">
              <SheetTitle>Global Copilot</SheetTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setFullScreen((prev) => !prev)}
                  aria-label={fullScreen ? "Exit full screen" : "Enter full screen"}
                >
                  {fullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </SheetHeader>
            <div className="flex-1 min-h-0 flex flex-col gap-3">
              <div className="flex-1 overflow-auto rounded border bg-muted/40 p-3 text-sm space-y-4">
                {parsedReply.human ? (
                  <div className="space-y-3">
                    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                      {parsedReply.human}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Ask for today's plan to get started.</p>
                )}
                {parsedReply.tailPretty ? (
                  <details className="rounded border border-border/50 bg-background/40 p-3">
                    <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">Machine tail</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
{parsedReply.tailPretty}
                    </pre>
                  </details>
                ) : null}
              </div>
              {chat.error ? <p className="text-sm text-destructive">{chat.error}</p> : null}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  className="flex-1 resize-none rounded border bg-background px-3 py-2 text-sm"
                  rows={1}
                  placeholder="Ask anything…"
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const el = e.currentTarget;
                      const msg = el.value.trim();
                      if (!msg || chat.isStreaming) return;
                      el.value = "";
                      el.style.height = "auto";
                      await chat.send(msg);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={chat.isStreaming}
                  onClick={async () => {
                    const el = inputRef.current;
                    if (!el) return;
                    const msg = el.value.trim();
                    if (!msg) return;
                    el.value = "";
                    el.style.height = "auto";
                    await chat.send(msg);
                  }}
                >
                  {chat.isStreaming ? (
                    "Streaming…"
                  ) : (
                    <>
                      <Send className="mr-1 h-4 w-4" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <MeetingsTodayCard />
        <TopPrioritiesCard />
        <ProjectsAtRiskCard />
        <DeepWorkPlannerCard />
        <div className="md:col-span-2 lg:col-span-3">
          <DigestPreviewCard />
        </div>
      </div>
    </div>
  );
}
