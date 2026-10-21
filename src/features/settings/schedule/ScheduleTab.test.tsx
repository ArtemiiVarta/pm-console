import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { useAuth } from '@/features/auth/useAuth'
import { todayISO } from '@/lib/dates'
import { formatDate } from '@/lib/format'
import { createInitialData, useAppStore, type NewPhase } from '@/store/useAppStore'
import type { DurationMode } from '@/store/types'

const store = () => useAppStore.getState()

function seed(phases: NewPhase[], durationMode: DurationMode = 'working') {
  store().updateProject({ durationMode })
  return phases.map((phase) => store().addPhase(phase))
}

function renderSchedule() {
  window.location.hash = '#/settings/schedule'
  render(<App />)
}

const row = (id: string) => screen.getByTestId(`phase-row-${id}`)

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialData())
  useAuth.getState().signIn()
})

describe('Project Schedule', () => {
  it('shows the empty state with an Add phase action', async () => {
    renderSchedule()
    expect(await screen.findByText('No phases yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first phase to define the project timeline')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add phase' })).toBeInTheDocument()
    expect(screen.queryByText('Timeline')).not.toBeInTheDocument()
  })

  describe('end date', () => {
    it.each([
      // start Fri 23 Oct 2026, 3 days
      ['working', 'days', 3, '27 Oct 2026', '(working days)'],
      ['calendar', 'days', 3, '25 Oct 2026', '(calendar days)'],
      ['working', 'weeks', 2, '05 Nov 2026', null],
      ['calendar', 'weeks', 2, '05 Nov 2026', null],
    ] as const)('%s mode, %s: shows %s', async (mode, unit, duration, expected, hint) => {
      const [id] = seed([{ name: 'Build', startDate: '2026-10-23', duration, durationUnit: unit }], mode)
      renderSchedule()
      await screen.findByRole('table', { name: 'Phases' })
      const cells = within(row(id ?? ''))
      expect(cells.getByText(expected)).toBeInTheDocument()
      if (hint) expect(cells.getByText(hint)).toBeInTheDocument()
      else expect(cells.queryByText(/days\)/)).not.toBeInTheDocument()
    })

    it('recalculates when the counting mode changes', async () => {
      const [id] = seed([{ name: 'Build', startDate: '2026-10-23', duration: 3, durationUnit: 'days' }])
      renderSchedule()
      await screen.findByRole('table', { name: 'Phases' })
      expect(within(row(id ?? '')).getByText('27 Oct 2026')).toBeInTheDocument()
      store().updateProject({ durationMode: 'calendar' })
      expect(await within(row(id ?? '')).findByText('25 Oct 2026')).toBeInTheDocument()
    })
  })

  describe('warnings', () => {
    it('flags overlapping phases on both rows', async () => {
      const [a, b] = seed([
        { name: 'Explore', startDate: '2026-10-19', duration: 2, durationUnit: 'weeks' },
        { name: 'Realize', startDate: '2026-10-26', duration: 2, durationUnit: 'weeks' },
      ])
      renderSchedule()
      await screen.findByRole('table', { name: 'Phases' })
      expect(within(row(a ?? '')).getByRole('img', { name: /Overlaps “Realize”/ })).toBeInTheDocument()
      expect(within(row(b ?? '')).getByRole('img', { name: /Overlaps “Explore”/ })).toBeInTheDocument()
    })

    it('flags a gap after the previous phase, and none for back-to-back phases', async () => {
      const [, b, c] = seed([
        { name: 'Prepare', startDate: '2026-10-19', duration: 5, durationUnit: 'days' },
        { name: 'Explore', startDate: '2026-10-26', duration: 5, durationUnit: 'days' },
        { name: 'Realize', startDate: '2026-11-04', duration: 5, durationUnit: 'days' },
      ])
      renderSchedule()
      await screen.findByRole('table', { name: 'Phases' })
      expect(within(row(b ?? '')).queryByRole('img', { name: /Warning/ })).not.toBeInTheDocument()
      expect(
        within(row(c ?? '')).getByRole('img', { name: /2 working days gap after the previous phase/ }),
      ).toBeInTheDocument()
    })
  })

  describe('add phase dialog', () => {
    it('defaults the start to the day after the last phase and adds the phase', async () => {
      const user = userEvent.setup()
      seed([{ name: 'Prepare', startDate: '2026-10-19', duration: 1, durationUnit: 'weeks' }])
      renderSchedule()
      await user.click(await screen.findByRole('button', { name: 'Add phase' }))

      const dialog = within(screen.getByRole('dialog'))
      expect(dialog.getByLabelText(/Start date/)).toHaveTextContent('26 Oct 2026')
      // Default 4 weeks from Mon 26 Oct
      expect(dialog.getByText('22 Nov 2026')).toBeInTheDocument()

      await user.type(dialog.getByLabelText(/Phase name/), 'Explore')
      await user.click(dialog.getByRole('button', { name: 'Add phase' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(store().phases.map((p) => [p.name, p.startDate, p.duration, p.durationUnit])).toEqual([
        ['Prepare', '2026-10-19', 1, 'weeks'],
        ['Explore', '2026-10-26', 4, 'weeks'],
      ])
      expect(await screen.findByText('Phase “Explore” added')).toBeInTheDocument()
    })

    it('defaults the start to today without phases', async () => {
      const user = userEvent.setup()
      renderSchedule()
      await user.click(await screen.findByRole('button', { name: 'Add phase' }))
      expect(within(screen.getByRole('dialog')).getByLabelText(/Start date/)).toHaveTextContent(
        formatDate(todayISO()),
      )
    })

    it('requires a name and a whole, positive duration', async () => {
      const user = userEvent.setup()
      renderSchedule()
      await user.click(await screen.findByRole('button', { name: 'Add phase' }))
      const dialog = within(screen.getByRole('dialog'))
      const duration = dialog.getByLabelText(/Duration/)

      await user.clear(duration)
      await user.type(duration, '0')
      await user.click(dialog.getByRole('button', { name: 'Add phase' }))
      expect(await dialog.findByText('Enter a phase name')).toBeInTheDocument()
      expect(dialog.getByText('Use a duration above 0')).toBeInTheDocument()

      await user.clear(duration)
      await user.type(duration, '1.5')
      await user.click(dialog.getByRole('button', { name: 'Add phase' }))
      expect(await dialog.findByText('Use a whole number')).toBeInTheDocument()
      expect(store().phases).toEqual([])
    })
  })

  describe('inline editing', () => {
    it('edits a row, updates the end date live and saves with Enter', async () => {
      const user = userEvent.setup()
      const [id] = seed([{ name: 'Build', startDate: '2026-10-19', duration: 5, durationUnit: 'days' }])
      renderSchedule()
      await user.click(await screen.findByRole('button', { name: 'Edit Build' }))

      const cells = within(row(id ?? ''))
      const duration = cells.getByLabelText('Duration')
      await user.clear(duration)
      await user.type(duration, '6')
      expect(cells.getByText('26 Oct 2026')).toBeInTheDocument()

      await user.keyboard('{Enter}')
      expect(store().phases[0]?.duration).toBe(6)
      expect(within(row(id ?? '')).getByText('26 Oct 2026')).toBeInTheDocument()
      expect(within(row(id ?? '')).queryByLabelText('Duration')).not.toBeInTheDocument()
    })

    it('opens editing on double-click and cancels with Escape', async () => {
      const user = userEvent.setup()
      const [id] = seed([{ name: 'Build', startDate: '2026-10-19', duration: 5, durationUnit: 'days' }])
      renderSchedule()
      await screen.findByRole('table', { name: 'Phases' })

      await user.dblClick(within(row(id ?? '')).getByText('Build'))
      const name = within(row(id ?? '')).getByLabelText('Phase name')
      expect(name).toHaveFocus()
      await user.clear(name)
      await user.type(name, 'Renamed{Escape}')

      expect(store().phases[0]?.name).toBe('Build')
      expect(within(row(id ?? '')).getByText('Build')).toBeInTheDocument()
    })

    it('blocks saving an empty name', async () => {
      const user = userEvent.setup()
      const [id] = seed([{ name: 'Build', startDate: '2026-10-19', duration: 5, durationUnit: 'days' }])
      renderSchedule()
      await user.click(await screen.findByRole('button', { name: 'Edit Build' }))
      await user.clear(within(row(id ?? '')).getByLabelText('Phase name'))
      await user.click(screen.getByRole('button', { name: 'Save phase' }))
      expect(within(row(id ?? '')).getByText('Enter a phase name')).toBeInTheDocument()
      expect(store().phases[0]?.name).toBe('Build')
    })
  })

  describe('row actions', () => {
    it('starts a phase the day after the previous one ends', async () => {
      const user = userEvent.setup()
      seed([
        { name: 'Prepare', startDate: '2026-10-19', duration: 1, durationUnit: 'weeks' },
        { name: 'Explore', startDate: '2026-11-16', duration: 1, durationUnit: 'weeks' },
      ])
      renderSchedule()
      await user.click(await screen.findByRole('button', { name: 'Start Explore after the previous phase' }))
      expect(store().phases[1]?.startDate).toBe('2026-10-26')
    })

    it('does nothing for the first phase', async () => {
      const user = userEvent.setup()
      seed([{ name: 'Prepare', startDate: '2026-10-19', duration: 1, durationUnit: 'weeks' }])
      renderSchedule()
      const button = await screen.findByRole('button', { name: 'Start Prepare after the previous phase' })
      expect(button).toHaveAttribute('aria-disabled', 'true')
      await user.click(button)
      expect(store().phases[0]?.startDate).toBe('2026-10-19')
    })

    it('duplicates and deletes (after confirming)', async () => {
      const user = userEvent.setup()
      seed([{ name: 'Prepare', startDate: '2026-10-19', duration: 1, durationUnit: 'weeks' }])
      renderSchedule()
      await user.click(await screen.findByRole('button', { name: 'Duplicate Prepare' }))
      expect(store().phases.map((p) => p.name)).toEqual(['Prepare', 'Prepare (copy)'])

      await user.click(screen.getByRole('button', { name: 'Delete Prepare' }))
      const confirm = within(screen.getByRole('dialog'))
      expect(confirm.getByText('Delete “Prepare”?')).toBeInTheDocument()
      await user.click(confirm.getByRole('button', { name: 'Delete' }))
      expect(store().phases.map((p) => p.name)).toEqual(['Prepare (copy)'])
    })
  })

  it('shows a timeline bar per phase with an accessible summary', async () => {
    seed([
      { name: 'Prepare', startDate: '2026-10-19', duration: 1, durationUnit: 'weeks' },
      { name: 'Explore', startDate: '2026-10-26', duration: 3, durationUnit: 'days' },
    ])
    renderSchedule()
    const timeline = within(await screen.findByRole('table', { name: 'Phase timeline' }))
    expect(timeline.getByLabelText('Prepare: 19 Oct 2026 – 25 Oct 2026, 1 week')).toBeInTheDocument()
    expect(timeline.getByLabelText('Explore: 26 Oct 2026 – 28 Oct 2026, 3 days')).toBeInTheDocument()
    expect(timeline.getByText('19 Oct')).toBeInTheDocument()
  })
})
