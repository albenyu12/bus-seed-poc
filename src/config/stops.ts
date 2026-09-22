import type { Stop } from '../domain/types'

export type PhysicalStopId = 'A' | 'B' | 'C' | 'D'
export type StopSetId = 'ab' | 'cd'
export type RouteDirection = 'forward' | 'reverse'

export interface PhysicalStop {
  id: PhysicalStopId
  label: string
  latitude: number
  longitude: number
}

export interface StopSet {
  id: StopSetId
  label: string
  first: PhysicalStop
  second: PhysicalStop
}

export interface ResolvedRoute {
  stopSetId: StopSetId
  direction: RouteDirection
  origin: PhysicalStop
  destination: PhysicalStop
  domainStops: Record<'A' | 'B', Stop>
}

export const STOP_SETS: readonly StopSet[] = [
  {
    id: 'ab',
    label: 'A-B 정류장 세트',
    first: {
      id: 'A',
      label: 'A',
      latitude: 37.496557766470936,
      longitude: 126.86220100201324,
    },
    second: {
      id: 'B',
      label: 'B',
      latitude: 37.499469108053304,
      longitude: 126.86708674015095,
    },
  },
  {
    id: 'cd',
    label: 'C-D 정류장 세트',
    first: {
      id: 'C',
      label: 'C',
      latitude: 37.501704142205575,
      longitude: 126.94864766489972,
    },
    second: {
      id: 'D',
      label: 'D',
      latitude: 37.49519324246389,
      longitude: 126.95711068403351,
    },
  },
]

function toDomainStop(id: 'A' | 'B', physicalStop: PhysicalStop): Stop {
  return {
    id,
    latitude: physicalStop.latitude,
    longitude: physicalStop.longitude,
  }
}

export function resolveRoute(
  stopSetId: StopSetId,
  direction: RouteDirection,
): ResolvedRoute {
  const stopSet = STOP_SETS.find((candidate) => candidate.id === stopSetId)
  if (!stopSet) {
    throw new Error(`Unknown stop set: ${stopSetId}`)
  }

  const isForward = direction === 'forward'
  const origin = isForward ? stopSet.first : stopSet.second
  const destination = isForward ? stopSet.second : stopSet.first

  return {
    stopSetId,
    direction,
    origin,
    destination,
    domainStops: {
      A: toDomainStop('A', origin),
      B: toDomainStop('B', destination),
    },
  }
}

export const STOPS: Record<'A' | 'B', Stop> =
  resolveRoute('ab', 'forward').domainStops
