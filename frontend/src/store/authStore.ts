import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Dispatcher {
  dispatcher_id: string
  name: string
  email: string
  fleet_id: string
}

interface AuthState {
  token: string | null
  dispatcher: Dispatcher | null
  setAuth: (token: string, dispatcher: Dispatcher) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      dispatcher: null,
      setAuth: (token, dispatcher) => set({ token, dispatcher }),
      clearAuth: () => set({ token: null, dispatcher: null }),
    }),
    { name: 'sauron-auth' }
  )
)
