export type StopId = 'A' | 'B'

export type TripStatus =
  | 'IDLE'
  | 'AT_A'
  | 'SEED_READY'
  | 'MOVING'
  | 'APPROACHING_B'
  | 'AT_B'
  | 'PROPAGATED'

export interface Stop {
  id: StopId
  latitude: number
  longitude: number
}

export interface TripThresholds {
  aEntryMeters: number
  aDwellMeters: number
  aExitMeters: number
  aDwellDurationMs: number
  bApproachMeters: number
  bArrivalMeters: number
  bExitMeters: number
  bDwellDurationMs: number
  maxAcceptedAccuracyMeters: number
}

export const DEFAULT_THRESHOLDS: TripThresholds = {
  aEntryMeters: 40,
  aDwellMeters: 40,
  aExitMeters: 60,
  aDwellDurationMs: 20_000,
  bApproachMeters: 80,
  bArrivalMeters: 40,
  bExitMeters: 60,
  bDwellDurationMs: 15_000,
  maxAcceptedAccuracyMeters: 50,
}

/** Normalized input shared by real and fake location sources. */
export interface LocationSample {
  timestamp: number
  latitude: number
  longitude: number
  accuracy: number
}

/** Location data after the pure location interpretation step. */
export interface LocationObservation extends LocationSample {
  distanceToA: number
  distanceToB: number
}

export type LocationInterpretation =
  | {
      kind: 'valid'
      observation: LocationObservation
    }
  | {
      kind: 'invalid'
      sample: LocationSample
      reason:
        | 'invalid-timestamp'
        | 'invalid-latitude'
        | 'invalid-longitude'
        | 'invalid-accuracy'
    }
  | {
      kind: 'ignored'
      sample: LocationSample
      observation: LocationObservation
      reason: 'low-accuracy'
    }

export interface SeedPropagation {
  id: string
  originStopId: StopId
  destinationStopId: StopId
  propagatedAt: number
}

export interface TripState {
  status: TripStatus
  aDwellStartedAt?: number
  bDwellStartedAt?: number
  seed?: {
    acquiredAt: number
    originStopId: StopId
  }
  propagation?: SeedPropagation
}

export type DomainEvent =
  | {
      type: 'entered-a'
      timestamp: number
      distanceMeters: number
    }
  | {
      type: 'acquired-seed'
      timestamp: number
      originStopId: StopId
    }
  | {
      type: 'left-a'
      timestamp: number
      distanceMeters: number
    }
  | {
      type: 'approaching-b'
      timestamp: number
      distanceMeters: number
    }
  | {
      type: 'arrived-at-b'
      timestamp: number
      distanceMeters: number
    }
  | {
      type: 'cancelled-b-dwell'
      timestamp: number
      distanceMeters: number
    }
  | {
      type: 'propagated-seed'
      timestamp: number
      propagation: SeedPropagation
    }

export interface TripTransition {
  state: TripState
  events: DomainEvent[]
}

export const initialTripState = (): TripState => ({
  status: 'IDLE',
})
