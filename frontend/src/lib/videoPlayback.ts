export const DEFAULT_START_OFFSET_SECONDS = 60

export function getDemoStartTime(video: HTMLVideoElement, startAtSeconds = DEFAULT_START_OFFSET_SECONDS) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) return startAtSeconds
  return Math.min(startAtSeconds, Math.max(0, video.duration - 1))
}

export function seekVideoToDemoStart(video: HTMLVideoElement, startAtSeconds = DEFAULT_START_OFFSET_SECONDS) {
  const applySeek = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return
    const target = getDemoStartTime(video, startAtSeconds)
    if (Math.abs(video.currentTime - target) > 0.5) {
      video.currentTime = target
    }
  }

  if (video.readyState >= 1) {
    applySeek()
    return
  }

  const handleLoadedMetadata = () => {
    applySeek()
    video.removeEventListener('loadedmetadata', handleLoadedMetadata)
  }

  video.addEventListener('loadedmetadata', handleLoadedMetadata)
}
