"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Square, ChevronRight, ChevronDown, Copy, ArrowUp, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; createdAt?: string };

export function ChatPanel({
  messages,
  streaming,
  streamText,
  onSend,
  onStop,
  className,
  bodyStyle,
  context,
  contextKey,
  contextTitle = "Project Context",
}: {
  messages: ChatMessage[];
  streaming?: boolean;
  streamText?: string;
  onSend: (text: string) => Promise<void> | void;
  onStop?: () => void;
  className?: string;
  bodyStyle?: React.CSSProperties;
  context?: string; // markdown rendered as first assistant bubble
  contextKey?: string; // used to persist the toggle state per project
  contextTitle?: string;
}) {
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const canSend = useMemo(() => !streaming && input.trim().length > 0, [streaming, input]);
  const [showContext, setShowContext] = useState(false);

  // Persist context toggle per project key
  useEffect(() => {
    if (!contextKey) return;
    try {
      const raw = localStorage.getItem(`chat-context:${contextKey}`);
      if (raw === "true" || raw === "false") setShowContext(raw === "true");
    } catch (error) {
      console.error("Error reading chat context from localStorage:", error);
    }
  }, [contextKey]);

  useEffect(() => {
    if (!contextKey) return;
    try {
      localStorage.setItem(`chat-context:${contextKey}`, String(showContext));
    } catch {
      /* empty */
    }
  }, [showContext, contextKey]);

  useEffect(() => {
    // Always follow the newest content; bring the bottom sentinel into view
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streamText]);

  return (
    <div
      className={`rounded-xl border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40 flex flex-col h-full min-h-0 ${className ?? ""}`}
    >
      <div
        ref={containerRef}
        className="flex-1 min-h-0 p-4 overflow-y-auto overscroll-contain space-y-3 pb-28 scroll-smooth snap-y"
        style={bodyStyle}
        aria-live="polite"
      >
        {context && (
          <div className="space-y-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
              onClick={() => setShowContext((v) => !v)}
            >
              {showContext ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {contextTitle}
            </button>
            {showContext && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-lg px-3 py-2 shadow-sm ring-1 ring-inset bg-muted/90 ring-border/50 max-h-48 overflow-auto w-full">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">{contextTitle}</span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(context);
                        } catch {
                          /* empty */
                        }
                      }}
                      aria-label="Copy context"
                      title="Copy"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  </div>
                  <div className="prose prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{context}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id ?? i} className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[70%] rounded-xl px-3 py-2 text-[13px] leading-relaxed shadow-sm ring-1 ring-inset motion-safe:animate-message-appear ${m.role === "assistant" ? "bg-muted/90 ring-border/50" : "bg-primary text-primary-foreground ring-primary/60"}`}
            >
              {m.role === "assistant" ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
              {m.createdAt && (
                <div
                  className={`mt-1 text-[10px] ${m.role === "assistant" ? "text-muted-foreground" : "text-primary-foreground/80"}`}
                >
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-xl px-3 py-2 bg-muted/90 ring-1 ring-border/50 prose prose-invert prose-sm max-w-none motion-safe:animate-message-appear">
              {streamText ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamText}</ReactMarkdown>
              ) : (
                <span className="inline-flex gap-1 items-center">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground/60 animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground/60 animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-foreground/60 animate-bounce"></span>
                </span>
              )}
            </div>
          </div>
        )}
        {/* Bottom sentinel keeps newest content in view */}
        <div ref={bottomRef} className="snap-end" />
      </div>
      <div className="p-3 border-t bg-background/90 sticky bottom-0 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-end gap-2">
          <div className="flex-1 rounded-2xl border bg-muted/30 ring-1 ring-inset ring-border px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/40">
            <textarea
              className="block w-full bg-transparent border-0 outline-none text-sm resize-none mix-h-80 placeholder:text-muted-foreground/70"
              rows={1}
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!canSend) return;
                  const text = input.trim();
                  setInput("");
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  await onSend(text);
                }
              }}
            />
          </div>
          {streaming && onStop ? (
            <Button variant="outline" size="icon" onClick={onStop} className="h-9 w-9 rounded-full">
              <Square className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            disabled={!canSend}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={async () => {
              const text = input.trim();
              if (!text) return;
              setInput("");
              await onSend(text);
            }}
          >
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
