import ReactMarkdown from 'react-markdown'
import type { ChatMessage as ChatMessageType } from '../../types'

export function ChatMessage({ message }: { message: ChatMessageType }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-sm bg-blue-600 text-white text-sm">
          {message.content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">S</div>
      <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tl-sm bg-gray-100 text-sm text-gray-700 prose-sm">
        <ReactMarkdown skipHtml>{message.content}</ReactMarkdown>
      </div>
    </div>
  )
}
