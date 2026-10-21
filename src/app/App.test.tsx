import { render, screen } from '@testing-library/react'
import { App } from '@/app/App'
import { useAuth } from '@/features/auth/useAuth'

describe('App', () => {
  beforeEach(() => {
    window.location.hash = ''
    useAuth.getState().signIn()
  })

  it('opens Project Settings by default', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Project Settings' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/settings')
  })

  it('shows every main tab and the untitled project name', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const label of ['Project Settings', 'Planning', 'Monitoring', 'Forecast vs Actual', 'Reports']) {
      expect(nav).toHaveTextContent(label)
    }
    expect(screen.getByText('Untitled project')).toBeInTheDocument()
  })

  it('shows a coming-soon page for unbuilt tabs', async () => {
    window.location.hash = '#/planning'
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Planning' })).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
  })
})
