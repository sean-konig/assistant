"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatMessage = { id?: string; role: "user" | "assistant"; content: string; createdAt?: string };

export function ChatPanel({
  title,
  subtitle,
  messages,
  streaming,
  streamText,
  onSend,
  onStop,
}: {
  title: string;
  subtitle?: string;
  messages: ChatMessage[];
  streaming?: boolean;
  streamText?: string;
  onSend: (text: string) => Promise<void> | void;
  onStop?: () => void;
}) {
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canSend = useMemo(() => !streaming && input.trim().length > 0, [streaming, input]);

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, streamText]);

  return (
    <div className="rounded-xl border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
      <div className="px-4 py-3 border-b">
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div ref={containerRef} className="p-4 h-[60vh] overflow-auto space-y-3">
        {messages.map((m, i) => (
          <div key={m.id ?? i} className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 ${m.role === "assistant" ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
              {m.role === "assistant" ? (
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                m.content
              )}
              {m.createdAt && (
                <div className={`mt-1 text-[10px] ${m.role === "assistant" ? "text-muted-foreground" : "text-primary-foreground/80"}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && (
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-lg px-3 py-2 bg-muted prose prose-invert max-w-none">
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
      </div>
      <div className="p-3 border-t">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 bg-background border rounded px-3 py-2 text-sm resize-none max-h-40"
            rows={1}
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!canSend) return;
                const text = input.trim();
                setInput('');
                const el = e.currentTarget; el.style.height = 'auto';
                await onSend(text);
              }
            }}
          />
          {streaming && onStop ? (
            <Button variant="outline" size="sm" onClick={onStop}><Square className="h-4 w-4 mr-1"/>Stop</Button>
          ) : null}
          <Button size="sm" disabled={!canSend} onClick={async () => { const text = input.trim(); if (!text) return; setInput(''); await onSend(text); }}>
            <Send className="h-4 w-4 mr-1"/>Send
          </Button>
        </div>
      </div>
    </div>
  );
}

