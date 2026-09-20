import type { LocationSample } from '../domain/types'

export type LocationSourceErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'position-unavailable'
  | 'timeout'
  | 'watch-failed'

export class LocationSourceError extends Error {
  readonly code: LocationSourceErrorCode

  constructor(code: LocationSourceErrorCode, message: string) {
    super(message)
    this.name = 'LocationSourceError'
    this.code = code
  }
}

export function isLocationSourceError(
  error: unknown,
): error is LocationSourceError {
  return error instanceof LocationSourceError
}

export interface LocationSource {
  start(
    onSample: (sample: LocationSample) => void,
    onError: (error: unknown) => void,
  ): () => void
}
