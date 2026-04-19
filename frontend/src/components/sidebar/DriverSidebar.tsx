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
      {/* Panel tabs */}
      <div className="flex border-b border-[#dadce0] shrink-0">
        <button className="flex-1 py-3 text-sm font-medium text-[#1a73e8] border-b-2 border-[#1a73e8]">
          Find Drivers
        </button>
        <button className="flex-1 py-3 text-sm font-medium text-[#5f6368] border-b-2 border-transparent hover:text-[#202124] hover:bg-[#f1f3f4] transition-colors">
          Search Loads
        </button>
      </div>

      {/* Filters */}
      <div className="px-4 py-3 border-b border-[#dadce0] shrink-0">
        <p className="text-sm font-semibold text-[#202124] mb-3">Drivers</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Driver"
              className="w-full pl-8 pr-3 py-2 text-sm border border-[#dadce0] rounded bg-white focus:outline-none focus:border-[#1a73e8] text-[#202124] placeholder-[#5f6368]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-[#dadce0] rounded px-2 py-2 bg-white text-[#5f6368] focus:outline-none focus:border-[#1a73e8]"
          >
            <option value="all">Driver status</option>
            <option value="driving">Driving</option>
            <option value="idle">Idle</option>
            <option value="off_duty">Off Duty</option>
          </select>
        </div>
      </div>

      {/* Driver list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <div className="w-12 h-12 rounded-full bg-[#f1f3f4] flex items-center justify-center text-[#5f6368] text-xl">
              ≡
            </div>
            <p className="text-sm font-medium text-[#202124]">No Drivers Found</p>
            <p className="text-xs text-[#5f6368] text-center px-8">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          filtered.map((driver, i) => <DriverCard key={driver.driver_id} driver={driver} index={i} />)
        )}
      </div>
    </div>
  )
}
