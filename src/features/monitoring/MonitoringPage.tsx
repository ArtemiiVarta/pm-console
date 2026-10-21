import { Activity } from 'lucide-react'
import { ComingSoonPage } from '@/components/ComingSoonPage'

export function MonitoringPage() {
  return (
    <ComingSoonPage
      icon={Activity}
      title="Monitoring"
      description="Track actual hours, status, risks and issues."
    />
  )
}
