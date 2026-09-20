import type { LocationSample, Stop } from './types'

const EARTH_RADIUS_METERS = 6_371_000
const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180

export function distanceInMeters(
  first: Pick<LocationSample, 'latitude' | 'longitude'>,
  second: Pick<Stop, 'latitude' | 'longitude'>,
): number {
  const latitudeDelta = degreesToRadians(second.latitude - first.latitude)
  const longitudeDelta = degreesToRadians(second.longitude - first.longitude)
  const firstLatitude = degreesToRadians(first.latitude)
  const secondLatitude = degreesToRadians(second.latitude)

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine))
}
