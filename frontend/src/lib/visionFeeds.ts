import type { Driver } from '../types'

export const VISION_VIDEO_COUNT = 7

export function isVisionEligibleDriver(driver: Driver): boolean {
  return driver.status === 'driving'
}

export function getVisionFeedAssignments(drivers: Driver[]): Record<string, string> {
  const eligible = [...drivers]
    .filter(isVisionEligibleDriver)
    .sort((a, b) => a.driver_id.localeCompare(b.driver_id))

  return eligible.reduce<Record<string, string>>((acc, driver, index) => {
    acc[driver.driver_id] = `/videos/vision/${(index % VISION_VIDEO_COUNT) + 1}.mp4`
    return acc
  }, {})
}
