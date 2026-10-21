import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Trash2 } from 'lucide-react'
import { IconButton } from '@/components/IconButton'
import { TooltipProvider } from '@/components/ui/tooltip'

function renderIconButton(onClick = vi.fn()) {
  render(
    <TooltipProvider delayDuration={0}>
      <IconButton
        icon={Trash2}
        label="Delete phase"
        tooltip="Delete this phase"
        shortcut="Del"
        onClick={onClick}
      />
    </TooltipProvider>,
  )
  return onClick
}

describe('IconButton', () => {
  it('has an accessible name from its label', () => {
    renderIconButton()
    expect(screen.getByRole('button', { name: 'Delete phase' })).toHaveAttribute('aria-label', 'Delete phase')
  })

  it('shows the tooltip text and shortcut on keyboard focus', async () => {
    const user = userEvent.setup()
    renderIconButton()
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    await user.tab()

    expect(screen.getByRole('button', { name: 'Delete phase' })).toHaveFocus()
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('Delete this phase')
    expect(tooltip).toHaveTextContent('Del')
  })

  it('calls onClick when activated', async () => {
    const user = userEvent.setup()
    const onClick = renderIconButton()
    await user.click(screen.getByRole('button', { name: 'Delete phase' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
