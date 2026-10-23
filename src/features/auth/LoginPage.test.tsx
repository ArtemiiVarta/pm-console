import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { LOCKOUT_MS } from '@/features/auth/lockout'
import { useAuth } from '@/features/auth/useAuth'

// The tests use their own PIN so the real one never appears in the code.
const CORRECT_PIN = '4321'
const TEST_PIN_HASH = 'fe2592b42a727e977f055947385b709cc82b16b9a87f88c6abf3900d65d0cdc3'

vi.mock('@/features/auth/pin', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/auth/pin')>()
  return { ...original, verifyPin: (pin: string) => original.verifyPin(pin, TEST_PIN_HASH) }
})

function renderAt(hash: string) {
  window.location.hash = hash
  render(<App />)
}

const boxes = () => screen.getAllByLabelText(/Digit \d of 4/) as HTMLInputElement[]
const values = () => boxes().map((box) => box.value)

beforeEach(() => {
  sessionStorage.clear()
  useAuth.setState({ isAuthenticated: false })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('LoginPage', () => {
  it('redirects to /login and focuses the first box', async () => {
    renderAt('#/settings')
    expect(await screen.findByText('Enter your 4-digit PIN')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/login')
    expect(boxes()[0]).toHaveFocus()
  })

  it('unlocks with the correct PIN and returns to the requested page', async () => {
    const user = userEvent.setup()
    renderAt('#/planning')
    await screen.findByText('Enter your 4-digit PIN')

    await user.keyboard(CORRECT_PIN)

    expect(await screen.findByRole('heading', { level: 1, name: 'Planning' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/planning')
    expect(sessionStorage.getItem('pm-console-session')).toBe('1')
  })

  it('auto-advances, and Backspace moves to the previous box', async () => {
    const user = userEvent.setup()
    renderAt('#/login')
    await user.keyboard('27')
    expect(values()).toEqual(['2', '7', '', ''])
    expect(boxes()[2]).toHaveFocus()

    await user.keyboard('{Backspace}')
    expect(values()).toEqual(['2', '', '', ''])
    expect(boxes()[1]).toHaveFocus()
  })

  it('shows an error and clears the boxes on a wrong PIN', async () => {
    const user = userEvent.setup()
    renderAt('#/login')

    await user.keyboard('1111')

    expect(await screen.findByText(/Incorrect PIN/)).toBeInTheDocument()
    expect(values()).toEqual(['', '', '', ''])
    expect(boxes()[0]).toHaveFocus()
    expect(useAuth.getState().isAuthenticated).toBe(false)
  })

  it('fills every box when 4 digits are pasted, and submits', async () => {
    const user = userEvent.setup()
    renderAt('#/login')

    await user.paste(CORRECT_PIN)

    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
  })

  it('fills from the focused box when fewer digits are pasted', async () => {
    const user = userEvent.setup()
    renderAt('#/login')
    await user.paste('27')
    expect(values()).toEqual(['2', '7', '', ''])
  })

  it('locks input for 30 seconds after 5 wrong attempts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderAt('#/login')

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await user.keyboard('0000')
      await screen.findByText(/Incorrect PIN/)
    }
    await user.keyboard('0000')

    expect(await screen.findByText(/Too many attempts\. Try again in 30s/)).toBeInTheDocument()
    for (const box of boxes()) expect(box).toBeDisabled()

    act(() => {
      vi.advanceTimersByTime(LOCKOUT_MS + 500)
    })

    await waitFor(() => expect(boxes()[0]).toBeEnabled())
    expect(screen.queryByText(/Too many attempts/)).not.toBeInTheDocument()
  })

  it('logs out from the top bar and returns to /login', async () => {
    const user = userEvent.setup()
    useAuth.getState().signIn()
    renderAt('#/settings')

    await user.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByText('Enter your 4-digit PIN')).toBeInTheDocument()
    expect(sessionStorage.getItem('pm-console-session')).toBeNull()
  })
})
