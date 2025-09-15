import { MeetingsTodayCard } from "@/components/dashboard/meetings-today-card"
import { TopPrioritiesCard } from "@/components/dashboard/top-priorities-card"
import { ProjectsAtRiskCard } from "@/components/dashboard/projects-at-risk-card"
import { DeepWorkPlannerCard } from "@/components/dashboard/deep-work-planner-card"
import { DigestPreviewCard } from "@/components/dashboard/digest-preview-card"

export default function DashboardPage() {
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
      </div>
    </div>
  )
}
