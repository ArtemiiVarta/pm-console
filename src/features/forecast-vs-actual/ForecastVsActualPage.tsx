import { BarChart3 } from 'lucide-react'
import { ComingSoonPage } from '@/components/ComingSoonPage'

export function ForecastVsActualPage() {
  return (
    <ComingSoonPage
      icon={BarChart3}
      title="Forecast vs Actual"
      description="Compare a forecast baseline with actuals."
    />
  )
}
