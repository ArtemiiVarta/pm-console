import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { useAuth } from '@/features/auth/useAuth'
import { createBackup } from '@/lib/backupFile'
import { createInitialData, STORE_VERSION, useAppStore } from '@/store/useAppStore'

beforeEach(() => {
  localStorage.clear()
  useAppStore.setState(createInitialData())
  useAuth.getState().signIn()
  window.location.hash = '#/settings/general'
})

function backupFile(name: string) {
  useAppStore.getState().updateProject({ name })
  useAppStore
    .getState()
    .addPhase({ name: 'Imported phase', startDate: '2026-10-19', duration: 1, durationUnit: 'weeks' })
  const backup = createBackup(useAppStore.getState(), STORE_VERSION, new Date('2026-10-21T12:00:00Z'))
  useAppStore.setState(createInitialData())
  return new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' })
}

describe('Export / Import', () => {
  it('has labelled Export and Import buttons in the top bar', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Export data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import data' })).toBeInTheDocument()
  })

  it('downloads a JSON backup', async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:backup')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Export data' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Backup downloaded')).toBeInTheDocument()
    click.mockRestore()
  })

  it('asks before replacing data, then restores the backup', async () => {
    const user = userEvent.setup()
    const file = backupFile('From backup')
    useAppStore.getState().updateProject({ name: 'Current' })
    render(<App />)
    await screen.findByRole('button', { name: 'Import data' })

    await user.upload(screen.getByTestId('backup-file-input'), file)
    const confirm = within(await screen.findByRole('dialog', { name: 'Replace all data with this backup?' }))
    expect(confirm.getByText(/project “From backup”, 1 phases/)).toBeInTheDocument()
    expect(useAppStore.getState().project.name).toBe('Current')

    await user.click(confirm.getByRole('button', { name: 'Replace all data' }))
    expect(useAppStore.getState().project.name).toBe('From backup')
    expect(useAppStore.getState().phases.map((p) => p.name)).toEqual(['Imported phase'])
  })

  it('cancelling the import keeps the current data', async () => {
    const user = userEvent.setup()
    const file = backupFile('From backup')
    useAppStore.getState().updateProject({ name: 'Current' })
    render(<App />)
    await screen.findByRole('button', { name: 'Import data' })
    await user.upload(screen.getByTestId('backup-file-input'), file)
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(useAppStore.getState().project.name).toBe('Current')
  })

  it('reports an invalid file without changing anything', async () => {
    const user = userEvent.setup()
    useAppStore.getState().updateProject({ name: 'Current' })
    render(<App />)
    await screen.findByRole('button', { name: 'Import data' })
    await user.upload(
      screen.getByTestId('backup-file-input'),
      new File(['not json'], 'x.json', { type: 'application/json' }),
    )
    expect(await screen.findByText('Could not import the backup')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(useAppStore.getState().project.name).toBe('Current')
  })
})
