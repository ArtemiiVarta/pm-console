import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="pm-console-theme">
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  )
}
