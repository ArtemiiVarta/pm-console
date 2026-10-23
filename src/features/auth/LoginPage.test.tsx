import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import type { GoogleCredentialResponse } from '@/features/auth/googleIdentity'
import { useAuth } from '@/features/auth/useAuth'
import type { Session } from '@/lib/api'
import { createInitialWorkspace, useAppStore } from '@/store/useAppStore'
import { signInForTest } from '@/test/auth'

let googleCallback: ((response: GoogleCredentialResponse) => void) | null = null
const disableAutoSelect = vi.fn()

/** Stand-in for Google Identity Services: renders a plain button that "returns" a credential. */
function installFakeGoogle() {
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn((options: { callback: (response: GoogleCredentialResponse) => void }) => {
          googleCallback = options.callback
        }),
        renderButton: vi.fn((element: HTMLElement) => {
          const button = document.createElement('button')
          button.textContent = 'Sign in with Google'
          button.onclick = () => googleCallback?.({ credential: 'google-id-token' })
          element.replaceChildren(button)
        }),
        prompt: vi.fn(),
        disableAutoSelect,
      },
    },
  }
}

function session(role: 'admin' | 'user', email = 'owner@example.com'): Session {
  return {
    token: 'session-token',
    expiresAt: Date.now() + 30 * 86_400_000,
    user: { email, name: 'Ada Lovelace', picture: '', role },
  }
}

/** Fake API: /auth/google answers with `signInResponse`; everything else is unavailable. */
function fakeApi(signInResponse: Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://api.test/auth/google') {
      expect(JSON.parse(String(init?.body))).toEqual({ credential: 'google-id-token' })
      return signInResponse
    }
    return Response.json({ error: 'Offline' }, { status: 503 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderAt(hash: string) {
  window.location.hash = hash
  render(<App />)
}

beforeEach(() => {
  localStorage.clear()
  installFakeGoogle()
  useAppStore.setState(createInitialWorkspace())
})

afterEach(() => {
  delete window.google
})

describe('Google sign-in', () => {
  it('sends signed-out visitors to the sign-in page', async () => {
    renderAt('#/settings')
    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/login')
  })

  it('signs in with Google and returns to the requested page', async () => {
    const user = userEvent.setup()
    fakeApi(Response.json(session('admin')))
    renderAt('#/planning')
    await user.click(await screen.findByRole('button', { name: 'Sign in with Google' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Planning' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('pm-console-auth') ?? '{}')).toMatchObject({
      token: 'session-token',
      user: { email: 'owner@example.com', role: 'admin' },
    })
    expect(screen.getByTitle('Signed in as owner@example.com (admin)')).toHaveTextContent('Ada Lovelace')
  })

  it('explains when the Google account has no access', async () => {
    const user = userEvent.setup()
    fakeApi(
      Response.json(
        { error: 'stranger@example.com doesn’t have access. Ask an admin to add you.' },
        { status: 403 },
      ),
    )
    renderAt('#/login')
    await user.click(await screen.findByRole('button', { name: 'Sign in with Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/stranger@example.com doesn’t have access/)
    expect(useAuth.getState().isAuthenticated).toBe(false)
  })

  it('clears another person’s cached projects when someone else signs in', async () => {
    const user = userEvent.setup()
    localStorage.setItem('pm-console-last-user', 'previous@example.com')
    useAppStore.getState().updateProject({ name: 'Someone else’s project' })
    fakeApi(Response.json(session('user', 'next@example.com')))
    renderAt('#/login')
    await user.click(await screen.findByRole('button', { name: 'Sign in with Google' }))
    await screen.findByRole('heading', { level: 1, name: 'Projects' })
    expect(useAppStore.getState().project.name).toBe('')
  })
})

describe('signed-in session', () => {
  it('logs out, clears this browser’s copy and stops Google auto sign-in', async () => {
    const user = userEvent.setup()
    signInForTest()
    useAppStore.getState().updateProject({ name: 'Cached project' })
    localStorage.setItem('pm-console-github-sync', JSON.stringify({ sha: 's1', dirty: false }))
    renderAt('#/settings')

    await user.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument()
    expect(localStorage.getItem('pm-console-auth')).toBeNull()
    expect(useAppStore.getState().project.name).toBe('')
    expect(disableAutoSelect).toHaveBeenCalled()
  })

  it('asks before logging out when changes could not be saved', async () => {
    const user = userEvent.setup()
    signInForTest()
    localStorage.setItem('pm-console-github-sync', JSON.stringify({ sha: 's1', dirty: true }))
    renderAt('#/settings')

    await user.click(await screen.findByRole('button', { name: 'Log out' }))
    const dialog = await screen.findByRole('dialog', { name: 'Log out without saving?' })
    expect(useAuth.getState().isAuthenticated).toBe(true)
    await user.click(within(dialog).getByRole('button', { name: 'Log out anyway' }))
    expect(useAuth.getState().isAuthenticated).toBe(false)
  })

  it('shows the Admin tab to admins only', async () => {
    signInForTest('user', 'pm@example.com')
    renderAt('#/admin')
    const nav = await screen.findByRole('navigation', { name: 'Main' })
    expect(within(nav).queryByText('Admin')).not.toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).toBe('#/'))
  })

  it('signs out with a notice when the server says access was removed', async () => {
    signInForTest('user', 'gone@example.com')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'gone@example.com no longer has access.' }, { status: 403 })),
    )
    renderAt('#/')
    expect(await screen.findByText('gone@example.com no longer has access.')).toBeInTheDocument()
    expect(useAuth.getState().isAuthenticated).toBe(false)
  })
})
