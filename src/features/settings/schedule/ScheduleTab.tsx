import { CalendarRange, Construction } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { SectionCard } from '@/components/SectionCard'

export function ScheduleTab() {
  return (
    <SectionCard icon={CalendarRange} title="Phases" description="Project phases and timeline.">
      <EmptyState
        icon={Construction}
        title="Coming soon"
        hint="Phases and the timeline are built in the next step."
      />
    </SectionCard>
  )
}
