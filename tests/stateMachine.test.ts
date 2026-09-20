import { describe, expect, it } from 'vitest'
import { reduceTrip } from '../src/domain/stateMachine'
import {
  DEFAULT_THRESHOLDS,
  initialTripState,
  type LocationObservation,
} from '../src/domain/types'

function observation(
  timestamp: number,
  distanceToA: number,
  distanceToB: number,
): LocationObservation {
  return {
    timestamp,
    latitude: 0,
    longitude: 0,
    accuracy: 5,
    distanceToA,
    distanceToB,
  }
}

describe('trip state machine', () => {
  it('enters A from IDLE within 40 meters', () => {
    const result = reduceTrip(
      initialTripState(),
      observation(0, 40, 1_000),
      DEFAULT_THRESHOLDS,
    )

    expect(result.state.status).toBe('AT_A')
    expect(result.events[0]).toMatchObject({ type: 'entered-a' })
  })

  it('acquires a seed after 20 seconds within A', () => {
    const entered = reduceTrip(
      initialTripState(),
      observation(0, 20, 1_000),
      DEFAULT_THRESHOLDS,
    )
    const result = reduceTrip(
      entered.state,
      observation(20_000, 20, 1_000),
      DEFAULT_THRESHOLDS,
    )

    expect(result.state.status).toBe('SEED_READY')
    expect(result.state.seed).toEqual({
      acquiredAt: 20_000,
      originStopId: 'A',
    })
  })

  it('keeps AT_A during GPS drift but resets the dwell timer outside 40 meters', () => {
    const entered = reduceTrip(
      initialTripState(),
      observation(0, 20, 1_000),
      DEFAULT_THRESHOLDS,
    )
    const drifted = reduceTrip(
      entered.state,
      observation(10_000, 50, 1_000),
      DEFAULT_THRESHOLDS,
    )

    expect(drifted.state.status).toBe('AT_A')
    expect(drifted.state.aDwellStartedAt).toBeUndefined()
  })

  it('returns to IDLE when leaving A before acquiring a seed', () => {
    const entered = reduceTrip(
      initialTripState(),
      observation(0, 20, 1_000),
      DEFAULT_THRESHOLDS,
    )
    const result = reduceTrip(
      entered.state,
      observation(1_000, 70, 1_000),
      DEFAULT_THRESHOLDS,
    )

    expect(result.state.status).toBe('IDLE')
  })

  it('moves after leaving A with a ready seed', () => {
    const entered = reduceTrip(
      initialTripState(),
      observation(0, 20, 1_000),
      DEFAULT_THRESHOLDS,
    )
    const ready = reduceTrip(
      entered.state,
      observation(20_000, 20, 1_000),
      DEFAULT_THRESHOLDS,
    )
    const result = reduceTrip(
      ready.state,
      observation(21_000, 70, 1_000),
      DEFAULT_THRESHOLDS,
    )

    expect(result.state.status).toBe('MOVING')
  })

  it('enters B approach within 80 meters', () => {
    const result = reduceTrip(
      {
        ...initialTripState(),
        status: 'MOVING',
        seed: { acquiredAt: 20_000, originStopId: 'A' },
      },
      observation(30_000, 1_000, 80),
      DEFAULT_THRESHOLDS,
    )

    expect(result.state.status).toBe('APPROACHING_B')
  })

  it('reaches AT_B after 15 seconds within B', () => {
    const approaching = reduceTrip(
      {
        ...initialTripState(),
        status: 'MOVING',
        seed: { acquiredAt: 20_000, originStopId: 'A' },
      },
      observation(30_000, 1_000, 80),
      DEFAULT_THRESHOLDS,
    )
    const insideB = reduceTrip(
      approaching.state,
      observation(31_000, 1_000, 20),
      DEFAULT_THRESHOLDS,
    )
    const result = reduceTrip(
      insideB.state,
      observation(46_000, 1_000, 20),
      DEFAULT_THRESHOLDS,
    )

    expect(result.state.status).toBe('AT_B')
    expect(result.events).toEqual([
      {
        type: 'arrived-at-b',
        timestamp: 46_000,
        distanceMeters: 20,
      },
    ])
  })

  it('does not arrive when B dwell is interrupted', () => {
    const approaching = reduceTrip(
      {
        ...initialTripState(),
        status: 'MOVING',
        seed: { acquiredAt: 20_000, originStopId: 'A' },
      },
      observation(30_000, 1_000, 80),
      DEFAULT_THRESHOLDS,
    )
    const insideB = reduceTrip(
      approaching.state,
      observation(31_000, 1_000, 20),
      DEFAULT_THRESHOLDS,
    )
    const result = reduceTrip(
      insideB.state,
      observation(40_000, 1_000, 70),
      DEFAULT_THRESHOLDS,
    )

    expect(result.state.status).toBe('APPROACHING_B')
    expect(result.state.bDwellStartedAt).toBeUndefined()
    expect(result.events[0]).toMatchObject({ type: 'cancelled-b-dwell' })
  })

  it('returns to MOVING after leaving the B approach radius', () => {
    const approaching = reduceTrip(
      {
        ...initialTripState(),
        status: 'MOVING',
        seed: { acquiredAt: 20_000, originStopId: 'A' },
      },
      observation(30_000, 1_000, 80),
      DEFAULT_THRESHOLDS,
    )
    const result = reduceTrip(
      approaching.state,
      observation(31_000, 1_000, 81),
      DEFAULT_THRESHOLDS,
    )

    expect(result.state.status).toBe('MOVING')
  })

  it('does not change an already propagated state', () => {
    const state = {
      ...initialTripState(),
      status: 'PROPAGATED' as const,
      propagation: {
        id: 'A-B-46',
        originStopId: 'A' as const,
        destinationStopId: 'B' as const,
        propagatedAt: 46_000,
      },
    }
    const result = reduceTrip(
      state,
      observation(47_000, 1_000, 20),
      DEFAULT_THRESHOLDS,
    )

    expect(result.state).toEqual(state)
    expect(result.events).toHaveLength(0)
  })
})
