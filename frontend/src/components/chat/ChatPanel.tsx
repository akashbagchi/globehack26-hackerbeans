import { useRef, useEffect } from 'react'
import { useStreamingChat } from '../../hooks/useStreamingChat'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'

export function ChatPanel() {
  const { messages, isStreaming, sendMessage } = useStreamingChat()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#dadce0] shrink-0">
        <h2 className="text-sm font-semibold text-[#202124]">Dispatcher Chat</h2>
        <p className="text-xs text-[#5f6368] mt-0.5">Ask Sauron anything about your fleet</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
            <div className="w-10 h-10 rounded-full bg-[#e8f0fe] flex items-center justify-center text-[#1a73e8] font-bold text-sm">S</div>
            <p className="text-sm text-[#5f6368]">Ask about your fleet</p>
          </div>
        )}
        {messages.map((msg, i) => <ChatMessage key={i} message={msg} />)}
        {isStreaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex items-center gap-1.5 pl-8">
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={sendMessage} disabled={isStreaming} />
    </div>
  )
}
