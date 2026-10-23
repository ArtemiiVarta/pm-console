import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { useSync } from '@/features/sync/sync'
import { createInitialWorkspace, useAppStore } from '@/store/useAppStore'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useAppStore.setState(createInitialWorkspace())
  // No Google in tests: the sign-in button never renders, the local test buttons still do.
  window.google = undefined
})

describe('local test mode (npm run dev only)', () => {
  it('signs in as a test admin, syncs to the in-browser stand-in, and manages people', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/login'
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Test admin' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
    expect(screen.getByTitle('Signed in as test.admin@localhost (admin)')).toBeInTheDocument()

    // Sync talks to the stand-in, never the network.
    await waitFor(() => expect(useSync.getState().status).toBe('saved'))
    expect(JSON.parse(localStorage.getItem('pm-console-dev-remote') ?? '{}')).toHaveProperty('staging.sha')

    await user.click(within(screen.getByRole('navigation', { name: 'Main' })).getByText('Admin'))
    expect(await screen.findByText('test.user@localhost')).toBeInTheDocument()
  })

  it('signs in as a test user without the Admin tab', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/login'
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Test user' }))
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).queryByText('Admin')).not.toBeInTheDocument()
  })
})
