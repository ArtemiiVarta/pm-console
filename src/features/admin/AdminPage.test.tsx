import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import type { PersonEntry } from '@/lib/api'
import { signInForTest } from '@/test/auth'

/** Fake people API, starting with one user besides the owner. */
function fakePeopleApi() {
  let users: PersonEntry[] = [
    { email: 'pm@example.com', role: 'user', addedAt: '2026-10-01T09:00:00Z', addedBy: 'owner@example.com' },
  ]
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace('https://api.test', '')
      const method = init?.method ?? 'GET'
      if (!path.startsWith('/users')) return Response.json({ error: 'Offline' }, { status: 503 })
      calls.push(`${method} ${decodeURIComponent(path)}`)
      if (method === 'GET') return Response.json({ owner: 'owner@example.com', users })
      const email = decodeURIComponent(path.slice('/users/'.length))
      if (method === 'PUT') {
        const { role } = JSON.parse(String(init?.body)) as { role: 'admin' | 'user' }
        const rest = users.filter((user) => user.email !== email)
        const existing = users.find((user) => user.email === email)
        users = [
          ...rest,
          existing
            ? { ...existing, role }
            : { email, role, addedAt: '2026-10-23T09:00:00Z', addedBy: 'owner@example.com' },
        ]
      }
      if (method === 'DELETE') users = users.filter((user) => user.email !== email)
      return Response.json({ users })
    }),
  )
  return calls
}

function renderAdmin() {
  window.location.hash = '#/admin'
  render(<App />)
}

describe('Admin page', () => {
  it('is a tab for admins and lists the owner and people', async () => {
    fakePeopleApi()
    signInForTest('admin', 'owner@example.com')
    renderAdmin()
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByText('Admin')).toBeInTheDocument()
    const table = within(await screen.findByRole('table', { name: 'People' }))
    expect(await table.findByText('pm@example.com')).toBeInTheDocument()
    expect(table.getByText('Owner · Admin')).toBeInTheDocument()
    expect(table.getByText('(you)')).toBeInTheDocument()
  })

  it('adds a person with a role, and validates the email', async () => {
    const user = userEvent.setup()
    const calls = fakePeopleApi()
    signInForTest()
    renderAdmin()
    await screen.findByText('pm@example.com')

    await user.type(screen.getByLabelText(/Google account email/), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Google account email/))
    await user.type(screen.getByLabelText(/Google account email/), 'pm@example.com')
    await user.click(screen.getByRole('button', { name: 'Add person' }))
    expect(await screen.findByText('This person already has access')).toBeInTheDocument()

    await user.clear(screen.getByLabelText(/Google account email/))
    await user.type(screen.getByLabelText(/Google account email/), 'New.Admin@Example.com')
    await user.click(screen.getByRole('combobox', { name: 'Role' }))
    await user.click(await screen.findByRole('option', { name: /Admin/ }))
    await user.click(screen.getByRole('button', { name: 'Add person' }))

    expect(await screen.findByText('new.admin@example.com')).toBeInTheDocument()
    expect(calls).toContain('PUT /users/new.admin@example.com')
  })

  it('changes a role and removes a person after confirming', async () => {
    const user = userEvent.setup()
    const calls = fakePeopleApi()
    signInForTest()
    renderAdmin()
    await screen.findByText('pm@example.com')

    await user.click(screen.getByRole('combobox', { name: 'Role for pm@example.com' }))
    await user.click(await screen.findByRole('option', { name: 'Admin' }))
    expect(calls).toContain('PUT /users/pm@example.com')

    await user.click(screen.getByRole('button', { name: 'Remove pm@example.com' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    expect(calls).toContain('DELETE /users/pm@example.com')
    expect(screen.queryByText('pm@example.com')).not.toBeInTheDocument()
  })
})
