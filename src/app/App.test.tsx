import { render, screen } from '@testing-library/react'
import { App } from '@/app/App'
import { signInForTest } from '@/test/auth'

describe('App', () => {
  beforeEach(() => {
    window.location.hash = ''
    signInForTest()
  })

  it('opens the Projects page by default', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('shows every main tab and the untitled project name', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const label of [
      'Projects',
      'Project Settings',
      'Planning',
      'Monitoring',
      'Forecast vs Actual',
      'Reports',
    ]) {
      expect(nav).toHaveTextContent(label)
    }
    expect(screen.getByTitle('Current project')).toHaveTextContent('Untitled project')
  })

  it('shows a coming-soon page for unbuilt tabs', async () => {
    window.location.hash = '#/planning'
    render(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Planning' })).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
  })
})
