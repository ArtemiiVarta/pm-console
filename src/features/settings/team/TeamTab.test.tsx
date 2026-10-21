import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { useAuth } from '@/features/auth/useAuth'
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

function seedPhase() {
  // 2 project weeks
  store().addPhase({ name: 'Build', startDate: '2026-10-19', duration: 2, durationUnit: 'weeks' })
}

function renderTeam() {
  window.location.hash = '#/settings/team'
  render(<App />)
}

const totals = () => within(screen.getByRole('region', { name: 'Forecast totals' }))
const roster = () => within(screen.getByRole('table', { name: 'Team members' }))

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialData())
  useAuth.getState().signIn()
})

describe('Team Forecast roster', () => {
  it('shows the empty state, the no-phases notice and the baseline slot', async () => {
    renderTeam()
    expect(await screen.findByText('No team members yet')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent('Add phases to set the project duration')
    expect(screen.getByRole('link', { name: 'Go to Project Schedule' })).toHaveAttribute(
      'href',
      '#/settings/schedule',
    )
    expect(screen.getByTestId('baseline-bar-slot')).toBeInTheDocument()
  })

  it('hides the notice once there are phases', async () => {
    seedPhase()
    renderTeam()
    await screen.findByText('No team members yet')
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('adds a member through the dialog with a live margin preview', async () => {
    const user = userEvent.setup()
    seedPhase()
    renderTeam()
    await user.click(await screen.findByRole('button', { name: 'Add team member' }))
    const dialog = within(screen.getByRole('dialog'))

    await user.type(dialog.getByLabelText(/First name/), 'Grace')
    await user.type(dialog.getByLabelText(/Last name/), 'Hopper')
    await user.type(dialog.getByLabelText(/Email/), 'grace@example.com')
    await user.type(dialog.getByLabelText(/Role/), 'Solution Architect')
    const cost = dialog.getByLabelText(/Cost rate/)
    const price = dialog.getByLabelText(/Price rate/)
    await user.clear(cost)
    await user.type(cost, '120')
    await user.clear(price)
    await user.type(price, '100')

    // Negative margin turns the preview red with a "Negative" icon
    expect(dialog.getAllByLabelText('Negative')).toHaveLength(2)
    expect(dialog.getByText('-$20.00')).toBeInTheDocument()
    expect(dialog.getByText('-20%')).toBeInTheDocument()

    await user.clear(price)
    await user.type(price, '160')
    expect(dialog.getByText('$40.00')).toBeInTheDocument()
    expect(dialog.getByText('25%')).toBeInTheDocument()

    await user.click(dialog.getByRole('button', { name: 'Add team member' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(store().members[0]).toMatchObject({
      firstName: 'Grace',
      email: 'grace@example.com',
      role: 'Solution Architect',
      defaultLoadPct: 100,
      capacityPct: 100,
      costRate: 120,
      priceRate: 160,
      active: true,
    })
    expect(roster().getByText('Grace Hopper')).toBeInTheDocument()
  })

  it('rejects a duplicate email', async () => {
    const user = userEvent.setup()
    store().addMember(ada)
    renderTeam()
    await user.click(await screen.findByRole('button', { name: 'Add team member' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText(/First name/), 'Ada')
    await user.type(dialog.getByLabelText(/Last name/), 'Byron')
    await user.type(dialog.getByLabelText(/Email/), 'ADA@example.com')
    await user.type(dialog.getByLabelText(/Role/), 'Developer')
    await user.click(dialog.getByRole('button', { name: 'Add team member' }))

    expect(await dialog.findByText('Another team member already uses this email')).toBeInTheDocument()
    expect(store().members).toHaveLength(1)
  })

  it('edits a member and keeps their own email valid', async () => {
    const user = userEvent.setup()
    store().addMember(ada)
    renderTeam()
    await user.click(await screen.findByRole('button', { name: 'Edit Ada Lovelace' }))
    const dialog = within(screen.getByRole('dialog'))
    const role = dialog.getByLabelText(/Role/)
    await user.clear(role)
    await user.type(role, 'Project Manager')
    await user.click(dialog.getByRole('button', { name: 'Save' }))
    expect(store().members[0]).toMatchObject({ role: 'Project Manager', email: 'ada@example.com' })
  })

  it('duplicates into a prefilled dialog that needs a new email', async () => {
    const user = userEvent.setup()
    store().addMember({ ...ada, weeklyOverrides: { '2026-10-19': 50 } })
    renderTeam()
    await user.click(await screen.findByRole('button', { name: 'Duplicate Ada Lovelace' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByLabelText(/Role/)).toHaveValue('Developer')
    expect(dialog.getByLabelText(/Email/)).toHaveValue('')

    await user.type(dialog.getByLabelText(/Email/), 'ada2@example.com')
    await user.click(dialog.getByRole('button', { name: 'Add team member' }))
    expect(store().members).toHaveLength(2)
    expect(store().members[1]).toMatchObject({
      email: 'ada2@example.com',
      weeklyOverrides: { '2026-10-19': 50 },
    })
  })

  it('excludes inactive members from totals and greys them out', async () => {
    const user = userEvent.setup()
    seedPhase()
    store().addMember(ada)
    store().addMember({ ...ada, firstName: 'Bob', email: 'bob@example.com', costRate: 50, priceRate: 100 })
    renderTeam()
    await screen.findByRole('table', { name: 'Team members' })

    // 2 members × 2 weeks × 40 h
    expect(totals().getByText('160')).toBeInTheDocument()
    expect(roster().getByText(/Totals · 2 active/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Deactivate Bob Lovelace' }))
    expect(store().members[1]?.active).toBe(false)
    expect(totals().getByText('80')).toBeInTheDocument()
    expect(roster().getByText(/Totals · 1 active/)).toBeInTheDocument()
    expect(roster().getByText('Inactive')).toBeInTheDocument()
    // Total margin: Ada only, 80 h × $50
    expect(totals().getByText('$4,000')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Activate Bob Lovelace' }))
    expect(totals().getByText('160')).toBeInTheDocument()
  })

  it('sorts by a column and toggles direction', async () => {
    const user = userEvent.setup()
    store().addMember({ ...ada, firstName: 'Cleo', email: 'c@example.com', priceRate: 200 })
    store().addMember({ ...ada, firstName: 'Ada', email: 'a@example.com', priceRate: 120 })
    renderTeam()
    await screen.findByRole('table', { name: 'Team members' })
    const names = () =>
      roster()
        .getAllByText(/Lovelace$/)
        .map((el) => el.textContent)

    expect(names()).toEqual(['Ada Lovelace', 'Cleo Lovelace'])
    await user.click(screen.getByRole('button', { name: 'Price/h' }))
    expect(names()).toEqual(['Ada Lovelace', 'Cleo Lovelace'])
    expect(screen.getByRole('columnheader', { name: 'Price/h' })).toHaveAttribute('aria-sort', 'ascending')
    await user.click(screen.getByRole('button', { name: 'Price/h' }))
    expect(names()).toEqual(['Cleo Lovelace', 'Ada Lovelace'])
    expect(screen.getByRole('columnheader', { name: 'Price/h' })).toHaveAttribute('aria-sort', 'descending')
  })

  it('deletes a member after confirming', async () => {
    const user = userEvent.setup()
    store().addMember(ada)
    renderTeam()
    await user.click(await screen.findByRole('button', { name: 'Delete Ada Lovelace' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(store().members).toEqual([])
    expect(await screen.findByText('No team members yet')).toBeInTheDocument()
  })
})
