import { addDays, format, isValid, parseISO, startOfWeek } from 'date-fns'
import type { ISODate } from '@/store/types'

/** Weeks start on Monday throughout the app. */
export const WEEK_STARTS_ON = 1 as const

/** Parses `yyyy-MM-dd` as a local date. */
export function parseISODate(value: ISODate): Date {
  const date = parseISO(value)
  if (!isValid(date)) throw new Error(`Invalid ISO date: ${value}`)
  return date
}

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

/** Monday of the week containing `value`. */
export function getWeekStart(value: ISODate | Date): ISODate {
  const date = typeof value === 'string' ? parseISODate(value) : value
  return toISODate(startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON }))
}

/** `date` plus whole calendar days (negative to go back). */
export function addDaysISO(date: ISODate, days: number): ISODate {
  return days === 0 ? date : toISODate(addDays(parseISODate(date), days))
}
