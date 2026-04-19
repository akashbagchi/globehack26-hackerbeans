import { create } from 'zustand'

type Panel = 'dispatch' | 'costs' | 'chat'
type DispatchMode = 'board' | 'drivers'

interface UIState {
  activePanel: Panel
  dispatchMode: DispatchMode
  showNarrator: boolean
  mapReady: boolean
  sidebarCollapsed: boolean
  setActivePanel: (panel: Panel) => void
  setDispatchMode: (mode: DispatchMode) => void
  setShowNarrator: (show: boolean) => void
  setMapReady: (ready: boolean) => void
  toggleSidebar: () => void
}

export const useUIStore = create<UIState>((set) => ({
  activePanel: 'dispatch',
  dispatchMode: 'board',
  showNarrator: false,
  mapReady: false,
  sidebarCollapsed: false,
  setActivePanel: (panel) => set({ activePanel: panel }),
  setDispatchMode: (mode) => set({ dispatchMode: mode }),
  setShowNarrator: (show) => set({ showNarrator: show }),
  setMapReady: (ready) => set({ mapReady: ready }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
