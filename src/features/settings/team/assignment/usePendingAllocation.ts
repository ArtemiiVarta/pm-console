import { create } from 'zustand'
import { addPendingChanges, type PendingChange, type PendingChanges } from '@/lib/assignment'
import type { TeamMember } from '@/store/types'

/**
 * Unsaved edits in the Planned allocation grid. Kept in memory (not persisted) so they survive
 * switching sub-tabs, until the user saves or discards them.
 */
interface PendingAllocationState {
  pending: PendingChanges
  add: (changes: PendingChange[], members: TeamMember[]) => void
  discard: () => void
}

export const usePendingAllocation = create<PendingAllocationState>((set) => ({
  pending: {},
  add: (changes, members) =>
    set((state) => ({ pending: addPendingChanges(state.pending, changes, members) })),
  discard: () => set({ pending: {} }),
}))
