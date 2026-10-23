import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { signInForTest } from '@/test/auth'
import { createInitialData, useAppStore } from '@/store/useAppStore'

// The first render loads the page chunk, which can be slow on a busy machine.
const LAZY = { timeout: 5000 }

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialData())
  useAppStore.getState().updateProject({ name: 'Wave 1' })
  signInForTest()
  window.location.hash = '#/settings/general'
})

async function editClientThenLeave() {
  const user = userEvent.setup()
  render(<App />)
  await user.type(await screen.findByLabelText('Client', undefined, LAZY), 'Northwind')
  await user.click(screen.getByRole('link', { name: 'Projects' }))
  return user
}

describe('Unsaved project details', () => {
  it('asks before leaving, and Keep editing stays with the edits', async () => {
    const user = await editClientThenLeave()
    expect(await screen.findByRole('dialog', { name: 'Save your changes?' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/settings/general')

    await user.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText('Client')).toHaveValue('Northwind')
    expect(window.location.hash).toBe('#/settings/general')
  })

  it('Save stores the edits and then leaves', async () => {
    const user = await editClientThenLeave()
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(useAppStore.getState().project.client).toBe('Northwind')
  })

  it('Discard leaves without saving', async () => {
    const user = await editClientThenLeave()
    await user.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(useAppStore.getState().project.client).toBe('')
  })

  it('Save with an invalid form stays and shows the error', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.clear(await screen.findByLabelText(/Project name/, undefined, LAZY))
    await user.click(screen.getByRole('link', { name: 'Projects' }))
    await user.click(await screen.findByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Enter a project name')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/settings/general')
    expect(useAppStore.getState().project.name).toBe('Wave 1')
  })

  it('does not ask when nothing changed, or when logging out', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('link', { name: 'Projects' }, LAZY))
    await waitFor(() => expect(window.location.hash).toBe('#/'))

    await user.click(await screen.findByRole('link', { name: 'Project Settings' }))
    await user.type(await screen.findByLabelText('Client', undefined, LAZY), 'Northwind')
    await user.click(screen.getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(window.location.hash).toBe('#/login'))
    expect(screen.queryByRole('dialog', { name: 'Save your changes?' })).not.toBeInTheDocument()
  })
})
