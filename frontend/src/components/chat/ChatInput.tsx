import { useState, useRef } from 'react'
import { Send } from 'lucide-react'

const SUGGESTIONS = [
  "Who has the most HOS left?",
  "Who's closest to Chicago?",
  "Which driver is cheapest today?",
  "Who's low on fuel?",
]

interface ChatInputProps {
  onSend: (text: string) => void
  disabled: boolean
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="p-3 border-t border-gray-100 shrink-0">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => { setText(s); ref.current?.focus() }}
            className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-full text-gray-500 transition-colors">
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-end">
        <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Ask about your fleet..." rows={1} disabled={disabled}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400 resize-none disabled:opacity-50"
          style={{ maxHeight: 80 }} />
        <button onClick={handleSend} disabled={disabled || !text.trim()}
          className="w-9 h-9 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 rounded-xl flex items-center justify-center transition-colors shrink-0">
          {disabled
            ? <span className="w-3.5 h-3.5 border-2 border-blue-300 border-t-white rounded-full animate-spin" />
            : <Send size={14} className="text-white" />}
        </button>
      </div>
    </div>
  )
}
