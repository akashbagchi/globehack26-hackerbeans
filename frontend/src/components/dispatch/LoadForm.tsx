import { useState } from 'react'
import { fetchDispatchRecommendations } from '../../api/client'
import { useFleetStore } from '../../store/fleetStore'

export function LoadForm() {
  const [pickup, setPickup] = useState('')
  const [destination, setDestination] = useState('')
  const [cargo, setCargo] = useState('')
  const [weight, setWeight] = useState('')
  const isDispatching = useFleetStore((s) => s.isDispatching)
  const setIsDispatching = useFleetStore((s) => s.setIsDispatching)
  const setDispatchRecommendations = useFleetStore((s) => s.setDispatchRecommendations)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pickup || !destination || !cargo) return
    setIsDispatching(true)
    try {
      const result = await fetchDispatchRecommendations({
        pickup,
        destination,
        cargo,
        weight_lbs: parseInt(weight) || 20000,
      })
      setDispatchRecommendations(result.recommendations, result.dispatch_note)
    } catch (err) {
      setIsDispatching(false)
    }
  }

  const inputClass =
    'w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/60 focus:bg-gray-800 transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Pickup</label>
          <input
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
            placeholder="Chicago, IL"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Destination</label>
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Houston, TX"
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Cargo</label>
          <input
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            placeholder="Electronics"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Weight (lbs)</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="20000"
            className={inputClass}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={isDispatching || !pickup || !destination || !cargo}
        className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-gray-900 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {isDispatching ? (
          <>
            <span className="w-4 h-4 border-2 border-gray-600 border-t-amber-400 rounded-full animate-spin" />
            Finding best drivers...
          </>
        ) : (
          'Find Best Driver'
        )}
      </button>
    </form>
  )
}
