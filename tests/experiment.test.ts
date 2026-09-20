import { describe, expect, it } from 'vitest'
import { FakeLocationSource } from '../src/adapters/fakeLocationSource'
import {
  evaluateBrowserRun,
  evaluateFakeScenario,
} from '../src/application/experiment'
import { formatRelativeTime } from '../src/application/eventLog'
import { TripController } from '../src/application/tripController'
import { createFakeScenarioCatalog } from '../src/config/fakeScenarios'
import { STOPS } from '../src/config/stops'
import { DEFAULT_THRESHOLDS } from '../src/domain/types'

describe('experiment scenarios', () => {
  it('formats event timestamps as relative time', () => {
    expect(formatRelativeTime(0, 0)).toBe('+0.0s')
    expect(formatRelativeTime(20_000, 0)).toBe('+20.0s')
    expect(formatRelativeTime(19_900, 0)).toBe('+19.9s')
  })

  it('passes every fake scenario according to its expected outcome', () => {
    for (const scenario of createFakeScenarioCatalog(STOPS)) {
      const source = new FakeLocationSource()
      const controller = new TripController(source, {
        stops: STOPS,
        thresholds: DEFAULT_THRESHOLDS,
      })

      controller.start()
      scenario.samples.forEach((sample) => source.emit(sample))

      const record = evaluateFakeScenario(
        scenario,
        controller.getSnapshot(),
        1,
        2,
      )

      expect(record.status, scenario.id).toBe('PASS')
      expect(record.actualState, scenario.id).toBe(scenario.expectedState)
      expect(record.actualEvents, scenario.id).toEqual([
        ...scenario.expectedEvents,
      ])
      expect(record.measurements.receivedSampleCount, scenario.id).toBe(
        scenario.samples.length,
      )
    }
  })

  it('records low accuracy as ignored and resets the A dwell timer', () => {
    const scenario = createFakeScenarioCatalog(STOPS).find(
      (item) => item.id === 'a-low-accuracy',
    )
    expect(scenario).toBeDefined()
    if (!scenario) return

    const source = new FakeLocationSource()
    const controller = new TripController(source, {
      stops: STOPS,
      thresholds: DEFAULT_THRESHOLDS,
    })
    controller.start()
    scenario.samples.forEach((sample) => source.emit(sample))

    const snapshot = controller.getSnapshot()
    expect(snapshot.state.status).toBe('AT_A')
    expect(snapshot.state.aDwellStartedAt).toBeUndefined()
    expect(snapshot.measurements).toMatchObject({
      receivedSampleCount: 2,
      acceptedSampleCount: 1,
      ignoredSampleCount: 1,
      maxAccuracyMeters: 100,
      maxADwellMs: 20_000,
    })
    expect(snapshot.diagnostics).toEqual([
      {
        timestamp: 20_000,
        reason: 'low-accuracy',
        accuracy: 100,
        maxAcceptedAccuracyMeters: 50,
      },
    ])
  })

  it('fails a Browser GPS result when stale occurred before propagation', () => {
    const scenario = createFakeScenarioCatalog(STOPS)[0]
    const source = new FakeLocationSource()
    const controller = new TripController(source, {
      stops: STOPS,
      thresholds: DEFAULT_THRESHOLDS,
    })
    controller.start()
    scenario.samples.forEach((sample) => source.emit(sample))

    const record = evaluateBrowserRun(
      controller.getSnapshot(),
      1,
      2,
      true,
    )

    expect(record.actualState).toBe('PROPAGATED')
    expect(record.status).toBe('FAIL')
    expect(record.failureReasons).toContain(
      'GPS callback이 30초 이상 수신되지 않음',
    )
  })
})
