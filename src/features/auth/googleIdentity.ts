// Loads Google Identity Services (the official "Sign in with Google" button) on demand.

export interface GoogleCredentialResponse {
  credential: string
}

interface GoogleAccountsId {
  initialize: (options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    use_fedcm_for_prompt?: boolean
  }) => void
  renderButton: (
    element: HTMLElement,
    options: { theme?: string; size?: string; text?: string; shape?: string; width?: number },
  ) => void
  prompt: () => void
  disableAutoSelect: () => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'
let loading: Promise<GoogleAccountsId> | null = null

export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.google?.accounts.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('Google sign-in did not load.'))
    script.onerror = () => {
      loading = null
      reject(new Error('Google sign-in could not load. Check your connection or ad blocker.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** Stops Google from signing the same account in automatically after an explicit log out. */
export function disableGoogleAutoSelect() {
  window.google?.accounts.id.disableAutoSelect()
}
