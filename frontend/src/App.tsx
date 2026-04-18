import { useFleetPolling } from './hooks/useFleetPolling'
import { AppShell } from './components/layout/AppShell'

export default function App() {
  useFleetPolling()
  return <AppShell />
}
