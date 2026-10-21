import { makeMemberSchema, emptyMemberValues } from '@/features/settings/team/memberSchema'
import { getTeamTotals } from '@/lib/forecast'
import { getInitials, getRoles, getRosterRows, isEmailTaken, sortRosterRows } from '@/lib/roster'
import type { TeamMember } from '@/store/types'

const W1 = '2026-10-19'
const W2 = '2026-10-26'

function member(id: string, overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: `${id}@example.com`,
    role: 'Developer',
    defaultLoadPct: 100,
    weeklyOverrides: {},
    capacityPct: 100,
    costRate: 100,
    priceRate: 150,
    active: true,
    ...overrides,
  }
}

describe('getRosterRows', () => {
  it('computes weekly hours, rate margin and totals per member', () => {
    const [row] = getRosterRows(
      [member('a', { defaultLoadPct: 50, costRate: 80, priceRate: 100, weeklyOverrides: { [W2]: 100 } })],
      [W1, W2],
      40,
    )
    expect(row).toMatchObject({
      fullName: 'Ada Lovelace',
      weeklyHours: 20,
      marginPerHour: 20,
      marginPct: 0.2,
    })
    expect(row?.totals).toMatchObject({ hours: 60, cost: 4800, revenue: 6000, margin: 1200 })
  })

  it('shows a negative margin when cost exceeds price, and 0% without a price', () => {
    const [loss, free] = getRosterRows(
      [member('a', { costRate: 120, priceRate: 100 }), member('b', { costRate: 50, priceRate: 0 })],
      [W1],
      40,
    )
    expect(loss).toMatchObject({ marginPerHour: -20, marginPct: -0.2 })
    expect(loss?.totals.margin).toBe(-800)
    expect(free).toMatchObject({ marginPerHour: -50, marginPct: 0 })
  })

  it('still lists inactive members, while team totals leave them out', () => {
    const members = [member('a'), member('b', { active: false })]
    expect(getRosterRows(members, [W1], 40)).toHaveLength(2)
    expect(getTeamTotals(members, [W1], 40)).toMatchObject({
      hours: 40,
      cost: 4000,
      revenue: 6000,
      margin: 2000,
    })
  })
})

describe('sortRosterRows', () => {
  const rows = getRosterRows(
    [
      member('a', { firstName: 'Cleo', costRate: 90, role: 'QA Analyst' }),
      member('b', { firstName: 'ada', costRate: 120, role: 'Developer' }),
      member('c', { firstName: 'Bob', costRate: 90, role: 'developer' }),
    ],
    [W1],
    40,
  )
  const ids = (sorted: typeof rows) => sorted.map((row) => row.member.id)

  it('sorts text case-insensitively and numbers numerically, both directions', () => {
    expect(ids(sortRosterRows(rows, 'name', 'asc'))).toEqual(['b', 'c', 'a'])
    expect(ids(sortRosterRows(rows, 'name', 'desc'))).toEqual(['a', 'c', 'b'])
    expect(ids(sortRosterRows(rows, 'costRate', 'desc'))).toEqual(['b', 'a', 'c'])
    expect(ids(sortRosterRows(rows, 'marginPerHour', 'asc'))).toEqual(['b', 'a', 'c'])
  })

  it('keeps the original order for ties', () => {
    expect(ids(sortRosterRows(rows, 'costRate', 'asc'))).toEqual(['a', 'c', 'b'])
  })
})

describe('roster helpers', () => {
  it('builds initials and distinct roles', () => {
    expect(getInitials({ firstName: ' ada', lastName: 'lovelace' })).toBe('AL')
    expect(
      getRoles([
        member('a', { role: 'Developer' }),
        member('b', { role: 'developer ' }),
        member('c', { role: 'QA Analyst' }),
      ]),
    ).toEqual(['Developer', 'QA Analyst'])
  })

  it('detects a taken email ignoring case and spaces, except for the member being edited', () => {
    const members = [member('a', { email: 'Ada@Example.com' })]
    expect(isEmailTaken(members, ' ada@example.COM ')).toBe(true)
    expect(isEmailTaken(members, 'ada@example.com', 'a')).toBe(false)
    expect(isEmailTaken(members, 'bob@example.com')).toBe(false)
  })
})

describe('member schema', () => {
  const others = [member('a', { email: 'ada@example.com' })]
  const values = { ...emptyMemberValues, firstName: 'Bob', lastName: 'Smith', role: 'Developer' }

  it('rejects a duplicate email', () => {
    const result = makeMemberSchema(others).safeParse({ ...values, email: 'ADA@example.com' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Another team member already uses this email')
  })

  it('allows keeping your own email when editing', () => {
    expect(makeMemberSchema(others, 'a').safeParse({ ...values, email: 'ada@example.com' }).success).toBe(
      true,
    )
  })

  it('validates email format and percentage ranges', () => {
    const schema = makeMemberSchema([])
    const messages = (input: object) =>
      schema.safeParse({ ...values, email: 'b@example.com', ...input }).error?.issues.map((i) => i.message)
    expect(messages({ email: 'not-an-email' })).toEqual(['Enter a valid email, like name@company.com'])
    expect(messages({ defaultLoadPct: 201 })).toEqual(['Use 200 or less'])
    expect(messages({ capacityPct: 101 })).toEqual(['Use 100 or less'])
    expect(messages({ costRate: -1 })).toEqual(['Use 0 or more'])
  })
})
