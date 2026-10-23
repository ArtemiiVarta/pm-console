import { useContext, useEffect, useState } from 'react'
import { Pencil, RotateCcw, Save } from 'lucide-react'
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router-dom'
import { ActionButton } from '@/components/ActionButton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface UnsavedChangesGuardProps {
  /** True while there are unsaved edits. */
  when: boolean
  /** Saves the edits; resolves false when they are invalid, so the user stays to fix them. */
  onSave: () => Promise<boolean>
  /** Throws the edits away, e.g. by resetting the form. */
  onDiscard: () => void
  /** What is unsaved, e.g. "project details". */
  what: string
}

/**
 * Stops in-app navigation (tabs, links, log-out excluded) and closing or reloading the browser tab
 * while `when` is true, and asks whether to save, discard or keep editing.
 */
export function UnsavedChangesGuard(props: UnsavedChangesGuardProps) {
  const { when } = props

  useEffect(() => {
    if (!when) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [when])

  // useBlocker needs a data router; component tests that mount pages in a plain router skip it.
  const dataRouter = useContext(UNSAFE_DataRouterContext)
  return dataRouter ? <NavigationPrompt {...props} /> : null
}

function NavigationPrompt({ when, onSave, onDiscard, what }: UnsavedChangesGuardProps) {
  // Logging out locks the console anyway, so it is never held back.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && nextLocation.pathname !== '/login' && nextLocation.pathname !== currentLocation.pathname,
  )
  const [saving, setSaving] = useState(false)
  const open = blocker.state === 'blocked'

  const save = async () => {
    setSaving(true)
    const saved = await onSave()
    setSaving(false)
    if (saved) blocker.proceed?.()
    else blocker.reset?.()
  }

  const discard = () => {
    onDiscard()
    blocker.proceed?.()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && blocker.reset?.()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save your changes?</DialogTitle>
          <DialogDescription>
            You have unsaved changes to the {what}. Save them before leaving, or discard them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <ActionButton
            variant="outline"
            icon={Pencil}
            tooltip="Stay on this page and keep your changes"
            onClick={() => blocker.reset?.()}
          >
            Keep editing
          </ActionButton>
          <ActionButton
            variant="outline"
            icon={RotateCcw}
            tooltip="Leave and throw the changes away"
            onClick={discard}
          >
            Discard
          </ActionButton>
          <ActionButton icon={Save} tooltip="Save the changes, then leave" onClick={save} disabled={saving}>
            Save
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
