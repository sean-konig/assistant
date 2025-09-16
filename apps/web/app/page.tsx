"use client";
import { MeetingsTodayCard } from "@/components/dashboard/meetings-today-card"
import { TopPrioritiesCard } from "@/components/dashboard/top-priorities-card"
import { ProjectsAtRiskCard } from "@/components/dashboard/projects-at-risk-card"
import { DeepWorkPlannerCard } from "@/components/dashboard/deep-work-planner-card"
import { DigestPreviewCard } from "@/components/dashboard/digest-preview-card"
import { useCoreChatStream } from "@/lib/api/hooks"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Send } from "lucide-react"

export default function DashboardPage() {
  const chat = useCoreChatStream()
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your executive overview for today</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Today's Meetings - spans 1 column */}
        <MeetingsTodayCard />

        {/* Top Priorities - spans 1 column */}
        <TopPrioritiesCard />

        {/* Projects at Risk - spans 1 column */}
        <ProjectsAtRiskCard />

        {/* Deep Work Planner - spans 1 column */}
        <DeepWorkPlannerCard />

        {/* Digest Preview - spans 2 columns on larger screens */}
        <div className="md:col-span-2 lg:col-span-2">
          <DigestPreviewCard />
        </div>
        <div className="md:col-span-2 lg:col-span-3 border rounded p-4 space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Assistant</h2>
            <p className="text-xs text-muted-foreground">Core agent (streaming)</p>
          </div>
          {chat.reply && (
            <div className="prose prose-invert text-sm border rounded p-3 bg-muted/40 max-h-64 overflow-auto">{chat.reply}</div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              className="flex-1 bg-background border rounded px-3 py-2 text-sm resize-none max-h-40"
              rows={1}
              placeholder="Ask anything…"
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`
              }}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  const el = e.currentTarget
                  const msg = el.value.trim()
                  if (!msg || chat.isStreaming) return
                  el.value = ''
                  el.style.height = 'auto'
                  await chat.send(msg)
                }
              }}
            />
            <Button size="sm" disabled={chat.isStreaming} onClick={async () => {
              const el = inputRef.current
              if (!el) return
              const msg = el.value.trim()
              if (!msg) return
              el.value = ''
              el.style.height = 'auto'
              await chat.send(msg)
            }}>{chat.isStreaming ? 'Streaming…' : <><Send className="h-4 w-4 mr-1"/>Send</>}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
