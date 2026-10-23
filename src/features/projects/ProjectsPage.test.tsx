import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { signInForTest } from '@/test/auth'
import { DEFAULT_FX_RATES } from '@/lib/fx'
import { createInitialWorkspace, useAppStore } from '@/store/useAppStore'
import { usePortfolioPrefs } from '@/store/usePortfolioPrefs'

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
  signInForTest()
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

describe('Projects in different currencies', () => {
  beforeEach(() => {
    usePortfolioPrefs.setState({ reportingCurrency: 'CAD', fxRates: DEFAULT_FX_RATES, fxRatesAsOf: null })
  })

  /** Same raw revenue (24,000) in EUR and CAD. */
  function seedMixed() {
    seed()
    store().updateProject({ name: 'Euro', currency: 'EUR' })
    store().addPhase({ name: 'Build', startDate: '2026-10-19', duration: 4, durationUnit: 'weeks' })
    store().addMember({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      role: 'Developer',
      costRate: 100,
      priceRate: 150,
    })
  }

  it('labels dollars explicitly and sizes tiles by converted revenue', async () => {
    seedMixed()
    renderHome()
    const tiles = within(await screen.findByRole('list', { name: 'Projects by revenue' }, { timeout: 5000 }))
    const big = tiles.getByRole('button', { name: /^Big, status Red, forecast revenue CA\$24,000/ })
    const euro = tiles.getByRole('button', { name: /^Euro, .*forecast revenue €24,000/ })
    const size = (el: HTMLElement) => {
      const style = (el.parentElement as HTMLElement).style
      return parseFloat(style.width) * parseFloat(style.height)
    }
    // €24,000 is worth more than CA$24,000 at the default rates.
    expect(size(euro)).toBeGreaterThan(size(big))
    expect(screen.getByText(/compared in CAD/)).toBeInTheDocument()
    expect(screen.getByText(/Example rates/)).toBeInTheDocument()
  })

  it('saves new exchange rates from the dialog', async () => {
    const user = userEvent.setup()
    seedMixed()
    renderHome()
    await user.click(await screen.findByRole('button', { name: 'Exchange rates' }, { timeout: 5000 }))
    const eur = await screen.findByLabelText('1 EUR in CAD')
    await user.clear(eur)
    await user.type(eur, '0.5')
    await user.click(screen.getByRole('button', { name: 'Save rates' }))

    const tiles = within(screen.getByRole('list', { name: 'Projects by revenue' }))
    const big = tiles.getByRole('button', { name: /^Big,/ })
    const euro = tiles.getByRole('button', { name: /^Euro,/ })
    const size = (el: HTMLElement) => {
      const style = (el.parentElement as HTMLElement).style
      return parseFloat(style.width) * parseFloat(style.height)
    }
    expect(size(euro)).toBeLessThan(size(big))
    expect(screen.getByText(/Rates entered/)).toBeInTheDocument()
  })

  it('keeps a plain $ when every project uses one currency', async () => {
    seed()
    renderHome()
    const tiles = within(await screen.findByRole('list', { name: 'Projects by revenue' }, { timeout: 5000 }))
    expect(tiles.getByRole('button', { name: /forecast revenue \$24,000/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exchange rates' })).not.toBeInTheDocument()
  })
})
