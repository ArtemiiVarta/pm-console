import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { useAuth } from '@/features/auth/useAuth'
import { createInitialData, useAppStore } from '@/store/useAppStore'

// Test-only PIN, as in the login tests: the real PIN never appears in the code.
const TEST_PIN = '4321'
const TEST_PIN_HASH = 'fe2592b42a727e977f055947385b709cc82b16b9a87f88c6abf3900d65d0cdc3'

vi.mock('@/features/auth/pin', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/auth/pin')>()
  return { ...original, verifyPin: (pin: string) => original.verifyPin(pin, TEST_PIN_HASH) }
})

type User = ReturnType<typeof userEvent.setup>

/** Presses Tab (or Shift+Tab) until the focused element matches, like a keyboard-only user. */
async function tabTo(user: User, matches: (el: Element) => boolean, what: string, backwards = false) {
  for (let i = 0; i < 200; i += 1) {
    await user.tab({ shift: backwards })
    if (document.activeElement && matches(document.activeElement)) return document.activeElement
  }
  throw new Error(`Could not reach ${what} with ${backwards ? 'Shift+Tab' : 'Tab'}`)
}

const isButton = (name: string) => (el: Element) =>
  el.tagName === 'BUTTON' && (el.getAttribute('aria-label') ?? el.textContent?.trim()) === name

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useAppStore.setState(createInitialData())
  useAuth.setState({ isAuthenticated: false })
})

it('login → add phase → add member → edit a week → create baseline, keyboard only', async () => {
  const user = userEvent.setup()
  window.location.hash = '#/settings/schedule'
  render(<App />)

  // 1. Login: focus starts in the first PIN box; typing auto-submits.
  await screen.findByText('Enter your 4-digit PIN')
  await user.keyboard(TEST_PIN)
  await screen.findByRole('tab', { name: 'Project Schedule', selected: true })

  // 2. Add a phase: dialog opens with focus in the name field; Enter submits.
  await tabTo(user, isButton('Add phase'), 'Add phase')
  await user.keyboard('{Enter}')
  await screen.findByRole('dialog', { name: 'Add phase' })
  await user.keyboard('Build{Enter}')
  expect(useAppStore.getState().phases.map((p) => p.name)).toEqual(['Build'])

  // 3. Switch to Team Forecast with arrow keys on the sub-tabs, then add a member.
  await tabTo(user, (el) => el.getAttribute('role') === 'tab', 'the sub-tabs')
  await user.keyboard('{ArrowRight}')
  await screen.findByRole('tab', { name: 'Team Forecast', selected: true })
  await tabTo(user, isButton('Add team member'), 'Add team member')
  await user.keyboard('{Enter}')
  await screen.findByRole('dialog', { name: 'Add team member' })
  await user.keyboard('Ada{Tab}Lovelace{Tab}ada@example.com{Tab}Developer{Enter}')
  expect(useAppStore.getState().members.map((m) => m.email)).toEqual(['ada@example.com'])

  // 4. Edit a week: Tab into the grid (first cell), type, Enter saves.
  await tabTo(user, (el) => el.getAttribute('role') === 'gridcell', 'the weekly grid')
  await user.keyboard('{ArrowRight}60{Enter}')
  const overrides = useAppStore.getState().members[0]?.weeklyOverrides ?? {}
  expect(Object.values(overrides)).toEqual([60])

  // 5. Create a baseline (above the grid, so Shift+Tab): the default name is ready, Enter saves it.
  await tabTo(user, isButton('Create baseline'), 'Create baseline', true)
  await user.keyboard('{Enter}')
  await screen.findByRole('dialog', { name: 'Create baseline' })
  await user.keyboard('{Enter}')
  expect(useAppStore.getState().baselines).toHaveLength(1)
  expect(useAppStore.getState().baselines[0]?.snapshot.members[0]?.weeklyOverrides).toEqual(overrides)
})
