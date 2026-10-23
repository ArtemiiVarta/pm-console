import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { IS_PRODUCTION } from '@/lib/env'
import '@/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

if (!IS_PRODUCTION) document.title = 'PM Console · Staging'

// GitHub tokens are no longer kept in browsers (the API holds the only one): remove old copies.
try {
  localStorage.removeItem('pm-console-github')
} catch {
  // Storage blocked: nothing to remove.
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
