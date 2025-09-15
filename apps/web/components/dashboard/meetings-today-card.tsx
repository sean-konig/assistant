"use client"

import { Calendar } from "@/components/ui/calendar"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Users } from "lucide-react"
import { useMeetingsToday } from "@/api/hooks"
import { format } from "date-fns"

export function MeetingsTodayCard() {
  const { data: meetings = [], isLoading } = useMeetingsToday()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Meetings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Today's Meetings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {meetings.slice(0, 4).map((meeting) => (
            <div key={meeting.id} className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-blue-400">
                    {format(new Date(meeting.startsAt), "h:mm a")}
                  </span>
                  {meeting.projectCode && (
                    <Badge variant="outline" className="text-xs">
                      {meeting.projectCode}
                    </Badge>
                  )}
                </div>
                <h4 className="font-medium text-sm">{meeting.title}</h4>
                {meeting.attendees && meeting.attendees.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {meeting.attendees.map((a) => a.name).join(", ")}
                    </span>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" className="text-xs">
                Add Prep
              </Button>
            </div>
          ))}
          {meetings.length === 0 && <p className="text-sm text-muted-foreground">No meetings scheduled for today</p>}
        </div>
      </CardContent>
    </Card>
  )
}
