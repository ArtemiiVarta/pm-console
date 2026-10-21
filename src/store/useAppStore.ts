import { create } from 'zustand'

// Minimal store so the app shell can show the project name.
// The full data model and localStorage persistence arrive with Prompt 3.
interface AppState {
  project: { name: string }
}

export const useAppStore = create<AppState>(() => ({
  project: { name: '' },
}))
