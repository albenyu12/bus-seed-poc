export function formatRelativeTime(
  timestamp: number,
  timelineStartTimestamp: number,
): string {
  const elapsedSeconds = Math.max(
    0,
    (timestamp - timelineStartTimestamp) / 1_000,
  )
  return '+' + elapsedSeconds.toFixed(1) + 's'
}
