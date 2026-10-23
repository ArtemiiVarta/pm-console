import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { useAuth } from '@/features/auth/useAuth'
import { createInitialWorkspace, useAppStore } from '@/store/useAppStore'

const store = () => useAppStore.getState()

/** Two projects: "Big" with forecast revenue (red), "Small" without (green). */
function seed() {
  useAppStore.setState(createInitialWorkspace())
  store().updateProject({
    name: 'Big',
    client: 'Northwind',
    status: 'red',
    statusRationale: 'Budget overrun',
  })
  store().addPhase({ name: 'Build', startDate: '2026-10-19', duration: 4, durationUnit: 'weeks' })
  store().addMember({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    role: 'Developer',
    costRate: 100,
    priceRate: 150,
  })
  const bigId = store().activeProjectId
  const smallId = store().createProject()
  store().updateProject({ name: 'Small' })
  return { bigId, smallId }
}

function renderHome() {
  window.location.hash = ''
  render(<App />)
}

beforeEach(() => {
  localStorage.clear()
  useAuth.getState().signIn()
})

describe('Projects page', () => {
  it('shows a tile per project, colored by status, sized by revenue', async () => {
    seed()
    renderHome()
    const tiles = within(await screen.findByRole('list', { name: 'Projects by revenue' }))
    const big = tiles.getByRole('button', {
      name: /^Big, status Red, forecast revenue \$24,000\. Budget overrun/,
    })
    const small = tiles.getByRole('button', { name: /^Small, status Green, forecast revenue \$0/ })
    expect(big).toHaveClass('bg-danger')
    expect(small).toHaveClass('bg-success')
    // Larger revenue → larger tile.
    const size = (el: HTMLElement) => {
      const style = (el.parentElement as HTMLElement).style
      return parseFloat(style.width) * parseFloat(style.height)
    }
    expect(size(big)).toBeGreaterThan(size(small) * 5)
  })

  it('opens a project in Project Settings when its tile is clicked', async () => {
    const user = userEvent.setup()
    const { bigId } = seed()
    renderHome()
    await user.click(await screen.findByRole('button', { name: /^Big, status Red/ }))
    expect(window.location.hash).toBe('#/settings/general')
    expect(store().activeProjectId).toBe(bigId)
    expect(await screen.findByLabelText(/Project name/)).toHaveValue('Big')
  })

  it('creates a new project and opens its details', async () => {
    const user = userEvent.setup()
    seed()
    renderHome()
    await user.click(await screen.findByRole('button', { name: 'New project' }))
    expect(Object.keys(store().library)).toHaveLength(3)
    expect(window.location.hash).toBe('#/settings/general')
    expect(await screen.findByLabelText(/Project name/)).toHaveValue('')
  })

  it('lists projects and deletes one after confirming', async () => {
    const user = userEvent.setup()
    const { smallId } = seed()
    renderHome()
    const list = within(await screen.findByRole('table', { name: 'All projects' }))
    expect(list.getByText('Budget overrun')).toBeInTheDocument()
    await user.click(list.getByRole('button', { name: 'Delete Small' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(store().library[smallId]).toBeUndefined()
  })
})

describe('Project status', () => {
  it('defaults to Green and saves Amber with a rationale', async () => {
    const user = userEvent.setup()
    useAppStore.setState(createInitialWorkspace())
    window.location.hash = '#/settings/general'
    render(<App />)
    const status = await screen.findByRole('combobox', { name: 'Project status' })
    expect(status).toHaveTextContent('Green')

    await user.type(screen.getByLabelText(/Project name/), 'Rollout')
    await user.click(status)
    await user.click(await screen.findByRole('option', { name: /Amber/ }))
    await user.type(screen.getByLabelText('Rationale'), 'Data migration is late')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(store().project).toMatchObject({ status: 'amber', statusRationale: 'Data migration is late' })
    expect(store().library[store().activeProjectId]?.project.status).toBe('amber')
  })
})
