import type { DomainEvent, TripStatus } from '../domain/types'
import type { FakeScenario } from '../config/fakeScenarios'
import type {
  TripControllerSnapshot,
  TripMeasurements,
} from './tripController'

export type ExperimentStatus =
  | 'NOT_RUN'
  | 'RUNNING'
  | 'PASS'
  | 'FAIL'
  | 'ERROR'

export interface ExperimentMeasurements extends TripMeasurements {
  finalState: TripStatus
  finalDistanceToA?: number
  finalDistanceToB?: number
}

export interface ExperimentRecord {
  id: string
  title: string
  mode: 'fake' | 'real'
  status: ExperimentStatus
  startedAt?: number
  completedAt?: number
  expectedState: TripStatus
  actualState?: TripStatus
  expectedEvents: string[]
  actualEvents: string[]
  sampleCount: number
  eventLog: DomainEvent[]
  failureReasons: string[]
  measurements: ExperimentMeasurements
  error?: string
  note?: string
}

export const NORMAL_FAKE_EXPERIMENT_ID = 'normal-fake-propagation'

export const NORMAL_FAKE_EXPECTED_EVENTS = [
  'entered-a',
  'acquired-seed',
  'left-a',
  'approaching-b',
  'arrived-at-b',
  'propagated-seed',
] as const

export function evaluateFakeScenario(
  scenario: FakeScenario,
  snapshot: TripControllerSnapshot,
  startedAt: number,
  completedAt: number,
): ExperimentRecord {
  const actualEvents = snapshot.eventLog.map((event) => event.type)
  const expectedEvents = [...scenario.expectedEvents]
  const hasExpectedState = snapshot.state.status === scenario.expectedState
  const hasExpectedEvents =
    actualEvents.length === expectedEvents.length &&
    actualEvents.every((event, index) => event === expectedEvents[index])
  const isPassed = !snapshot.error && hasExpectedState && hasExpectedEvents
  const failureReasons = scenario.failureReason
    ? [scenario.failureReason]
    : []

  if (!isPassed && !snapshot.error) {
    failureReasons.push('기대 상태 또는 이벤트와 실제 결과가 일치하지 않음')
  }

  return {
    id: scenario.id + '-' + startedAt,
    title: scenario.title,
    mode: 'fake',
    status: snapshot.error ? 'ERROR' : isPassed ? 'PASS' : 'FAIL',
    startedAt,
    completedAt,
    expectedState: scenario.expectedState,
    actualState: snapshot.state.status,
    expectedEvents,
    actualEvents,
    sampleCount: snapshot.sampleCount,
    eventLog: snapshot.eventLog,
    failureReasons,
    measurements: {
      ...snapshot.measurements,
      finalState: snapshot.state.status,
      finalDistanceToA: snapshot.observation?.distanceToA,
      finalDistanceToB: snapshot.observation?.distanceToB,
    },
    error: snapshot.error,
    note: scenario.description,
  }
}

export function evaluateNormalFakeRun(
  snapshot: TripControllerSnapshot,
  startedAt: number,
  completedAt: number,
): ExperimentRecord {
  const scenario: FakeScenario = {
    id: NORMAL_FAKE_EXPERIMENT_ID,
    title: '정상 Fake GPS 전파 플로우',
    description: 'A20m → 20초 → A70m → B70m → B20m → 15초',
    samples: [],
    expectedState: 'PROPAGATED',
    expectedEvents: NORMAL_FAKE_EXPECTED_EVENTS,
  }
  return evaluateFakeScenario(scenario, snapshot, startedAt, completedAt)
}

export function evaluateBrowserRun(
  snapshot: TripControllerSnapshot,
  startedAt: number,
  completedAt: number,
  wasStale: boolean,
): ExperimentRecord {
  const actualEvents = snapshot.eventLog.map((event) => event.type)
  const expectedEvents = [...NORMAL_FAKE_EXPECTED_EVENTS]
  const reachedPropagation = snapshot.state.status === 'PROPAGATED'
  const hasExpectedEvents =
    actualEvents.length === expectedEvents.length &&
    actualEvents.every((event, index) => event === expectedEvents[index])
  const isPassed =
    !snapshot.error && !wasStale && reachedPropagation && hasExpectedEvents
  const failureReasons: string[] = []

  if (snapshot.error) failureReasons.push(snapshot.error)
  if (wasStale) failureReasons.push('GPS callback이 30초 이상 수신되지 않음')
  if (!isPassed && !snapshot.error && !wasStale) {
    failureReasons.push('씨앗 전파 전에 실제 GPS 세션이 종료됨')
  }

  return {
    id: 'browser-gps-' + startedAt,
    title: '실제 Browser GPS 수동 실험',
    mode: 'real',
    status: snapshot.error ? 'ERROR' : isPassed ? 'PASS' : 'FAIL',
    startedAt,
    completedAt,
    expectedState: 'PROPAGATED',
    actualState: snapshot.state.status,
    expectedEvents,
    actualEvents,
    sampleCount: snapshot.sampleCount,
    eventLog: snapshot.eventLog,
    failureReasons,
    measurements: {
      ...snapshot.measurements,
      finalState: snapshot.state.status,
      finalDistanceToA: snapshot.observation?.distanceToA,
      finalDistanceToB: snapshot.observation?.distanceToB,
    },
    error: snapshot.error,
    note: 'GPS 정지 시 자동 저장된 실제 위치 실험 결과',
  }
}
