import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { useAuth } from '@/features/auth/useAuth'
import { createInitialData, useAppStore } from '@/store/useAppStore'

function renderAt(hash: string) {
  window.location.hash = hash
  render(<App />)
}

const summary = () => within(screen.getByRole('region', { name: 'Project summary' }))

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialData())
  useAuth.getState().signIn()
})

describe('Project Settings sub-tabs', () => {
  it('opens General by default and syncs the URL', async () => {
    renderAt('#/settings')
    expect(await screen.findByRole('tab', { name: 'General', selected: true })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/settings/general')
  })

  it('switches sub-tab on click and updates the URL', async () => {
    const user = userEvent.setup()
    renderAt('#/settings/general')
    await user.click(await screen.findByRole('tab', { name: 'Team Forecast' }))
    expect(window.location.hash).toBe('#/settings/team')
    expect(screen.getByRole('tab', { name: 'Team Forecast', selected: true })).toBeInTheDocument()
  })

  it('opens the sub-tab named in the URL, and falls back to General for unknown ones', async () => {
    renderAt('#/settings/schedule')
    expect(await screen.findByRole('tab', { name: 'Project Schedule', selected: true })).toBeInTheDocument()
  })

  it('falls back to General for an unknown sub-tab', async () => {
    renderAt('#/settings/nope')
    expect(await screen.findByRole('tab', { name: 'General', selected: true })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/settings/general')
  })
})

describe('Project details form', () => {
  it('requires a project name', async () => {
    const user = userEvent.setup()
    renderAt('#/settings/general')
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a project name')).toBeInTheDocument()
    expect(screen.getByLabelText(/Project name/)).toHaveAttribute('aria-invalid', 'true')
    expect(useAppStore.getState().project.name).toBe('')
  })

  it('rejects standard hours outside 1–80', async () => {
    const user = userEvent.setup()
    renderAt('#/settings/general')
    await user.type(await screen.findByLabelText(/Project name/), 'Rollout')
    const hours = screen.getByLabelText('Standard hours per week')
    await user.clear(hours)
    await user.type(hours, '90')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Use 80 hours or fewer')).toBeInTheDocument()

    await user.clear(hours)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a number of hours')).toBeInTheDocument()
    expect(useAppStore.getState().project.standardHoursPerWeek).toBe(40)
  })

  it('saves to the store, shows a toast and updates the top bar', async () => {
    const user = userEvent.setup()
    renderAt('#/settings/general')
    await user.type(await screen.findByLabelText(/Project name/), '  Wave 2 rollout ')
    await user.type(screen.getByLabelText('Client'), 'Northwind')
    const hours = screen.getByLabelText('Standard hours per week')
    await user.clear(hours)
    await user.type(hours, '37.5')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Project details saved')).toBeInTheDocument()
    expect(useAppStore.getState().project).toMatchObject({
      name: 'Wave 2 rollout',
      client: 'Northwind',
      standardHoursPerWeek: 37.5,
    })
    expect(screen.getByTitle('Current project')).toHaveTextContent('Wave 2 rollout')
  })

  it('Reset discards unsaved changes', async () => {
    const user = userEvent.setup()
    useAppStore.getState().updateProject({ name: 'Saved name' })
    renderAt('#/settings/general')
    const name = await screen.findByLabelText(/Project name/)
    await user.clear(name)
    await user.type(name, 'Draft')
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(name).toHaveValue('Saved name')
    expect(screen.queryByText('You have unsaved changes.')).not.toBeInTheDocument()
  })
})

describe('Project summary tiles', () => {
  it('shows placeholders when there is no data', async () => {
    renderAt('#/settings/general')
    await screen.findByRole('region', { name: 'Project summary' })
    expect(summary().getAllByText('No phases yet')).toHaveLength(2)
    expect(summary().getByText('No forecast revenue yet')).toBeInTheDocument()
  })

  it('shows dates, duration, members, hours and margin from the store', async () => {
    const store = useAppStore.getState()
    store.addPhase({ name: 'Build', startDate: '2026-10-21', duration: 2, durationUnit: 'weeks' })
    store.addMember({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'Developer',
      costRate: 100,
      priceRate: 125,
    })
    renderAt('#/settings/general')
    await screen.findByRole('region', { name: 'Project summary' })

    expect(summary().getByText('21 Oct 2026')).toBeInTheDocument()
    expect(summary().getByText('03 Nov 2026')).toBeInTheDocument()
    // Wed 21 Oct – Tue 3 Nov touches 3 Mon–Sun weeks but holds 10 working days.
    expect(summary().getByText('2 wk')).toBeInTheDocument()
    expect(summary().getByText('10 working days')).toBeInTheDocument()
    expect(summary().getByText('80')).toBeInTheDocument()
    expect(summary().getByText('20%')).toBeInTheDocument()
    expect(summary().getByText('Below target (10–25%)')).toBeInTheDocument()
  })
})
