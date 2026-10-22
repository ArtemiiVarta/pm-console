import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { useAuth } from '@/features/auth/useAuth'
import { useUiPrefs } from '@/store/useUiPrefs'
import { createInitialData, useAppStore, type NewTeamMember } from '@/store/useAppStore'

const store = () => useAppStore.getState()

const ada: NewTeamMember = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  role: 'Developer',
  costRate: 100,
  priceRate: 150,
}

/** Two phases → weeks of 19 Oct, 26 Oct, 2 Nov (3 weeks). */
function seed() {
  store().addPhase({ name: 'Explore', startDate: '2026-10-19', duration: 2, durationUnit: 'weeks' })
  store().addPhase({ name: 'Realize', startDate: '2026-11-02', duration: 1, durationUnit: 'weeks' })
  const a = store().addMember(ada)
  const b = store().addMember({ ...ada, firstName: 'Bob', email: 'bob@example.com', capacityPct: 50 })
  return { a, b }
}

async function renderGrid() {
  window.location.hash = '#/settings/team'
  render(<App />)
  return within(await screen.findByRole('grid', { name: 'Planned allocation' }))
}

type Grid = ReturnType<typeof within>
type User = ReturnType<typeof userEvent.setup>

const cell = (grid: Grid, row: number, col: number): HTMLElement => {
  const el = grid
    .getAllByRole('gridcell')
    .find((td: HTMLElement) => td.dataset.row === String(row) && td.dataset.col === String(col))
  if (!el) throw new Error(`cell ${row},${col} not found`)
  return el
}

const footerValue = (grid: Grid, label: string, col: number) =>
  grid.getByRole('rowheader', { name: label }).parentElement?.children[col + 1]?.textContent

const save = (user: User) => user.click(screen.getByRole('button', { name: 'Save changes' }))

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialData())
  useAuth.getState().signIn()
})

describe('Planned allocation grid', () => {
  it('shows empty states without weeks or active members', async () => {
    window.location.hash = '#/settings/team'
    render(<App />)
    expect(await screen.findByText('No project weeks yet')).toBeInTheDocument()
  })

  it('renders week columns, phase bands and allocations', async () => {
    seed()
    const grid = await renderGrid()
    expect(grid.getByRole('columnheader', { name: '19 Oct' })).toBeInTheDocument()
    expect(grid.getByRole('columnheader', { name: 'Allocation' })).toBeInTheDocument()
    expect(grid.getByText('Explore')).toBeInTheDocument()
    expect(grid.getByText('Realize')).toBeInTheDocument()
    expect(cell(grid, 0, 0)).toHaveTextContent('100%')
    expect(cell(grid, 0, 0)).toHaveAccessibleName(/allocation$/)
    expect(footerValue(grid, 'Planned hours', 0)).toBe('80')
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })

  it('keeps an edit pending, previewed in the grid, until Save changes', async () => {
    const user = userEvent.setup()
    const { a } = seed()
    const grid = await renderGrid()

    await user.click(cell(grid, 0, 1))
    await user.keyboard('50{Enter}')

    // Not saved yet: the store is unchanged, the grid previews the edit.
    expect(store().members.find((m) => m.id === a)?.weeklyOverrides).toEqual({})
    expect(cell(grid, 0, 1)).toHaveTextContent('50%')
    expect(cell(grid, 0, 1)).toHaveAccessibleName(/weekly override, unsaved$/)
    expect(footerValue(grid, 'Planned hours', 1)).toBe('60')
    expect(footerValue(grid, 'Cost', 1)).toBe('$6,000')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    // Enter moved focus to the next week
    expect(cell(grid, 0, 2)).toHaveFocus()

    await save(user)
    expect(store().members.find((m) => m.id === a)?.weeklyOverrides).toEqual({ '2026-10-26': 50 })
    expect(cell(grid, 0, 1)).toHaveAccessibleName(/weekly override$/)
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })

  it('Discard throws pending edits away', async () => {
    const user = userEvent.setup()
    seed()
    const grid = await renderGrid()
    await user.click(cell(grid, 0, 0))
    await user.keyboard('20{Enter}30{Enter}')
    expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Discard' }))
    expect(cell(grid, 0, 0)).toHaveTextContent('100%')
    expect(store().members[0]?.weeklyOverrides).toEqual({})
  })

  it('saves with Ctrl+S', async () => {
    const user = userEvent.setup()
    seed()
    const grid = await renderGrid()
    await user.click(cell(grid, 1, 0))
    await user.keyboard('70{Enter}{Control>}s{/Control}')
    expect(store().members[1]?.weeklyOverrides).toEqual({ '2026-10-19': 70 })
  })

  it('editing a cell back to its saved value leaves nothing pending', async () => {
    const user = userEvent.setup()
    const { a } = seed()
    store().setWeeklyOverride(a, '2026-10-19', 40)
    const grid = await renderGrid()
    await user.click(cell(grid, 0, 0))
    await user.keyboard('90{Enter}')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    await user.click(cell(grid, 0, 0))
    await user.keyboard('40{Enter}')
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })

  it('flags overallocation above 100%', async () => {
    const user = userEvent.setup()
    seed()
    const grid = await renderGrid()
    await user.click(cell(grid, 1, 0))
    await user.keyboard('120{Enter}')
    expect(cell(grid, 1, 0)).toHaveAccessibleName(/overallocated/)
  })

  it('emptying a cell resets it to the allocation on save', async () => {
    const user = userEvent.setup()
    const { a } = seed()
    store().setWeeklyOverride(a, '2026-10-19', 30)
    const grid = await renderGrid()

    await user.click(cell(grid, 0, 0))
    await user.keyboard('{Enter}{Control>}a{/Control}{Backspace}{Enter}')
    expect(cell(grid, 0, 0)).toHaveTextContent('100%')
    await save(user)
    expect(store().members[0]?.weeklyOverrides).toEqual({})
  })

  it('Escape cancels an edit', async () => {
    const user = userEvent.setup()
    seed()
    const grid = await renderGrid()
    await user.click(cell(grid, 0, 0))
    await user.keyboard('7')
    expect(grid.getByRole('textbox')).toHaveValue('7')
    await user.keyboard('{Escape}')
    expect(grid.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
    expect(cell(grid, 0, 0)).toHaveFocus()
  })

  it('in Hours mode, an edit is converted back to %', async () => {
    const user = userEvent.setup()
    seed()
    const grid = await renderGrid()
    await user.click(screen.getByRole('button', { name: 'Hours' }))
    expect(cell(grid, 0, 0)).toHaveTextContent('40')

    await user.click(cell(grid, 0, 2))
    await user.keyboard('30{Tab}')
    expect(cell(grid, 0, 2)).toHaveTextContent('30')
    await save(user)
    expect(store().members[0]?.weeklyOverrides).toEqual({ '2026-11-02': 75 })
  })

  it('moves with arrow keys and selects a range with Shift', async () => {
    const user = userEvent.setup()
    seed()
    const grid = await renderGrid()
    await user.click(cell(grid, 0, 0))
    await user.keyboard('{ArrowRight}{ArrowDown}')
    expect(cell(grid, 1, 1)).toHaveFocus()

    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(cell(grid, 1, 1)).toHaveAttribute('aria-selected', 'true')
    expect(cell(grid, 1, 2)).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('toolbar', { name: 'Selected cells' })).toHaveTextContent('2 cells selected')
  })

  it('resets a selected range and fills right (as pending changes)', async () => {
    const user = userEvent.setup()
    const { a, b } = seed()
    store().setWeeklyOverrides([
      { memberId: a, weekStart: '2026-10-19', pct: 20 },
      { memberId: b, weekStart: '2026-10-19', pct: 60 },
    ])
    const grid = await renderGrid()

    await user.click(cell(grid, 0, 0))
    await user.keyboard('{Shift>}')
    await user.click(cell(grid, 1, 2))
    await user.keyboard('{/Shift}')
    const toolbar = within(screen.getByRole('toolbar', { name: 'Selected cells' }))
    expect(toolbar.getByText('6 cells selected')).toBeInTheDocument()

    await user.click(toolbar.getByRole('button', { name: 'Fill right' }))
    await save(user)
    expect(store().members[0]?.weeklyOverrides).toMatchObject({ '2026-10-26': 20, '2026-11-02': 20 })
    expect(store().members[1]?.weeklyOverrides).toMatchObject({ '2026-10-26': 60, '2026-11-02': 60 })

    await user.click(toolbar.getByRole('button', { name: 'Reset to default' }))
    await save(user)
    expect(store().members[0]?.weeklyOverrides).toEqual({})
    expect(store().members[1]?.weeklyOverrides).toEqual({})
  })

  it('applies a % to a date range from the row menu', async () => {
    const user = userEvent.setup()
    seed()
    const grid = await renderGrid()
    await user.click(grid.getByRole('button', { name: 'Actions for Bob Lovelace' }))
    await user.click(await screen.findByRole('menuitem', { name: /Apply % to a date range/ }))
    const dialog = within(await screen.findByRole('dialog'))
    const pct = dialog.getByLabelText('Load %')
    await user.clear(pct)
    await user.type(pct, '40')
    await user.click(dialog.getByRole('button', { name: 'Apply' }))
    expect(screen.getByText('3 unsaved changes')).toBeInTheDocument()
    await save(user)
    expect(store().members[1]?.weeklyOverrides).toEqual({
      '2026-10-19': 40,
      '2026-10-26': 40,
      '2026-11-02': 40,
    })
  })

  it('shows weeks before a start date as locked 0%', async () => {
    const user = userEvent.setup()
    const { a } = seed()
    store().updateMember(a, { startDate: '2026-10-28' })
    const grid = await renderGrid()

    expect(cell(grid, 0, 0)).toHaveTextContent('—')
    expect(cell(grid, 0, 0)).toHaveAccessibleName(/0%, 0 h, .*before start date/)
    expect(cell(grid, 0, 1)).toHaveTextContent('100%') // week of 26 Oct contains the start date
    expect(footerValue(grid, 'Planned hours', 0)).toBe('40') // only Bob

    await user.click(cell(grid, 0, 0))
    await user.keyboard('5')
    expect(grid.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('hides the Cost and Revenue rows when financials are hidden', async () => {
    seed()
    useUiPrefs.setState({ showFinancials: false })
    const grid = await renderGrid()
    expect(grid.getByRole('rowheader', { name: 'Developer capacity' })).toBeInTheDocument()
    expect(grid.queryByRole('rowheader', { name: 'Cost' })).not.toBeInTheDocument()
    expect(grid.queryByRole('rowheader', { name: 'Revenue' })).not.toBeInTheDocument()
  })

  it('renders 25 members × 78 weeks', async () => {
    store().addPhase({ name: 'Long', startDate: '2026-01-05', duration: 78, durationUnit: 'weeks' })
    for (let i = 0; i < 25; i += 1)
      store().addMember({ ...ada, firstName: `P${i}`, email: `p${i}@example.com` })
    const started = performance.now()
    const grid = await renderGrid()
    expect(grid.getAllByRole('gridcell')).toHaveLength(25 * 78)
    // Generous budget for a slow CI machine; catches accidental quadratic work.
    expect(performance.now() - started).toBeLessThan(5000)
  })
})
