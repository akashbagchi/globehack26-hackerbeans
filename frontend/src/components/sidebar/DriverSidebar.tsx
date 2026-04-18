import { useState } from 'react'
import { Search } from 'lucide-react'
import { useFleetStore } from '../../store/fleetStore'
import { DriverCard } from './DriverCard'

export function DriverSidebar() {
  const drivers = useFleetStore((s) => s.drivers)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = drivers.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || d.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Drivers</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Driver"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 text-gray-700 placeholder-gray-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:border-blue-400"
          >
            <option value="all">All</option>
            <option value="driving">Driving</option>
            <option value="idle">Idle</option>
            <option value="off_duty">Off Duty</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            No drivers found
          </div>
        ) : (
          filtered.map((driver) => <DriverCard key={driver.driver_id} driver={driver} />)
        )}
      </div>
    </div>
  )
}
