import type { LocationSample } from '../domain/types'
import {
  LocationSourceError,
  type LocationSource,
} from '../ports/locationSource'

export class BrowserLocationSource implements LocationSource {
  start(
    onSample: (sample: LocationSample) => void,
    onError: (error: unknown) => void,
  ): () => void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onError(
        new LocationSourceError(
          'unsupported',
          'Geolocation API is not available',
        ),
      )
      return () => undefined
    }

    let watchId: number | undefined
    let stopped = false

    const stop = (): void => {
      if (stopped) return
      stopped = true
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId)
        watchId = undefined
      }
    }

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (stopped) return
          onSample({
            timestamp: position.timestamp,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
        },
        (error) => {
          const mappedError = mapGeolocationError(error)
          onError(mappedError)
          if (mappedError.code === 'permission-denied') stop()
        },
        { enableHighAccuracy: true },
      )
    } catch {
      onError(
        new LocationSourceError(
          'watch-failed',
          'Failed to start geolocation watch',
        ),
      )
      stop()
    }

    return stop
  }
}

function mapGeolocationError(
  error: GeolocationPositionError,
): LocationSourceError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new LocationSourceError(
        'permission-denied',
        'Location permission was denied',
      )
    case error.POSITION_UNAVAILABLE:
      return new LocationSourceError(
        'position-unavailable',
        'The current position is unavailable',
      )
    case error.TIMEOUT:
      return new LocationSourceError(
        'timeout',
        'Geolocation request timed out',
      )
    default:
      return new LocationSourceError('watch-failed', 'Geolocation failed')
  }
}
