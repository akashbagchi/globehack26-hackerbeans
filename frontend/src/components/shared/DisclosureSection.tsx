'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface DisclosureSectionProps {
  title: string
  summary?: string
  badge?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  resetKey?: string | number
  className?: string
  bodyClassName?: string
}

export function DisclosureSection({
  title,
  summary,
  badge,
  children,
  defaultOpen = false,
  className = '',
  bodyClassName = '',
}: DisclosureSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`overflow-hidden rounded-2xl border border-[#dadce0] bg-white ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#f8f9fa] transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#202124]">{title}</div>
          {summary && (
            <div className="mt-1 text-xs text-[#5f6368]">
              {summary}
            </div>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
        <ChevronDown
          size={16}
          className={`shrink-0 text-[#5f6368] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className={`border-t border-[#dadce0] px-4 py-4 ${bodyClassName}`.trim()}>
          {children}
        </div>
      )}
    </div>
  )
}
