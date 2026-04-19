import { useState, useRef, useCallback } from 'react'
import { streamChat } from '../api/client'
import { useFleetStore } from '../store/fleetStore'
import type { ChatMessage } from '../types'

export function useStreamingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<(() => void) | null>(null)
  const drivers = useFleetStore((s) => s.drivers)

  const sendMessage = useCallback((userText: string) => {
    const userMsg: ChatMessage = { role: 'user', content: userText }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    const cancel = streamChat(
      [...messages, userMsg],
      drivers,
      (token) => {
        setMessages((prev) => {
          const updated = [...prev]
          const idx = updated.length - 1
          updated[idx] = { ...updated[idx], content: updated[idx].content + token }
          return updated
        })
      },
      () => setIsStreaming(false),
    )

    abortRef.current = cancel
    return cancel
  }, [messages, drivers])

  const stopStreaming = useCallback(() => {
    abortRef.current?.()
    setIsStreaming(false)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isStreaming, sendMessage, stopStreaming, clearMessages }
}
