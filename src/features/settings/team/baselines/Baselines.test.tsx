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

function seed() {
  store().updateProject({ name: 'Rollout' })
  store().addPhase({ name: 'Build', startDate: '2026-10-19', duration: 2, durationUnit: 'weeks' })
  return store().addMember(ada)
}

function renderAt(hash: string) {
  window.location.hash = hash
  render(<App />)
}

const bar = () => within(screen.getByRole('region', { name: 'Forecast versions' }))

async function openVersions(user: ReturnType<typeof userEvent.setup>) {
  await user.click(bar().getByRole('button', { name: /Versions/ }))
  return within(await screen.findByRole('dialog', { name: 'Versions' }))
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialData())
  useAuth.getState().signIn()
})

describe('Forecast baselines', () => {
  it('creates a baseline with a default name and a summary preview', async () => {
    const user = userEvent.setup()
    seed()
    renderAt('#/settings/team')
    expect(await screen.findByText('No baselines yet')).toBeInTheDocument()

    await user.click(bar().getByRole('button', { name: 'Create baseline' }))
    const dialog = within(screen.getByRole('dialog'))
    expect((dialog.getByLabelText(/Name/) as HTMLInputElement).value).toMatch(
      /^Baseline 1 – \d{2} \w{3} \d{4}$/,
    )
    const preview = within(dialog.getByRole('region', { name: 'What will be captured' }))
    expect(preview.getByText('1 active')).toBeInTheDocument()
    expect(preview.getByText('80')).toBeInTheDocument()
    expect(preview.getByText('33.3%')).toBeInTheDocument()

    await user.type(dialog.getByLabelText('Description'), 'Signed SOW')
    await user.click(dialog.getByRole('button', { name: 'Create baseline' }))

    expect(store().baselines).toHaveLength(1)
    expect(store().baselines[0]).toMatchObject({ description: 'Signed SOW', isLocked: true })
    // The first baseline is selected for Forecast vs Actual automatically.
    expect(store().selectedBaselineId).toBe(store().baselines[0]?.id)
    expect(bar().getByText(/Latest baseline:/)).toBeInTheDocument()
  })

  it('shows "Changed since last baseline" after editing the working forecast', async () => {
    const memberId = seed()
    store().createBaseline('B1')
    renderAt('#/settings/team')
    await screen.findByRole('region', { name: 'Forecast versions' })
    expect(bar().queryByText('Changed since last baseline')).not.toBeInTheDocument()

    store().setWeeklyOverride(memberId, '2026-10-19', 50)
    expect(await bar().findByText('Changed since last baseline')).toBeInTheDocument()
  })

  it('views a baseline read-only and goes back to the working forecast', async () => {
    const user = userEvent.setup()
    const memberId = seed()
    store().createBaseline('Kick-off')
    store().updateMember(memberId, { firstName: 'Changed' })
    renderAt('#/settings/team')

    const versions = await openVersions(user)
    await user.click(versions.getByRole('button', { name: 'View' }))

    expect(screen.getByRole('status')).toHaveTextContent('Viewing baseline Kick-off — read only')
    const roster = within(screen.getByRole('table', { name: 'Team members' }))
    expect(roster.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(roster.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add team member' })).not.toBeInTheDocument()

    // Typing in the grid does not edit a baseline.
    const grid = within(screen.getByRole('grid', { name: 'Weekly assignment' }))
    const cell = grid.getAllByRole('gridcell')[0]
    if (!cell) throw new Error('no cell')
    await user.click(cell)
    await user.keyboard('5')
    expect(grid.queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Back to working forecast' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('table', { name: 'Team members' })).getByText('Changed Lovelace'),
    ).toBeInTheDocument()
  })

  it('selects a baseline for Forecast vs Actual and blocks deleting it', async () => {
    const user = userEvent.setup()
    seed()
    const first = store().createBaseline('First')
    store().createBaseline('Second')
    store().selectBaseline(first.id)
    renderAt('#/settings/team')

    const versions = await openVersions(user)
    const firstItem = within(versions.getByRole('listitem', { name: 'First' }))
    expect(firstItem.getByText('Used for Forecast vs Actual')).toBeInTheDocument()

    await user.click(firstItem.getByRole('button', { name: 'Delete First' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(store().baselines).toHaveLength(2)

    const secondItem = within(versions.getByRole('listitem', { name: 'Second' }))
    await user.click(secondItem.getByRole('button', { name: 'Use for Forecast vs Actual' }))
    expect(store().selectedBaselineId).not.toBe(first.id)

    await user.click(firstItem.getByRole('button', { name: 'Delete First' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete “First”?' })).getByRole('button', {
        name: 'Delete',
      }),
    )
    expect(store().baselines.map((b) => b.name)).toEqual(['Second'])
  })

  it('restores a baseline after confirming', async () => {
    const user = userEvent.setup()
    seed()
    store().createBaseline('Kick-off')
    store().updateProject({ name: 'Renamed' })
    store().deleteMember(store().members[0]?.id ?? '')
    renderAt('#/settings/team')

    const versions = await openVersions(user)
    await user.click(versions.getByRole('button', { name: 'Restore Kick-off to working forecast' }))
    const confirm = within(await screen.findByRole('dialog', { name: 'Restore “Kick-off”?' }))
    expect(confirm.getByText(/overwrites the current project settings, phases and team/)).toBeInTheDocument()
    await user.click(confirm.getByRole('button', { name: 'Restore' }))

    expect(store().project.name).toBe('Rollout')
    expect(store().members.map((m) => m.firstName)).toEqual(['Ada'])
  })

  it('compares a baseline with the working forecast', async () => {
    const user = userEvent.setup()
    const memberId = seed()
    store().createBaseline('Kick-off')
    store().setWeeklyOverride(memberId, '2026-10-19', 50) // 80 h → 60 h
    renderAt('#/settings/team')

    const versions = await openVersions(user)
    await user.click(versions.getByRole('tab', { name: 'Compare' }))
    const table = within(versions.getByRole('table', { name: 'Forecast comparison' }))

    // Fewer hours and lower cost are good (green), lower revenue/margin are bad (red).
    expect(table.getAllByLabelText('down 20')).toHaveLength(2) // member row + totals
    expect(table.getAllByLabelText('down $2,000')).toHaveLength(2)
    expect(table.getAllByLabelText('down $3,000')[0]).toHaveClass('text-danger')
    expect(table.getAllByLabelText('down 20')[0]).toHaveClass('text-success')
  })

  it('shows the selected baseline on the Forecast vs Actual page', async () => {
    seed()
    const baseline = store().createBaseline('Kick-off')
    store().selectBaseline(baseline.id)
    renderAt('#/forecast-vs-actual')
    expect(await screen.findByRole('combobox', { name: 'Compare against' })).toHaveTextContent('Kick-off')
  })
})
