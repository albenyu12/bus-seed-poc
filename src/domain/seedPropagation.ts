import type {
  DomainEvent,
  SeedPropagation,
  TripState,
  TripTransition,
} from './types'

function getArrivalEvent(events: DomainEvent[]) {
  return events.find(
    (event): event is Extract<DomainEvent, { type: 'arrived-at-b' }> =>
      event.type === 'arrived-at-b',
  )
}

export function propagateSeed(
  state: TripState,
  events: DomainEvent[],
): TripTransition {
  if (state.status !== 'AT_B' || state.propagation || !state.seed) {
    return { state, events: [] }
  }

  const arrival = getArrivalEvent(events)
  if (!arrival) {
    return { state, events: [] }
  }

  const propagation: SeedPropagation = {
    id: `A-B-${arrival.timestamp}`,
    originStopId: state.seed.originStopId,
    destinationStopId: 'B',
    propagatedAt: arrival.timestamp,
  }

  return {
    state: {
      ...state,
      status: 'PROPAGATED',
      propagation,
    },
    events: [
      {
        type: 'propagated-seed',
        timestamp: arrival.timestamp,
        propagation,
      },
    ],
  }
}
