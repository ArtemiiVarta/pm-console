import { ClipboardList } from 'lucide-react'
import { ComingSoonPage } from '@/components/ComingSoonPage'

export function PlanningPage() {
  return (
    <ComingSoonPage
      icon={ClipboardList}
      title="Planning"
      description="Plan tasks and sprints against team capacity."
    />
  )
}
