import ReactMarkdown from 'react-markdown'
import type { ChatMessage as ChatMessageType } from '../../types'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-sm bg-amber-500/20 border border-amber-500/30 text-sm text-amber-100">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[9px] font-bold text-amber-400 shrink-0 mt-0.5">
        S
      </div>
      <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tl-sm bg-gray-800/60 border border-gray-700/50 text-sm text-gray-300 prose-sm prose-invert">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>
    </div>
  )
}
