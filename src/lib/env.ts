// Which site this build is: Staging (https://artemiivarta.github.io/pm-console/, every push to
// main) or Production (https://artemiivarta.github.io/pm-console-app/, promoted by hand).
// Set at build time with VITE_APP_ENV=production; anything else is Staging.

export type AppEnv = 'staging' | 'production'

export const APP_ENV: AppEnv = import.meta.env.VITE_APP_ENV === 'production' ? 'production' : 'staging'

export const IS_PRODUCTION = APP_ENV === 'production'

/**
 * Browser storage key for this site. Both sites share one origin (artemiivarta.github.io), so
 * Production keys get their own prefix; Staging keeps the original names so its data stays put.
 */
export function storageKey(name: string, env: AppEnv = APP_ENV): string {
  return env === 'production' ? `pm-console-prod-${name}` : `pm-console-${name}`
}

/** Data file in the GitHub data repository: Staging never touches Production's projects. */
export function dataPath(env: AppEnv = APP_ENV): string {
  return env === 'production' ? 'projects.json' : 'staging/projects.json'
}

/** PM Console API (Cloudflare Worker in /worker): Google sign-in, people, and project data. */
export const API_URL: string = import.meta.env.VITE_API_URL ?? ''

/** Google OAuth Web client ID (public). */
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
