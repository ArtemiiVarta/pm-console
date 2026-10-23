import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, X } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ActionButton } from '@/components/ActionButton'
import { FormField } from '@/components/FormField'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { todayISO } from '@/lib/dates'
import { fieldAria } from '@/lib/fieldAria'
import { CURRENCIES } from '@/lib/format'
import { usePortfolioPrefs } from '@/store/usePortfolioPrefs'

const rate = z.number({ error: 'Enter a rate' }).positive('Use more than 0').max(1000, 'Use 1000 or less')

const schema = z.object({
  reportingCurrency: z.enum(CURRENCIES),
  USD: rate,
  EUR: rate,
  GBP: rate,
})

type Values = z.infer<typeof schema>

/** Currencies entered as "1 X = r CAD"; CAD itself is always 1. */
const RATE_CURRENCIES = ['USD', 'EUR', 'GBP'] as const

interface ExchangeRatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Reporting currency and exchange rates used to compare projects in different currencies. */
export function ExchangeRatesDialog({ open, onOpenChange }: ExchangeRatesDialogProps) {
  const { reportingCurrency, fxRates, setReportingCurrency, setFxRates } = usePortfolioPrefs()
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open) reset({ reportingCurrency, USD: fxRates.USD, EUR: fxRates.EUR, GBP: fxRates.GBP })
  }, [open, reportingCurrency, fxRates, reset])

  const onSubmit = (values: Values) => {
    setReportingCurrency(values.reportingCurrency)
    setFxRates({ CAD: 1, USD: values.USD, EUR: values.EUR, GBP: values.GBP }, todayISO())
    toast.success('Exchange rates saved')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exchange rates</DialogTitle>
          <DialogDescription>
            Used only to compare projects in different currencies on this page. Saved in this browser.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <FormField
            id="fx-reporting"
            label="Compare revenue in"
            helper="Tile sizes and the project order use this currency."
          >
            <Controller
              control={control}
              name="reportingCurrency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="fx-reporting"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    {...fieldAria('fx-reporting', undefined, true)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {RATE_CURRENCIES.map((code) => {
              const id = `fx-${code}`
              const error = errors[code]?.message
              return (
                <FormField key={code} id={id} label={`1 ${code} in CAD`} error={error}>
                  <Input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    min={0}
                    className="text-right tabular-nums"
                    {...fieldAria(id, error)}
                    {...register(code, { valueAsNumber: true })}
                  />
                </FormField>
              )
            })}
          </div>
          <DialogFooter>
            <ActionButton
              variant="outline"
              icon={X}
              tooltip="Close without changing anything"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ActionButton>
            <ActionButton type="submit" icon={Save} tooltip="Save the rates for this browser">
              Save rates
            </ActionButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
