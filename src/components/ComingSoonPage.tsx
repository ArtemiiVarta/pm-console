import { Construction, type LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'

interface ComingSoonPageProps {
  icon: LucideIcon
  title: string
  description: string
}

/** Placeholder for tabs that are not built yet. */
export function ComingSoonPage({ icon, title, description }: ComingSoonPageProps) {
  return (
    <>
      <PageHeader icon={icon} title={title} description={description} />
      <EmptyState
        icon={Construction}
        title="Coming soon"
        hint="This tab is planned and will be built in a later step."
      />
    </>
  )
}
