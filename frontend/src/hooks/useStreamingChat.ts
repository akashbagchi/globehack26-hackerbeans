import { useState, useRef, useCallback } from 'react'
import { streamChat } from '../api/client'
import type { ChatMessage } from '../types'

export function useStreamingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const abortRef = useRef<(() => void) | null>(null)

  const sendMessage = useCallback((userText: string) => {
    const userMsg: ChatMessage = { role: 'user', content: userText }
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    const cancel = streamChat([...messages, userMsg], (token) => {
      setMessages((prev) => {
        const updated = [...prev]
        const idx = updated.length - 1
        updated[idx] = { ...updated[idx], content: updated[idx].content + token }
        return updated
      })
    })

    abortRef.current = cancel

    // Detect done by checking if the stream closes
    // We'll resolve streaming state after a reasonable idle
    const checkDone = setInterval(() => {
      setIsStreaming((current) => {
        if (!current) clearInterval(checkDone)
        return current
      })
    }, 500)

    setTimeout(() => {
      setIsStreaming(false)
      clearInterval(checkDone)
    }, 60000)

    return cancel
  }, [messages])

  const stopStreaming = useCallback(() => {
    abortRef.current?.()
    setIsStreaming(false)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, isStreaming, sendMessage, stopStreaming, clearMessages }
}
