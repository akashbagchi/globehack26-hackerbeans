'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { seekVideoToDemoStart } from '../../lib/videoPlayback'

interface VisionVideoPlayerProps {
  src: string
  className?: string
  controls?: boolean
  muted?: boolean
  loop?: boolean
  autoPlay?: boolean
}

export function VisionVideoPlayer({
  src,
  className,
  controls = false,
  muted = true,
  loop = true,
  autoPlay = true,
}: VisionVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    setStatus('loading')
  }, [src])

  return (
    <div className={`relative overflow-hidden bg-[#0f172a] ${className ?? ''}`}>
      <video
        ref={videoRef}
        key={src}
        className="h-full w-full object-cover"
        controls={controls}
        muted={muted}
        loop={loop}
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => {
          seekVideoToDemoStart(event.currentTarget)
        }}
        onCanPlay={(event) => {
          setStatus('ready')
          if (autoPlay) {
            event.currentTarget.play().catch(() => {})
          }
        }}
        onPlaying={() => setStatus('ready')}
        onError={() => {
          console.error(`Vision video failed to load: ${src}`)
          setStatus('error')
        }}
      >
        <source src={src} type="video/mp4" />
      </video>

      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0f172a] text-slate-300">
          <div className="flex items-center gap-2 rounded-full bg-black/30 px-3 py-2 text-sm">
            <LoaderCircle size={16} className="animate-spin" />
            Loading feed…
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0f172a] px-6 text-center text-slate-200">
          <AlertTriangle size={18} className="text-orange-400" />
          <div className="text-sm font-medium">Video could not be loaded</div>
          <div className="text-xs text-slate-400 break-all">{src}</div>
        </div>
      )}
    </div>
  )
}
