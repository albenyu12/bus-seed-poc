import { describe, expect, it } from 'vitest'
import {
  GPS_STALE_AFTER_MS,
  isGpsStale,
} from '../src/application/locationHealth'

describe('location health', () => {
  it('uses the session start when no callback has arrived', () => {
    expect(isGpsStale(30_000, undefined, 0)).toBe(true)
    expect(isGpsStale(GPS_STALE_AFTER_MS - 1, undefined, 0)).toBe(false)
  })

  it('uses the latest callback time after a sample arrives', () => {
    expect(isGpsStale(49_999, 20_000, 0)).toBe(false)
    expect(isGpsStale(50_000, 20_000, 0)).toBe(true)
  })
})
