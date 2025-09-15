"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, isToday } from "date-fns"
import { AddPrepNoteDialog } from "./add-prep-note-dialog"
import type { Meeting } from "@/lib/types"

interface MeetingsCalendarProps {
  meetings: Meeting[]
  selectedWeek: Date
  onWeekChange: (date: Date) => void
}

export function MeetingsCalendar({ meetings, selectedWeek, onWeekChange }: MeetingsCalendarProps) {
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }) // Sunday
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const getMeetingsForDay = (day: Date) => {
    return meetings
      .filter((meeting) => isSameDay(new Date(meeting.startsAt), day))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }

  const goToPreviousWeek = () => {
    onWeekChange(subWeeks(selectedWeek, 1))
  }

  const goToNextWeek = () => {
    onWeekChange(addWeeks(selectedWeek, 1))
  }

  const goToCurrentWeek = () => {
    onWeekChange(new Date())
  }

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {format(weekStart, "MMMM d")} - {format(weekEnd, "MMMM d, yyyy")}
          </h2>
          <Button variant="outline" size="sm" onClick={goToCurrentWeek}>
            Today
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const dayMeetings = getMeetingsForDay(day)
          const isCurrentDay = isToday(day)

          return (
            <Card key={day.toISOString()} className={`min-h-[200px] ${isCurrentDay ? "ring-2 ring-blue-500" : ""}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm ${isCurrentDay ? "text-blue-600 dark:text-blue-400" : ""}`}>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-normal text-muted-foreground">{format(day, "EEE")}</span>
                    <span
                      className={`text-lg font-semibold ${isCurrentDay ? "bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center" : ""}`}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {dayMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border-l-2 border-blue-500"
                    >
                      <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                        {format(new Date(meeting.startsAt), "h:mm a")}
                      </div>
                      <div className="text-xs font-medium truncate" title={meeting.title}>
                        {meeting.title}
                      </div>
                      {meeting.projectCode && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {meeting.projectCode}
                        </Badge>
                      )}
                      <div className="mt-2">
                        <AddPrepNoteDialog meeting={meeting}>
                          <Button variant="ghost" size="sm" className="h-6 text-xs p-1">
                            Add Prep
                          </Button>
                        </AddPrepNoteDialog>
                      </div>
                    </div>
                  ))}
                  {dayMeetings.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">No meetings</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Week Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Week Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-2xl font-bold">{meetings.length}</div>
              <p className="text-xs text-muted-foreground">Total Meetings</p>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {meetings.reduce((total, meeting) => {
                  if (meeting.endsAt) {
                    const duration = new Date(meeting.endsAt).getTime() - new Date(meeting.startsAt).getTime()
                    return total + Math.round(duration / (1000 * 60 * 60)) // Convert to hours
                  }
                  return total + 1 // Default 1 hour if no end time
                }, 0)}
                h
              </div>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {new Set(meetings.map((m) => m.projectCode).filter(Boolean)).size}
              </div>
              <p className="text-xs text-muted-foreground">Projects Involved</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
