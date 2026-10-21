import { ProjectDetailsForm } from '@/features/settings/general/ProjectDetailsForm'
import { ProjectStats } from '@/features/settings/general/ProjectStats'

export function GeneralTab() {
  return (
    <>
      <ProjectDetailsForm />
      <ProjectStats />
    </>
  )
}
