import { describe, expect, it } from 'vitest'
import { propagateSeed } from '../src/domain/seedPropagation'
import { initialTripState } from '../src/domain/types'

describe('seed propagation', () => {
  it('propagates a seed after AT_B is reached', () => {
    const result = propagateSeed(
      {
        ...initialTripState(),
        status: 'AT_B',
        seed: { acquiredAt: 20_000, originStopId: 'A' },
      },
      [
        {
          type: 'arrived-at-b',
          timestamp: 46_000,
          distanceMeters: 20,
        },
      ],
    )

    expect(result.state.status).toBe('PROPAGATED')
    expect(result.state.propagation).toEqual({
      id: 'A-B-46000',
      originStopId: 'A',
      destinationStopId: 'B',
      propagatedAt: 46_000,
    })
    expect(result.events[0]).toMatchObject({ type: 'propagated-seed' })
  })

  it('does not propagate without an arrival event or seed', () => {
    const noArrival = propagateSeed(
      { ...initialTripState(), status: 'AT_B' },
      [],
    )
    const noSeed = propagateSeed(
      { ...initialTripState(), status: 'AT_B' },
      [{ type: 'arrived-at-b', timestamp: 46_000, distanceMeters: 20 }],
    )

    expect(noArrival.state.status).toBe('AT_B')
    expect(noArrival.events).toHaveLength(0)
    expect(noSeed.state.status).toBe('AT_B')
    expect(noSeed.events).toHaveLength(0)
  })

  it('does not create a duplicate propagation', () => {
    const state = {
      ...initialTripState(),
      status: 'PROPAGATED' as const,
      propagation: {
        id: 'A-B-46000',
        originStopId: 'A' as const,
        destinationStopId: 'B' as const,
        propagatedAt: 46_000,
      },
    }
    const result = propagateSeed(
      state,
      [{ type: 'arrived-at-b', timestamp: 46_000, distanceMeters: 20 }],
    )

    expect(result.state).toEqual(state)
    expect(result.events).toHaveLength(0)
  })
})
