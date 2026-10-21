import { useId, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import { IconButton } from '@/components/IconButton'

interface CalculatedFieldProps {
  label: string
  value: ReactNode
  /** Plain-language formula shown in the Info tooltip, e.g. "Price rate − Cost rate". */
  formula: string
}

/** Read-only calculated value with a muted background and a formula tooltip (CLAUDE.md). */
export function CalculatedField({ label, value, formula }: CalculatedFieldProps) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <span id={id} className="text-sm font-medium">
          {label}
        </span>
        <IconButton icon={Info} label={`How ${label} is calculated`} tooltip={formula} size="icon-sm" />
      </div>
      <div
        aria-labelledby={id}
        className="flex h-9 items-center justify-end rounded-lg border bg-subtle px-3 text-sm tabular-nums"
      >
        {value}
      </div>
    </div>
  )
}
