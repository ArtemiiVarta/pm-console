// Who may use the console, and with which role. Stored as users.json in the data repository,
// shared by Staging and Production. The owner (OWNER_EMAIL) is always an admin and is not
// listed in the file, so nobody can lock them out.

import { readFile, writeFile, type Repo } from './github'

export type Role = 'admin' | 'user'

export interface UserEntry {
  email: string
  role: Role
  addedAt: string
  addedBy: string
}

interface UsersFile {
  users: UserEntry[]
}

export const USERS_PATH = 'users.json'
const CACHE_MS = 30_000

let cache: { sha: string | null; users: UserEntry[]; until: number } | null = null

export function resetUsersCache() {
  cache = null
}

function parseUsers(text: string): UserEntry[] {
  const parsed = JSON.parse(text) as Partial<UsersFile>
  return (parsed.users ?? []).filter(
    (user): user is UserEntry =>
      typeof user?.email === 'string' && (user.role === 'admin' || user.role === 'user'),
  )
}

async function load(repo: Repo, fresh = false) {
  if (!fresh && cache && cache.until > Date.now()) return cache
  const file = await readFile(repo, USERS_PATH)
  cache = {
    sha: file?.sha ?? null,
    users: file ? parseUsers(file.text) : [],
    until: Date.now() + CACHE_MS,
  }
  return cache
}

export async function listUsers(repo: Repo): Promise<UserEntry[]> {
  return (await load(repo)).users
}

/** The role for an email, or null when it has no access. */
export async function getRole(repo: Repo, owner: string, email: string): Promise<Role | null> {
  const normalized = email.toLowerCase()
  if (normalized === owner.toLowerCase()) return 'admin'
  const users = await listUsers(repo)
  return users.find((user) => user.email === normalized)?.role ?? null
}

/** Applies a change to the list and saves it, retrying once if someone saved in between. */
export async function updateUsers(
  repo: Repo,
  change: (users: UserEntry[]) => UserEntry[],
  message: string,
): Promise<UserEntry[]> {
  for (let attempt = 0; ; attempt += 1) {
    const current = await load(repo, true)
    const users = change(current.users).sort((a, b) => a.email.localeCompare(b.email))
    try {
      const sha = await writeFile(
        repo,
        USERS_PATH,
        `${JSON.stringify({ users } satisfies UsersFile, null, 2)}\n`,
        current.sha,
        message,
      )
      cache = { sha, users, until: Date.now() + CACHE_MS }
      return users
    } catch (error) {
      if (attempt > 0) throw error
    }
  }
}
