import {
  type DomainEvent,
  type LocationObservation,
  type TripThresholds,
  type TripState,
  type TripTransition,
} from './types'

const cloneState = (state: TripState): TripState => ({
  ...state,
  seed: state.seed ? { ...state.seed } : undefined,
  propagation: state.propagation ? { ...state.propagation } : undefined,
})

export function resetDwellAfterLowAccuracy(state: TripState): TripState {
  const nextState = cloneState(state)
  nextState.aDwellStartedAt = undefined
  nextState.bDwellStartedAt = undefined
  return nextState
}

export function reduceTrip(
  previousState: TripState,
  observation: LocationObservation,
  thresholds: TripThresholds,
): TripTransition {
  const state = cloneState(previousState)
  const events: DomainEvent[] = []
  const { distanceToA, distanceToB, timestamp } = observation

  switch (state.status) {
    case 'IDLE':
      if (distanceToA <= thresholds.aEntryMeters) {
        state.status = 'AT_A'
        state.aDwellStartedAt = timestamp
        events.push({
          type: 'entered-a',
          timestamp,
          distanceMeters: distanceToA,
        })
      }
      break

    case 'AT_A':
      if (distanceToA >= thresholds.aExitMeters) {
        state.status = 'IDLE'
        state.aDwellStartedAt = undefined
        events.push({
          type: 'left-a',
          timestamp,
          distanceMeters: distanceToA,
        })
        break
      }

      if (distanceToA > thresholds.aDwellMeters) {
        state.aDwellStartedAt = undefined
        break
      }

      state.aDwellStartedAt ??= timestamp
      if (timestamp - state.aDwellStartedAt >= thresholds.aDwellDurationMs) {
        state.status = 'SEED_READY'
        state.seed = {
          acquiredAt: timestamp,
          originStopId: 'A',
        }
        state.aDwellStartedAt = undefined
        events.push({
          type: 'acquired-seed',
          timestamp,
          originStopId: 'A',
        })
      }
      break

    case 'SEED_READY':
      if (distanceToA >= thresholds.aExitMeters) {
        state.status = 'MOVING'
        events.push({
          type: 'left-a',
          timestamp,
          distanceMeters: distanceToA,
        })
      }
      break

    case 'MOVING':
      if (distanceToB <= thresholds.bApproachMeters) {
        state.status = 'APPROACHING_B'
        state.bDwellStartedAt = undefined
        events.push({
          type: 'approaching-b',
          timestamp,
          distanceMeters: distanceToB,
        })
      }
      break

    case 'APPROACHING_B':
      if (distanceToB > thresholds.bApproachMeters) {
        state.status = 'MOVING'
        state.bDwellStartedAt = undefined
        break
      }

      if (
        distanceToB >= thresholds.bExitMeters &&
        state.bDwellStartedAt !== undefined
      ) {
        state.bDwellStartedAt = undefined
        events.push({
          type: 'cancelled-b-dwell',
          timestamp,
          distanceMeters: distanceToB,
        })
        break
      }

      if (distanceToB > thresholds.bArrivalMeters) {
        state.bDwellStartedAt = undefined
        break
      }

      state.bDwellStartedAt ??= timestamp
      if (timestamp - state.bDwellStartedAt >= thresholds.bDwellDurationMs) {
        state.status = 'AT_B'
        state.bDwellStartedAt = undefined
        events.push({
          type: 'arrived-at-b',
          timestamp,
          distanceMeters: distanceToB,
        })
      }
      break

    case 'AT_B':
    case 'PROPAGATED':
      break
  }

  return { state, events }
}
