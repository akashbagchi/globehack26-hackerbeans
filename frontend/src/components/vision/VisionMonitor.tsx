'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { runVisionMonitor } from '../../api/client'
import { getVisionFeedAssignments, isVisionEligibleDriver } from '../../lib/visionFeeds'
import { DEFAULT_START_OFFSET_SECONDS, getDemoStartTime, seekVideoToDemoStart } from '../../lib/videoPlayback'
import { useFleetStore } from '../../store/fleetStore'
import type { Driver, VisionMonitorFrame } from '../../types'

const POLL_INTERVAL_MS = 10_000
const FRAME_WIDTH = 320
const FRAME_HEIGHT = 180
const CAPTURE_STEP_SECONDS = 8

export function VisionMonitor() {
  const drivers = useFleetStore((s) => s.drivers)
  const setVisionResults = useFleetStore((s) => s.setVisionResults)
  const setIsVisionMonitoring = useFleetStore((s) => s.setIsVisionMonitoring)
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const scanTimesRef = useRef<Record<string, number>>({})
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const runningRef = useRef(false)

  const assignments = useMemo(() => getVisionFeedAssignments(drivers), [drivers])
  const activeDrivers = useMemo(
    () => drivers.filter((driver) => isVisionEligibleDriver(driver) && assignments[driver.driver_id]),
    [drivers, assignments]
  )

  useEffect(() => {
    for (const driver of activeDrivers) {
      const video = videoRefs.current[driver.driver_id]
      if (!video) continue
      video.muted = true
      video.loop = false
      video.playsInline = true
      video.pause()
    }
  }, [activeDrivers])

  useEffect(() => {
    if (!activeDrivers.length) return

    let cancelled = false

    async function tick() {
      if (runningRef.current || cancelled) return
      runningRef.current = true
      setIsVisionMonitoring(true)
      try {
        const frames = await collectFrames(activeDrivers, assignments, videoRefs.current, canvasRef, scanTimesRef)
        if (!frames.length) return
        const result = await runVisionMonitor({ frames })
        if (!cancelled) setVisionResults(result.alerts)
      } catch (error) {
        console.error('Vision monitor failed:', error)
        if (!cancelled) setIsVisionMonitoring(false)
      } finally {
        if (!cancelled) setIsVisionMonitoring(false)
        runningRef.current = false
      }
    }

    tick()
    const intervalId = window.setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      setIsVisionMonitoring(false)
    }
  }, [activeDrivers, assignments, setIsVisionMonitoring, setVisionResults])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-[-9999px] top-[-9999px] opacity-0"
    >
      <canvas ref={canvasRef} width={FRAME_WIDTH} height={FRAME_HEIGHT} />
      {activeDrivers.map((driver) => (
        <video
          key={driver.driver_id}
          ref={(node) => {
            videoRefs.current[driver.driver_id] = node
          }}
          src={assignments[driver.driver_id]}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget
            seekVideoToDemoStart(video)
            scanTimesRef.current[driver.driver_id] = getDemoStartTime(video)
          }}
          muted
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          className="h-10 w-10"
        />
      ))}
    </div>
  )
}

async function collectFrames(
  drivers: Driver[],
  assignments: Record<string, string>,
  videoRefs: Record<string, HTMLVideoElement | null>,
  canvasRef: MutableRefObject<HTMLCanvasElement | null>,
  scanTimesRef: MutableRefObject<Record<string, number>>,
): Promise<VisionMonitorFrame[]> {
  const canvas = canvasRef.current
  if (!canvas) return []
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return []

  const frames: VisionMonitorFrame[] = []
  for (const driver of drivers) {
    const video = videoRefs[driver.driver_id]
    if (!video) continue
    await ensureVideoReady(video)

    const scanTime = scanTimesRef.current[driver.driver_id] ?? DEFAULT_START_OFFSET_SECONDS
    await seekForCapture(video, scanTime)
    if (video.videoWidth === 0 || video.videoHeight === 0) continue

    context.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT)
    const frame = canvas.toDataURL('image/jpeg', 0.72)
    scanTimesRef.current[driver.driver_id] = getNextScanTime(video, scanTime)
    frames.push({
      driver_id: driver.driver_id,
      driver_name: driver.name,
      truck_number: driver.truck_number,
      timestamp: new Date().toISOString(),
      video_url: assignments[driver.driver_id] ?? null,
      status: driver.status,
      frame,
      context: {
        city: driver.location.city,
        state: driver.location.state,
        speed_mph: driver.location.speed_mph,
        hos_remaining_hrs: driver.hos.drive_remaining_hrs,
        load_description: driver.current_load?.cargo ?? null,
        eta: driver.current_load?.eta ?? null,
      },
    })
  }

  return frames
}

async function ensureVideoReady(video: HTMLVideoElement) {
  if (video.readyState >= 1) return
  await new Promise<void>((resolve, reject) => {
    const handleLoadedMetadata = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('Video metadata failed to load'))
    }
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('error', handleError)
    }
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('error', handleError)
    video.load()
  }).catch(() => {})
}

async function seekForCapture(video: HTMLVideoElement, time: number) {
  const target = Math.min(time, Math.max(0, (Number.isFinite(video.duration) ? video.duration : time + 1) - 1))
  if (Math.abs(video.currentTime - target) <= 0.35 && video.readyState >= 2) return

  await new Promise<void>((resolve, reject) => {
    const handleSeeked = () => {
      cleanup()
      resolve()
    }
    const handleError = () => {
      cleanup()
      reject(new Error('Video seek failed'))
    }
    const cleanup = () => {
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('error', handleError)
    }
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('error', handleError)
    video.currentTime = target
  }).catch(() => {})
}

function getNextScanTime(video: HTMLVideoElement, currentTime: number) {
  const duration = Number.isFinite(video.duration) ? video.duration : 0
  if (duration <= 0) return currentTime + CAPTURE_STEP_SECONDS
  const maxTime = Math.max(0, duration - 1)
  const next = currentTime + CAPTURE_STEP_SECONDS
  return next >= maxTime ? getDemoStartTime(video) : next
}
