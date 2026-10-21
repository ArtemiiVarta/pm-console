import { Construction, Users } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { SectionCard } from '@/components/SectionCard'

export function TeamTab() {
  return (
    <SectionCard icon={Users} title="Team members" description="Roster, weekly assignment and baselines.">
      <EmptyState
        icon={Construction}
        title="Coming soon"
        hint="The team forecast is built in a later step."
      />
    </SectionCard>
  )
}
