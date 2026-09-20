import { distanceInMeters } from './geo'
import type {
  LocationInterpretation,
  LocationSample,
  Stop,
  StopId,
} from './types'

const isValidLatitude = (latitude: number) =>
  Number.isFinite(latitude) && latitude >= -90 && latitude <= 90

const isValidLongitude = (longitude: number) =>
  Number.isFinite(longitude) && longitude >= -180 && longitude <= 180

const isValidTimestamp = (timestamp: number) =>
  Number.isFinite(timestamp) && timestamp >= 0

const isValidAccuracy = (accuracy: number) =>
  Number.isFinite(accuracy) && accuracy >= 0

export function calculateObservation(
  sample: LocationSample,
  stops: Record<StopId, Stop>,
  maxAcceptedAccuracyMeters = Number.POSITIVE_INFINITY,
): LocationInterpretation {
  if (!isValidTimestamp(sample.timestamp)) {
    return { kind: 'invalid', sample, reason: 'invalid-timestamp' }
  }

  if (!isValidLatitude(sample.latitude)) {
    return { kind: 'invalid', sample, reason: 'invalid-latitude' }
  }

  if (!isValidLongitude(sample.longitude)) {
    return { kind: 'invalid', sample, reason: 'invalid-longitude' }
  }

  if (!isValidAccuracy(sample.accuracy)) {
    return { kind: 'invalid', sample, reason: 'invalid-accuracy' }
  }

  const observation = {
    ...sample,
    distanceToA: distanceInMeters(sample, stops.A),
    distanceToB: distanceInMeters(sample, stops.B),
  }

  if (sample.accuracy > maxAcceptedAccuracyMeters) {
    return {
      kind: 'ignored',
      sample,
      observation,
      reason: 'low-accuracy',
    }
  }

  return { kind: 'valid', observation }
}
