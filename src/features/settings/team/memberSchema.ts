import { z } from 'zod'
import { isEmailTaken } from '@/lib/roster'
import type { TeamMember } from '@/store/types'

export const ROLE_SUGGESTIONS = [
  'Project Manager',
  'Solution Architect',
  'Functional Consultant',
  'Technical Consultant',
  'Developer',
  'Integration Developer',
  'QA Analyst',
  'Business Analyst',
]

const percent = (max: number) =>
  z.number({ error: 'Enter a percentage' }).min(0, 'Use 0 or more').max(max, `Use ${max} or less`)

const rate = z.number({ error: 'Enter a rate' }).min(0, 'Use 0 or more').max(100_000, 'Use 100,000 or less')

/** Member form schema; `others` are checked for a duplicate email. */
export function makeMemberSchema(others: TeamMember[], editingId?: string) {
  return z.object({
    firstName: z.string().trim().min(1, 'Enter a first name').max(60, 'Use 60 characters or fewer'),
    lastName: z.string().trim().min(1, 'Enter a last name').max(60, 'Use 60 characters or fewer'),
    email: z
      .string()
      .trim()
      .min(1, 'Enter an email')
      .pipe(z.email('Enter a valid email, like name@company.com'))
      .refine(
        (email) => !isEmailTaken(others, email, editingId),
        'Another team member already uses this email',
      ),
    role: z.string().trim().min(1, 'Enter or pick a role').max(60, 'Use 60 characters or fewer'),
    defaultLoadPct: percent(200),
    capacityPct: percent(100),
    costRate: rate,
    priceRate: rate,
  })
}

export type MemberValues = z.infer<ReturnType<typeof makeMemberSchema>>

export const emptyMemberValues: MemberValues = {
  firstName: '',
  lastName: '',
  email: '',
  role: '',
  defaultLoadPct: 100,
  capacityPct: 100,
  costRate: 0,
  priceRate: 0,
}

export function toMemberValues(member: TeamMember): MemberValues {
  const { firstName, lastName, email, role, defaultLoadPct, capacityPct, costRate, priceRate } = member
  return { firstName, lastName, email, role, defaultLoadPct, capacityPct, costRate, priceRate }
}
