import { useState, type ReactElement } from 'react'
import { Trash2, X, type LucideIcon } from 'lucide-react'
import { ActionButton } from '@/components/ActionButton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel?: string
  confirmIcon?: LucideIcon
  onConfirm: () => void
  /** Element that opens the dialog, e.g. a delete IconButton. Omit when controlling `open` yourself. */
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Confirmation step for every destructive action (CLAUDE.md). */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Delete',
  confirmIcon = Trash2,
  onConfirm,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: ConfirmDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="sm:max-w-md"
        // Focus the dialog itself so the title is read first and no button tooltip pops up on open.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement | null)?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <ActionButton
            variant="outline"
            icon={X}
            tooltip="Close without changing anything"
            onClick={() => setOpen(false)}
          >
            Cancel
          </ActionButton>
          <ActionButton
            variant="destructive"
            icon={confirmIcon}
            tooltip="This cannot be undone"
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
          >
            {confirmLabel}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
