import { create } from 'zustand'

type Panel = 'dispatch' | 'costs' | 'chat'

interface UIState {
  activePanel: Panel
  showNarrator: boolean
  mapReady: boolean
  sidebarCollapsed: boolean
  setActivePanel: (panel: Panel) => void
  setShowNarrator: (show: boolean) => void
  setMapReady: (ready: boolean) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  activePanel: 'dispatch',
  showNarrator: false,
  mapReady: false,
  sidebarCollapsed: false,
  setActivePanel: (panel) => set({ activePanel: panel }),
  setShowNarrator: (show) => set({ showNarrator: show }),
  setMapReady: (ready) => set({ mapReady: ready }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
