export const GPS_STALE_AFTER_MS = 30_000

export function isGpsStale(
  now: number,
  lastReceivedAt: number | undefined,
  sessionStartedAt: number,
): boolean {
  return now - (lastReceivedAt ?? sessionStartedAt) >= GPS_STALE_AFTER_MS
}
