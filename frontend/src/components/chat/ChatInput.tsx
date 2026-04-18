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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleSend() {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-3 border-t border-gray-800/60 shrink-0">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setText(s); textareaRef.current?.focus() }}
            className="text-[10px] px-2 py-1 bg-gray-800/60 border border-gray-700/50 rounded-full text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your fleet..."
          rows={1}
          disabled={disabled}
          className="flex-1 bg-gray-800/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/60 resize-none disabled:opacity-50 transition-colors"
          style={{ maxHeight: 80 }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="w-9 h-9 bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 rounded-xl flex items-center justify-center transition-colors shrink-0"
        >
          {disabled ? (
            <span className="w-3.5 h-3.5 border-2 border-gray-600 border-t-amber-400 rounded-full animate-spin" />
          ) : (
            <Send size={14} className="text-gray-900" />
          )}
        </button>
      </div>
    </div>
  )
}
