import { useFleetPolling } from './hooks/useFleetPolling'
import { useTelemetryPolling } from './hooks/useTelemetryPolling'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './components/auth/LoginPage'
import { useAuthStore } from './store/authStore'

export default function App() {
  const token = useAuthStore((s) => s.token)
  useFleetPolling()
  useTelemetryPolling()
  if (!token) return <LoginPage />
  return <AppShell />
}
