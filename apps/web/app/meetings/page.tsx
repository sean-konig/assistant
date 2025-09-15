"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, List, Clock, Users, Plus } from "lucide-react"
import { useMeetingsToday, useMeetingsRange } from "@/api/hooks"
import { format, startOfWeek, endOfWeek, addDays } from "date-fns"
import { MeetingsList } from "@/components/meetings/meetings-list"
import { MeetingsCalendar } from "@/components/meetings/meetings-calendar"
import { AddPrepNoteDialog } from "@/components/meetings/add-prep-note-dialog"

export default function MeetingsPage() {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")
  const [selectedWeek, setSelectedWeek] = useState(new Date())

  const { data: todayMeetings = [] } = useMeetingsToday()

  // Get meetings for the current week
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }) // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }) // Sunday
  const { data: weekMeetings = [] } = useMeetingsRange(weekStart.toISOString(), weekEnd.toISOString())

  // Get upcoming meetings (next 2 weeks)
  const twoWeeksFromNow = addDays(new Date(), 14)
  const { data: upcomingMeetings = [] } = useMeetingsRange(new Date().toISOString(), twoWeeksFromNow.toISOString())

  const meetingStats = {
    today: todayMeetings.length,
    thisWeek: weekMeetings.length,
    upcoming: upcomingMeetings.length,
  }

  // Group today's meetings
  const todayMeetingsSorted = todayMeetings.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">View and manage your meetings</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Meeting
        </Button>
      </div>

      {/* Meeting Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Today</span>
            </div>
            <div className="text-2xl font-bold mt-2">{meetingStats.today}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">This Week</span>
            </div>
            <div className="text-2xl font-bold mt-2">{meetingStats.thisWeek}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Upcoming</span>
            </div>
            <div className="text-2xl font-bold mt-2">{meetingStats.upcoming}</div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Meetings - Sticky Section */}
      {todayMeetingsSorted.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
              <Clock className="h-5 w-5" />
              Today's Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayMeetingsSorted.map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between p-3 bg-background rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {format(new Date(meeting.startsAt), "h:mm a")}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">{meeting.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        {meeting.projectCode && (
                          <Badge variant="outline" className="text-xs">
                            {meeting.projectCode}
                          </Badge>
                        )}
                        {meeting.attendees && meeting.attendees.length > 0 && (
                          <span className="text-xs text-muted-foreground">{meeting.attendees.length} attendees</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <AddPrepNoteDialog meeting={meeting}>
                    <Button variant="outline" size="sm">
                      Add Prep Note
                    </Button>
                  </AddPrepNoteDialog>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Toggle and Content */}
      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "list" | "calendar")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="list" className="mt-6">
          <MeetingsList meetings={upcomingMeetings} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <MeetingsCalendar meetings={weekMeetings} selectedWeek={selectedWeek} onWeekChange={setSelectedWeek} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
