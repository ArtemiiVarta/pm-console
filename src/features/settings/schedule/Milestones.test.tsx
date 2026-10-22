import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { useAuth } from '@/features/auth/useAuth'
import { MILESTONE_COLOR, PHASE_PALETTE } from '@/lib/palette'
import { createInitialData, useAppStore } from '@/store/useAppStore'

const store = () => useAppStore.getState()

type User = ReturnType<typeof userEvent.setup>

function renderSchedule() {
  window.location.hash = '#/settings/schedule'
  render(<App />)
}

async function openAdd(user: User, item: 'Phase' | 'Milestone') {
  await user.click(await screen.findByRole('button', { name: 'Add' }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
  return within(await screen.findByRole('dialog'))
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialData())
  useAuth.getState().signIn()
})

describe('Milestones', () => {
  it('adds a milestone with a star color and shows it as a star on the timeline', async () => {
    const user = userEvent.setup()
    store().addPhase({
      name: 'Build',
      startDate: '2026-10-19',
      duration: 2,
      durationUnit: 'weeks',
      color: '#2563EB',
    })
    renderSchedule()

    const dialog = await openAdd(user, 'Milestone')
    expect(dialog.getByRole('heading', { name: 'Add milestone' })).toBeInTheDocument()
    // Defaults: end of the last phase, gold star.
    expect(dialog.getByRole('button', { name: 'Date' })).toHaveTextContent('01 Nov 2026')
    expect(dialog.getByRole('radio', { name: 'Gold' })).toHaveAttribute('aria-checked', 'true')

    await user.type(dialog.getByLabelText(/Milestone name/), 'Go-live')
    await user.click(dialog.getByRole('radio', { name: 'Red' }))
    await user.click(dialog.getByRole('button', { name: 'Add milestone' }))

    expect(store().milestones).toEqual([
      expect.objectContaining({ name: 'Go-live', date: '2026-11-01', color: '#DC2626' }),
    ])
    const list = within(screen.getByRole('table', { name: 'Milestones' }))
    expect(list.getByText('Go-live')).toBeInTheDocument()
    expect(list.getByLabelText('Star color: Red')).toBeInTheDocument()
    const timeline = within(screen.getByRole('table', { name: 'Phase timeline' }))
    expect(timeline.getByRole('img', { name: 'Milestone Go-live: 01 Nov 2026' })).toBeInTheDocument()
  })

  it('requires a milestone name', async () => {
    const user = userEvent.setup()
    renderSchedule()
    const dialog = await openAdd(user, 'Milestone')
    await user.click(dialog.getByRole('button', { name: 'Add milestone' }))
    expect(await dialog.findByText('Enter a milestone name')).toBeInTheDocument()
    expect(store().milestones).toEqual([])
  })

  it('edits and deletes a milestone', async () => {
    const user = userEvent.setup()
    store().addMilestone({ name: 'Sign-off', date: '2026-11-20', color: MILESTONE_COLOR })
    renderSchedule()

    await user.click(await screen.findByRole('button', { name: 'Edit Sign-off' }))
    const dialog = within(screen.getByRole('dialog'))
    const name = dialog.getByLabelText(/Milestone name/)
    await user.clear(name)
    await user.type(name, 'Business sign-off')
    await user.click(dialog.getByRole('radio', { name: 'Teal' }))
    await user.click(dialog.getByRole('button', { name: 'Save' }))
    expect(store().milestones[0]).toMatchObject({ name: 'Business sign-off', color: '#0D9488' })

    await user.click(screen.getByRole('button', { name: 'Delete Business sign-off' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(store().milestones).toEqual([])
  })

  it('shows milestones on the timeline even before any phase exists', async () => {
    store().addMilestone({ name: 'Kick-off', date: '2026-10-21', color: MILESTONE_COLOR })
    renderSchedule()
    expect(await screen.findByText(/No phases yet\. Phases set the project dates/)).toBeInTheDocument()
    const timeline = within(screen.getByRole('table', { name: 'Phase timeline' }))
    expect(timeline.getByRole('img', { name: 'Milestone Kick-off: 21 Oct 2026' })).toBeInTheDocument()
  })
})

describe('Phase color', () => {
  it('picks a color when adding a phase (default: next palette color)', async () => {
    const user = userEvent.setup()
    renderSchedule()
    const dialog = await openAdd(user, 'Phase')
    expect(dialog.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'true')

    await user.type(dialog.getByLabelText(/Phase name/), 'Explore')
    // Arrow keys move through the swatches like a radio group.
    await user.click(dialog.getByRole('radio', { name: 'Blue' }))
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(dialog.getByRole('radio', { name: 'Violet' })).toHaveAttribute('aria-checked', 'true')
    await user.click(dialog.getByRole('button', { name: 'Add phase' }))

    expect(store().phases[0]?.color).toBe(PHASE_PALETTE[2])
  })

  it('changes a phase color while editing its row', async () => {
    const user = userEvent.setup()
    store().addPhase({ name: 'Build', startDate: '2026-10-19', duration: 2, durationUnit: 'weeks' })
    renderSchedule()
    await user.click(await screen.findByRole('button', { name: 'Edit Build' }))
    await user.click(screen.getByRole('button', { name: /Phase color: Blue\. Change color/ }))
    await user.click(await screen.findByRole('radio', { name: 'Pink' }))
    await user.click(screen.getByRole('button', { name: 'Save phase' }))
    expect(store().phases[0]?.color).toBe('#DB2777')
  })
})
