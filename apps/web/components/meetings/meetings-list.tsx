"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calendar, Users, ExternalLink } from "lucide-react"
import { format, isToday, isTomorrow, isYesterday, startOfDay, differenceInDays } from "date-fns"
import { AddPrepNoteDialog } from "./add-prep-note-dialog"
import type { Meeting } from "@/lib/types"

interface MeetingsListProps {
  meetings: Meeting[]
}

export function MeetingsList({ meetings }: MeetingsListProps) {
  const sortedMeetings = meetings.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  // Group meetings by date
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
        const daysDiff = differenceInDays(date, startOfDay(new Date()))
        if (daysDiff > 0 && daysDiff <= 7) {
          dateKey = format(date, "EEEE") // Day name for this week
        } else {
          dateKey = format(date, "MMMM d, yyyy")
        }
      }

      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(meeting)
      return groups
    },
    {} as Record<string, Meeting[]>,
  )

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">No meetings scheduled</h3>
        <p className="text-muted-foreground">Your calendar is clear for the upcoming period.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedMeetings).map(([dateGroup, dateMeetings]) => (
        <div key={dateGroup}>
          <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">{dateGroup}</h3>
          <div className="space-y-3">
            {dateMeetings.map((meeting) => (
              <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="flex flex-col items-center gap-1 min-w-0">
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {format(new Date(meeting.startsAt), "h:mm")}
                        </div>
                        <div className="text-xs text-muted-foreground">{format(new Date(meeting.startsAt), "a")}</div>
                        {meeting.endsAt && (
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(meeting.endsAt), "h:mm a")}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-sm">{meeting.title}</h4>
                          {meeting.projectCode && (
                            <Badge variant="outline" className="text-xs">
                              {meeting.projectCode}
                            </Badge>
                          )}
                          {meeting.googleEventId && (
                            <Badge variant="secondary" className="text-xs">
                              Google Calendar
                            </Badge>
                          )}
                        </div>

                        {meeting.attendees && meeting.attendees.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <div className="flex items-center gap-2">
                              {meeting.attendees.slice(0, 4).map((attendee, index) => (
                                <Avatar key={index} className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {attendee.name
                                      ?.split(" ")
                                      .map((n) => n[0])
                                      .join("") || "?"}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {meeting.attendees.length > 4 && (
                                <span className="text-xs text-muted-foreground">
                                  +{meeting.attendees.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <AddPrepNoteDialog meeting={meeting}>
                        <Button variant="outline" size="sm">
                          Add Prep Note
                        </Button>
                      </AddPrepNoteDialog>
                      {meeting.googleEventId && (
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
