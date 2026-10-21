import type { ComponentType } from 'react'
import { CalendarRange, Info, Settings, Users, type LucideIcon } from 'lucide-react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GeneralTab } from '@/features/settings/general/GeneralTab'
import { ScheduleTab } from '@/features/settings/schedule/ScheduleTab'
import { TeamTab } from '@/features/settings/team/TeamTab'

interface SettingsSubTab {
  value: string
  label: string
  icon: LucideIcon
  content: ComponentType
}

const subTabs: SettingsSubTab[] = [
  { value: 'general', label: 'General', icon: Info, content: GeneralTab },
  { value: 'schedule', label: 'Project Schedule', icon: CalendarRange, content: ScheduleTab },
  { value: 'team', label: 'Team Forecast', icon: Users, content: TeamTab },
]

const DEFAULT_TAB = 'general'

function SettingsTabs() {
  const { tab } = useParams()
  const navigate = useNavigate()

  if (!subTabs.some((t) => t.value === tab)) {
    return <Navigate to={`/settings/${DEFAULT_TAB}`} replace />
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => navigate(`/settings/${value}`)}
      className="flex flex-col gap-6"
    >
      <TabsList className="h-auto self-start rounded-full">
        {subTabs.map(({ value, label, icon: Icon }) => (
          <TabsTrigger key={value} value={value} className="gap-2 rounded-full px-4 py-1.5">
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {subTabs.map(({ value, content: Content }) => (
        <TabsContent key={value} value={value} className="mt-0 flex flex-col gap-6">
          <Content />
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function SettingsPage() {
  return (
    <>
      <PageHeader
        icon={Settings}
        title="Project Settings"
        description="Define the project, its schedule and the team forecast."
      />
      <Routes>
        <Route index element={<Navigate to={DEFAULT_TAB} replace />} />
        <Route path=":tab" element={<SettingsTabs />} />
        <Route path="*" element={<Navigate to={`/settings/${DEFAULT_TAB}`} replace />} />
      </Routes>
    </>
  )
}
