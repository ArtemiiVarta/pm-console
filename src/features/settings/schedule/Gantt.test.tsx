import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { signInForTest } from '@/test/auth'
import { createInitialData, useAppStore } from '@/store/useAppStore'

const store = () => useAppStore.getState()
type User = ReturnType<typeof userEvent.setup>

function renderSchedule() {
  window.location.hash = '#/settings/schedule'
  render(<App />)
}

const gantt = () => within(screen.getByRole('treegrid', { name: 'Project schedule' }))
const dialog = () => within(screen.getByRole('dialog'))

async function addFromMenu(user: User, item: 'Phase' | 'Milestone') {
  await user.click(await screen.findByRole('button', { name: 'Add' }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

async function rowAction(user: User, rowName: string, action: string | RegExp) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${rowName}` }))
  await user.click(await screen.findByRole('menuitem', { name: action }))
}

/** Phase "Explore": Mon 19 Oct 2026, 2 weeks (working days). */
function seedPhase() {
  return store().addPhase({ name: 'Explore', startDate: '2026-10-19', duration: 2, durationUnit: 'weeks' })
}

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialData())
  signInForTest()
})

describe('Project schedule (Gantt)', () => {
  it('shows one combined widget with an Add menu when empty', async () => {
    renderSchedule()
    expect(await screen.findByText('No phases yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.queryByText('Timeline')).not.toBeInTheDocument()
  })

  it('adds a phase from the Add menu', async () => {
    const user = userEvent.setup()
    renderSchedule()
    await addFromMenu(user, 'Phase')
    await user.type(dialog().getByLabelText(/Phase name/), 'Explore')
    await user.click(dialog().getByRole('button', { name: 'Add phase' }))
    expect(store().phases.map((p) => p.name)).toEqual(['Explore'])
    expect(gantt().getByRole('rowheader', { name: /Explore/ })).toBeInTheDocument()
  })

  it('adds a task under a phase and adjusts the phase to its children', async () => {
    const user = userEvent.setup()
    const phaseId = seedPhase()
    renderSchedule()
    await rowAction(user, 'Explore', 'Add task')

    expect(dialog().getByRole('heading', { name: 'Add task' })).toBeInTheDocument()
    expect(dialog().getByText('Under phase “Explore”.')).toBeInTheDocument()
    // Starts with the phase by default.
    expect(dialog().getByRole('button', { name: 'Start date' })).toHaveTextContent('19 Oct 2026')

    await user.type(dialog().getByLabelText(/Task name/), 'Workshops')
    const duration = dialog().getByLabelText(/Duration/)
    await user.clear(duration)
    await user.type(duration, '3')
    await user.click(dialog().getByLabelText(/Adjust phase start date/))
    await user.click(dialog().getByLabelText(/Adjust phase end date/))
    await user.click(dialog().getByRole('button', { name: 'Add task' }))

    const task = store().items[0]
    expect(task).toMatchObject({ parentId: phaseId, kind: 'task', name: 'Workshops', duration: 3 })
    // Phase = min start / max end of its children: 19–21 Oct.
    expect(store().phases[0]).toMatchObject({
      fitStart: true,
      fitEnd: true,
      startDate: '2026-10-19',
      endDate: '2026-10-21',
    })
    expect(gantt().getByRole('img', { name: 'Start and end follow the items under it' })).toBeInTheDocument()
  })

  it('adds a sub-task and a sub-milestone under a task, adjusting the task', async () => {
    const user = userEvent.setup()
    const phaseId = seedPhase()
    const taskId = store().addItem({
      parentId: phaseId,
      kind: 'task',
      name: 'Build',
      color: '#0D9488',
      startDate: '2026-10-19',
      duration: 2,
      durationUnit: 'days',
    })
    renderSchedule()

    await rowAction(user, 'Build', 'Add sub-task')
    expect(dialog().getByRole('heading', { name: 'Add sub-task' })).toBeInTheDocument()
    await user.type(dialog().getByLabelText(/Sub-task name/), 'Interfaces')
    const duration = dialog().getByLabelText(/Duration/)
    await user.clear(duration)
    await user.type(duration, '7')
    await user.click(dialog().getByLabelText(/Adjust task end date/))
    await user.click(dialog().getByRole('button', { name: 'Add sub-task' }))
    // 7 working days from Mon 19 Oct → Tue 27 Oct
    expect(store().items.find((i) => i.id === taskId)).toMatchObject({ fitEnd: true, endDate: '2026-10-27' })

    await rowAction(user, 'Build', 'Add sub-milestone')
    expect(dialog().getByRole('heading', { name: 'Add sub-milestone' })).toBeInTheDocument()
    await user.type(dialog().getByLabelText(/Milestone name/), 'Interfaces done')
    await user.click(dialog().getByRole('button', { name: 'Add sub-milestone' }))
    const subMilestone = store().items.find((i) => i.name === 'Interfaces done')
    expect(subMilestone).toMatchObject({ parentId: taskId, kind: 'milestone' })
    expect(gantt().getByTestId(`gantt-star-${subMilestone?.id}`)).toBeInTheDocument()

    // Sub-tasks cannot have children of their own.
    await user.click(screen.getByRole('button', { name: 'Actions for Interfaces' }))
    expect(screen.queryByRole('menuitem', { name: /Add sub-task/ })).not.toBeInTheDocument()
  })

  it('moves a bar with the keyboard (children move along) and resizes it with Shift', async () => {
    const user = userEvent.setup()
    const phaseId = seedPhase()
    store().addItem({
      parentId: phaseId,
      kind: 'task',
      name: 'Build',
      color: '#0D9488',
      startDate: '2026-10-20',
      duration: 2,
      durationUnit: 'days',
    })
    renderSchedule()

    const phaseBar = await screen.findByTestId(`gantt-bar-${phaseId}`)
    phaseBar.focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(store().phases[0]?.startDate).toBe('2026-10-21')
    expect(store().items[0]?.startDate).toBe('2026-10-22')

    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    // End pinned one day later than the 2-week end (Sun 1 Nov + 2 days moved = 3 Nov, +1 = 4 Nov).
    expect(store().phases[0]?.endDate).toBe('2026-11-04')
    expect(phaseBar).toHaveAccessibleName(/Explore: 21 Oct 2026 – 04 Nov 2026/)
  })

  it('moves a milestone star with the keyboard', async () => {
    const user = userEvent.setup()
    const id = store().addMilestone({ name: 'Go-live', date: '2026-12-01', color: '#CA8A04' })
    renderSchedule()
    const star = await screen.findByTestId(`gantt-star-${id}`)
    star.focus()
    await user.keyboard('{ArrowLeft}')
    expect(store().milestones[0]?.date).toBe('2026-11-30')
  })

  it('collapses and expands children', async () => {
    const user = userEvent.setup()
    const phaseId = seedPhase()
    store().addItem({
      parentId: phaseId,
      kind: 'task',
      name: 'Build',
      color: '#0D9488',
      startDate: '2026-10-20',
      duration: 2,
      durationUnit: 'days',
    })
    renderSchedule()
    expect(await screen.findByRole('rowheader', { name: /Build/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collapse Explore' }))
    expect(screen.queryByRole('rowheader', { name: /Build/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand Explore' }))
    expect(screen.getByRole('rowheader', { name: /Build/ })).toBeInTheDocument()
  })

  it('deletes a phase with its children after confirming', async () => {
    const user = userEvent.setup()
    const phaseId = seedPhase()
    store().addItem({
      parentId: phaseId,
      kind: 'milestone',
      name: 'Sign-off',
      color: '#CA8A04',
      startDate: '2026-10-30',
      duration: 1,
      durationUnit: 'days',
    })
    renderSchedule()
    await rowAction(user, 'Explore', 'Delete')
    expect(dialog().getByText(/Everything under it \(1 items\) is deleted too/)).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'Delete' }))
    expect(store().phases).toEqual([])
    expect(store().items).toEqual([])
  })

  it('edits a phase to follow its children, and a project milestone color', async () => {
    const user = userEvent.setup()
    const phaseId = seedPhase()
    store().addItem({
      parentId: phaseId,
      kind: 'task',
      name: 'Build',
      color: '#0D9488',
      startDate: '2026-10-21',
      duration: 2,
      durationUnit: 'days',
    })
    store().addMilestone({ name: 'Go-live', date: '2026-12-01', color: '#CA8A04' })
    renderSchedule()

    await rowAction(user, 'Explore', 'Edit')
    await user.click(dialog().getByLabelText('Start date = earliest child start'))
    await user.click(dialog().getByRole('button', { name: 'Save' }))
    expect(store().phases[0]).toMatchObject({ fitStart: true, startDate: '2026-10-21' })

    await rowAction(user, 'Go-live', 'Edit')
    await user.click(dialog().getByRole('radio', { name: 'Red' }))
    await user.click(dialog().getByRole('button', { name: 'Save' }))
    expect(store().milestones[0]?.color).toBe('#DC2626')
  })

  it('reorders phases and starts a phase after the previous one', async () => {
    const user = userEvent.setup()
    seedPhase()
    store().addPhase({ name: 'Realize', startDate: '2026-11-16', duration: 1, durationUnit: 'weeks' })
    renderSchedule()

    await rowAction(user, 'Realize', 'Start after previous phase')
    expect(store().phases[1]?.startDate).toBe('2026-11-02')

    await rowAction(user, 'Realize', 'Move up')
    expect([...store().phases].sort((a, b) => a.order - b.order).map((p) => p.name)).toEqual([
      'Realize',
      'Explore',
    ])
  })

  it('has a visible + button on phase and task rows to add children', async () => {
    const user = userEvent.setup()
    const phaseId = seedPhase()
    renderSchedule()

    await user.click(await screen.findByRole('button', { name: 'Add under Explore' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Add task' }))
    await user.type(dialog().getByLabelText(/Task name/), 'Design')
    await user.click(dialog().getByRole('button', { name: 'Add task' }))
    const task = store().items.find((i) => i.name === 'Design')
    expect(task).toMatchObject({ parentId: phaseId, kind: 'task' })

    await user.click(screen.getByRole('button', { name: 'Add under Design' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Add sub-milestone' }))
    await user.type(dialog().getByLabelText(/Milestone name/), 'Design approved')
    await user.click(dialog().getByRole('button', { name: 'Add sub-milestone' }))
    expect(store().items.find((i) => i.name === 'Design approved')).toMatchObject({
      parentId: task?.id,
      kind: 'milestone',
    })

    // Sub-tasks get no + (they cannot have children).
    await user.click(screen.getByRole('button', { name: 'Add under Design' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Add sub-task' }))
    await user.type(dialog().getByLabelText(/Sub-task name/), 'Mock-ups')
    await user.click(dialog().getByRole('button', { name: 'Add sub-task' }))
    expect(screen.queryByRole('button', { name: 'Add under Mock-ups' })).not.toBeInTheDocument()
  })

  it('adds tasks, sub-tasks and milestones from the top Add menu, choosing where they go', async () => {
    const user = userEvent.setup()
    seedPhase()
    const realizeId = store().addPhase({
      name: 'Realize',
      startDate: '2026-11-02',
      duration: 4,
      durationUnit: 'weeks',
    })
    renderSchedule()

    // Sub-task needs a task first.
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('menuitem', { name: /Sub-task \(add a task first\)/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await user.click(screen.getByRole('menuitem', { name: 'Task' }))

    // Under: pick the second phase; the start date follows it.
    await user.click(dialog().getByRole('combobox', { name: 'Under' }))
    await user.click(await screen.findByRole('option', { name: 'Phase: Realize' }))
    expect(dialog().getByRole('button', { name: 'Start date' })).toHaveTextContent('02 Nov 2026')
    expect(dialog().getByText(/Adjust phase “Realize” to its children/)).toBeInTheDocument()
    await user.type(dialog().getByLabelText(/Task name/), 'Build')
    await user.click(dialog().getByRole('button', { name: 'Add task' }))
    const build = store().items.find((i) => i.name === 'Build')
    expect(build).toMatchObject({ parentId: realizeId, kind: 'task', startDate: '2026-11-02' })

    // Sub-task: Under lists tasks.
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sub-task' }))
    expect(dialog().getByRole('combobox', { name: 'Under' })).toHaveTextContent('Task: Realize › Build')
    await user.type(dialog().getByLabelText(/Sub-task name/), 'Interfaces')
    await user.click(dialog().getByRole('button', { name: 'Add sub-task' }))
    expect(store().items.find((i) => i.name === 'Interfaces')).toMatchObject({ parentId: build?.id })

    // Milestone: defaults to project level.
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Milestone' }))
    expect(dialog().getByRole('combobox', { name: 'Under' })).toHaveTextContent('Project (not under a phase)')
    await user.type(dialog().getByLabelText(/Milestone name/), 'Go-live')
    await user.click(dialog().getByRole('button', { name: 'Add milestone' }))
    expect(store().milestones.map((m) => m.name)).toEqual(['Go-live'])
  })
})
