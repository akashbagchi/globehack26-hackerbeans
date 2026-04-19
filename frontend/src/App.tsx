import { useFleetPolling } from './hooks/useFleetPolling'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './components/auth/LoginPage'
import { useAuthStore } from './store/authStore'

export default function App() {
  const token = useAuthStore((s) => s.token)
  useFleetPolling()
  if (!token) return <LoginPage />
  return <AppShell />
}
