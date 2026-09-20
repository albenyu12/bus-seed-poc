import { describe, expect, it } from 'vitest'
import { calculateObservation } from '../src/domain/locationLogic'
import { distanceInMeters } from '../src/domain/geo'
import {
  type LocationSample,
  type Stop,
} from '../src/domain/types'

const METERS_PER_LATITUDE_DEGREE = 111_320
const stops: Record<'A' | 'B', Stop> = {
  A: { id: 'A', latitude: 0, longitude: 0 },
  B: {
    id: 'B',
    latitude: 1_000 / METERS_PER_LATITUDE_DEGREE,
    longitude: 0,
  },
}

const sample: LocationSample = {
  timestamp: 1_000,
  latitude: 20 / METERS_PER_LATITUDE_DEGREE,
  longitude: 0,
  accuracy: 5,
}

describe('distanceInMeters', () => {
  it('returns zero for identical coordinates', () => {
    expect(
      distanceInMeters(
        { latitude: 37, longitude: 127 },
        { latitude: 37, longitude: 127 },
      ),
    ).toBe(0)
  })

  it('calculates a distance close to one kilometer', () => {
    const distance = distanceInMeters(
      { latitude: 0, longitude: 0 },
      stops.B,
    )

    expect(distance).toBeGreaterThan(990)
    expect(distance).toBeLessThan(1_010)
  })
})

describe('calculateObservation', () => {
  it('adds distances without adding domain state', () => {
    const result = calculateObservation(sample, stops)

    expect(result.kind).toBe('valid')
    if (result.kind === 'valid') {
      expect(result.observation).toMatchObject({
        ...sample,
        distanceToA: expect.any(Number),
        distanceToB: expect.any(Number),
      })
      expect('state' in result.observation).toBe(false)
    }
  })

  it.each([
    ['timestamp', { ...sample, timestamp: Number.NaN }, 'invalid-timestamp'],
    ['latitude', { ...sample, latitude: 91 }, 'invalid-latitude'],
    ['longitude', { ...sample, longitude: 181 }, 'invalid-longitude'],
    ['accuracy', { ...sample, accuracy: -1 }, 'invalid-accuracy'],
  ])('rejects invalid %s', (_field, invalidSample, reason) => {
    expect(calculateObservation(invalidSample, stops)).toEqual({
      kind: 'invalid',
      sample: invalidSample,
      reason,
    })
  })
})
