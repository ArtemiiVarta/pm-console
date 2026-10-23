import { useAuth } from '@/features/auth/useAuth'
import type { Role } from '@/lib/api'

/** Signs a test person in without Google (no real token is ever used in tests). */
export function signInForTest(role: Role = 'admin', email = 'owner@example.com') {
  useAuth.getState().signIn({
    token: 'test-session',
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    user: { email, name: 'Test Person', picture: '', role },
  })
}
