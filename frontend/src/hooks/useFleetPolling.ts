import { useEffect } from 'react'
import { fetchDrivers } from '../api/client'
import { useFleetStore } from '../store/fleetStore'

const POLL_INTERVAL = 30000

export function useFleetPolling() {
  const setDrivers = useFleetStore((s) => s.setDrivers)

  useEffect(() => {
    async function load() {
      try {
        const { drivers, source } = await fetchDrivers()
        setDrivers(drivers, source as 'navpro' | 'mock')
      } catch (e) {
        console.error('Fleet poll failed:', e)
      }
    }

    load()
    const id = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [setDrivers])
}
