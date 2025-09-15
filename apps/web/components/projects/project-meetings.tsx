"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calendar, Users } from "lucide-react"
import { format, isToday, isTomorrow, isYesterday } from "date-fns"
import type { Meeting } from "@/lib/types"

interface ProjectMeetingsProps {
  meetings: Meeting[]
}

export function ProjectMeetings({ meetings }: ProjectMeetingsProps) {
  const sortedMeetings = meetings.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())

  const groupedMeetings = sortedMeetings.reduce(
    (groups, meeting) => {
      const date = new Date(meeting.startsAt)
      let dateKey: string

      if (isToday(date)) {
        dateKey = "Today"
      } else if (isTomorrow(date)) {
        dateKey = "Tomorrow"
      } else if (isYesterday(date)) {
        dateKey = "Yesterday"
      } else {
        dateKey = format(date, "MMMM d, yyyy")
      }

      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(meeting)
      return groups
    },
    {} as Record<string, Meeting[]>,
  )

  return (
    <div className="space-y-6">
      {Object.entries(groupedMeetings).map(([dateGroup, dateMeetings]) => (
        <div key={dateGroup}>
          <h3 className="font-semibold text-sm mb-3">{dateGroup}</h3>
          <div className="space-y-3">
            {dateMeetings.map((meeting) => (
              <Card key={meeting.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-blue-400">
                          {format(new Date(meeting.startsAt), "h:mm a")}
                          {meeting.endsAt && ` - ${format(new Date(meeting.endsAt), "h:mm a")}`}
                        </span>
                      </div>
                      <h4 className="font-medium text-sm mb-2">{meeting.title}</h4>
                      {meeting.attendees && meeting.attendees.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <div className="flex items-center gap-2">
                            {meeting.attendees.slice(0, 3).map((attendee, index) => (
                              <Avatar key={index} className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {attendee.name
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("") || "?"}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {meeting.attendees.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{meeting.attendees.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {meeting.googleEventId && (
                      <Badge variant="outline" className="text-xs">
                        Google Calendar
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {meetings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No meetings found for this project</p>
        </div>
      )}
    </div>
  )
}
