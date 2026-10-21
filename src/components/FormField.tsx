import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  helper?: string
  error?: string
  /** Rendered after the label, e.g. an Info IconButton. */
  labelAction?: ReactNode
  children: ReactNode
}

/** Label above the control, helper text below, error in danger color (CLAUDE.md). */
export function FormField({ id, label, required, helper, error, labelAction, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-7 items-center gap-1">
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="text-danger" aria-hidden>
              {' '}
              *
            </span>
          )}
        </Label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs text-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        helper && (
          <p id={`${id}-helper`} className="text-xs text-muted">
            {helper}
          </p>
        )
      )}
    </div>
  )
}
