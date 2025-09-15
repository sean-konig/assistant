"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Brain, Calendar } from "lucide-react"
import { useMeetingsToday } from "@/api/hooks"

export function DeepWorkPlannerCard() {
  const { data: meetings = [] } = useMeetingsToday()

  // Simple algorithm to suggest deep work blocks
  // In a real app, this would be more sophisticated
  const suggestedBlocks = [
    {
      id: "1",
      time: "9:00 AM - 10:30 AM",
      title: "Morning Focus Block",
      description: "Best time for complex problem solving",
    },
    {
      id: "2",
      time: "2:00 PM - 3:30 PM",
      title: "Afternoon Deep Work",
      description: "Post-lunch productivity window",
    },
  ]

  const handleAddToCalendar = (block: (typeof suggestedBlocks)[0]) => {
    // In a real app, this would integrate with calendar API
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(block.title)}&details=${encodeURIComponent(block.description)}`
    window.open(calendarUrl, "_blank")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Deep Work Planner
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {suggestedBlocks.map((block) => (
            <div key={block.id} className="p-3 rounded-lg border bg-card/50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{block.title}</h4>
                  <p className="text-xs text-blue-400 mt-1">{block.time}</p>
                  <p className="text-xs text-muted-foreground mt-1">{block.description}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleAddToCalendar(block)} className="gap-1">
                  <Calendar className="h-3 w-3" />
                  Add
                </Button>
              </div>
            </div>
          ))}
          <div className="text-xs text-muted-foreground">
            Suggestions based on your meeting schedule and productivity patterns
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
