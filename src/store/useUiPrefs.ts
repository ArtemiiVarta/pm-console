import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { storageKey } from '@/lib/env'

// Per-browser view preferences, kept apart from project data (not exported or baselined).
interface UiPrefs {
  /** Cost, price and margin columns in Team members, and cost/revenue rows under the allocation grid. */
  showFinancials: boolean
  setShowFinancials: (show: boolean) => void
}

export const useUiPrefs = create<UiPrefs>()(
  persist(
    (set) => ({
      showFinancials: true,
      setShowFinancials: (showFinancials) => set({ showFinancials }),
    }),
    {
      name: storageKey('ui'),
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ showFinancials }) => ({ showFinancials }),
    },
  ),
)
