import { fetchSimulation } from '../../api/client'
import { useFleetStore } from '../../store/fleetStore'
import { useUIStore } from '../../store/uiStore'

interface SimulateButtonProps {
  pickup: string
  destination: string
}

export function SimulateButton({ pickup, destination }: SimulateButtonProps) {
  const selectedMatchId = useFleetStore((s) => s.selectedMatchId)
  const isSimulating = useFleetStore((s) => s.isSimulating)
  const setIsSimulating = useFleetStore((s) => s.setIsSimulating)
  const setSimulatedRoute = useFleetStore((s) => s.setSimulatedRoute)
  const setSimulationResult = useFleetStore((s) => s.setSimulationResult)
  const setNarratorText = useFleetStore((s) => s.setNarratorText)
  const setShowNarrator = useUIStore((s) => s.setShowNarrator)

  async function handleSimulate() {
    if (!selectedMatchId || !pickup || !destination) return
    setIsSimulating(true)
    try {
      const result = await fetchSimulation({ driver_id: selectedMatchId, pickup, destination })
      setSimulatedRoute(result.route)
      setSimulationResult(result)
      setNarratorText(result.narrator_text)
      setShowNarrator(true)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSimulating(false)
    }
  }

  return (
    <button
      onClick={handleSimulate}
      disabled={!selectedMatchId || isSimulating}
      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
    >
      {isSimulating ? (
        <><span className="w-4 h-4 border-2 border-indigo-300 border-t-white rounded-full animate-spin" />Simulating...</>
      ) : (
        '⟳ Simulate Assignment'
      )}
    </button>
  )
}
