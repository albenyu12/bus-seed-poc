import { describe, expect, it } from 'vitest'
import { FakeLocationSource } from '../src/adapters/fakeLocationSource'
import { TripController } from '../src/application/tripController'
import {
  DEFAULT_THRESHOLDS,
  type LocationSample,
  type Stop,
} from '../src/domain/types'

const METERS_PER_LATITUDE_DEGREE = 111_320
const stops: Record<'A' | 'B', Stop> = {
  A: { id: 'A', latitude: 0, longitude: 0 },
  B: {
    id: 'B',
    latitude: 1_000 / METERS_PER_LATITUDE_DEGREE,
    longitude: 0,
  },
}

function atA(timestamp: number, distance: number): LocationSample {
  return {
    timestamp,
    latitude: distance / METERS_PER_LATITUDE_DEGREE,
    longitude: 0,
    accuracy: 5,
  }
}

function atB(timestamp: number, distance: number): LocationSample {
  return {
    timestamp,
    latitude: stops.B.latitude - distance / METERS_PER_LATITUDE_DEGREE,
    longitude: 0,
    accuracy: 5,
  }
}

describe('TripController', () => {
  it('passes the requested fake location propagation scenario', () => {
    const source = new FakeLocationSource()
    const errors: unknown[] = []
    const controller = new TripController(source, {
      stops,
      thresholds: DEFAULT_THRESHOLDS,
      onError: (error) => errors.push(error),
    })

    controller.start()
    source.emit(atA(0, 20))
    source.emit(atA(20_000, 20))
    source.emit(atA(21_000, 70))
    source.emit(atB(30_000, 70))
    source.emit(atB(31_000, 20))
    source.emit(atB(46_000, 20))

    const snapshot = controller.getSnapshot()
    const eventTypes = snapshot.eventLog.map((event) => event.type)

    expect(snapshot.state.status).toBe('PROPAGATED')
    expect(snapshot.state.seed).toEqual({
      acquiredAt: 20_000,
      originStopId: 'A',
    })
    expect(snapshot.state.propagation).toMatchObject({
      originStopId: 'A',
      destinationStopId: 'B',
      propagatedAt: 46_000,
    })
    expect(eventTypes).toEqual([
      'entered-a',
      'acquired-seed',
      'left-a',
      'approaching-b',
      'arrived-at-b',
      'propagated-seed',
    ])
    expect(eventTypes.filter((type) => type === 'propagated-seed')).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })

  it('runs the same pipeline for Fake GPS as the real source contract', () => {
    const source = new FakeLocationSource()
    const updates: string[] = []
    const controller = new TripController(source, {
      stops,
      thresholds: DEFAULT_THRESHOLDS,
      onUpdate: ({ state }) => updates.push(state.status),
    })

    controller.start()
    source.emit(atA(0, 20))
    source.emit(atA(20_000, 20))
    source.emit(atA(21_000, 70))
    source.emit(atB(30_000, 80))
    source.emit(atB(31_000, 20))
    source.emit(atB(46_000, 20))

    const snapshot = controller.getSnapshot()
    expect(snapshot.state.status).toBe('PROPAGATED')
    expect(snapshot.eventLog.map((event) => event.type)).toContain(
      'arrived-at-b',
    )
    expect(snapshot.eventLog.map((event) => event.type)).toContain(
      'propagated-seed',
    )
    expect(updates.at(-1)).toBe('PROPAGATED')
  })

  it('rejects backwards timestamps without changing the state', () => {
    const source = new FakeLocationSource()
    const errors: unknown[] = []
    const controller = new TripController(source, {
      stops,
      thresholds: DEFAULT_THRESHOLDS,
      onError: (error) => errors.push(error),
    })

    controller.start()
    source.emit(atA(2_000, 20))
    source.emit(atA(1_000, 20))

    expect(controller.getSnapshot().state.status).toBe('AT_A')
    expect(errors).toHaveLength(1)
  })

  it('ignores duplicate timestamps and records the duplicate measurement', () => {
    const source = new FakeLocationSource()
    const controller = new TripController(source, {
      stops,
      thresholds: DEFAULT_THRESHOLDS,
    })

    controller.start()
    source.emit(atA(0, 20))
    source.emit(atA(0, 20))

    const snapshot = controller.getSnapshot()
    expect(snapshot.state.status).toBe('AT_A')
    expect(snapshot.sampleCount).toBe(1)
    expect(snapshot.measurements).toMatchObject({
      receivedSampleCount: 2,
      acceptedSampleCount: 1,
      duplicateSampleCount: 1,
    })
    expect(snapshot.diagnostics).toContainEqual({
      timestamp: 0,
      reason: 'duplicate-timestamp',
    })
  })

  it('can reset and reuse an active source subscription', () => {
    const source = new FakeLocationSource()
    const controller = new TripController(source, {
      stops,
      thresholds: DEFAULT_THRESHOLDS,
    })

    controller.start()
    source.emit(atA(0, 20))
    controller.reset()
    source.emit(atA(0, 20))
    source.emit(atA(20_000, 20))

    expect(controller.getSnapshot().state.status).toBe('SEED_READY')
  })

  it('clears a source error after a valid sample is received', () => {
    const source = new FakeLocationSource()
    const controller = new TripController(source, {
      stops,
      thresholds: DEFAULT_THRESHOLDS,
    })

    controller.start()
    source.emitError(new Error('temporary GPS error'))
    expect(controller.getSnapshot().error).toBe('temporary GPS error')

    source.emit(atA(0, 20))

    expect(controller.getSnapshot().error).toBeUndefined()
  })

  it('stops receiving samples after unsubscribe', () => {
    const source = new FakeLocationSource()
    const controller = new TripController(source, {
      stops,
      thresholds: DEFAULT_THRESHOLDS,
    })

    controller.start()
    controller.stop()
    source.emit(atA(0, 20))

    expect(controller.getSnapshot().state.status).toBe('IDLE')
  })
})
