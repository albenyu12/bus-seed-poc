import { describe, expect, it } from 'vitest'
import { resolveRoute } from '../src/config/stops'

describe('stop routes', () => {
  it.each([
    ['ab', 'forward', 'A', 'B'],
    ['ab', 'reverse', 'B', 'A'],
    ['cd', 'forward', 'C', 'D'],
    ['cd', 'reverse', 'D', 'C'],
  ] as const)('%s %s maps physical stops to domain A and B', (
    stopSetId,
    direction,
    originId,
    destinationId,
  ) => {
    const route = resolveRoute(stopSetId, direction)

    expect(route.origin.id).toBe(originId)
    expect(route.destination.id).toBe(destinationId)
    expect(route.domainStops.A.latitude).toBe(route.origin.latitude)
    expect(route.domainStops.A.longitude).toBe(route.origin.longitude)
    expect(route.domainStops.B.latitude).toBe(route.destination.latitude)
    expect(route.domainStops.B.longitude).toBe(route.destination.longitude)
  })
})
