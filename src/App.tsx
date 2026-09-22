import { useEffect, useMemo, useState } from 'react'
import { BrowserLocationSource } from './adapters/browserLocationSource'
import { FakeLocationSource } from './adapters/fakeLocationSource'
import { LocalStorageExperimentStore } from './adapters/localStorageExperimentStore'
import {
  evaluateFakeScenario,
  evaluateBrowserRun,
  type ExperimentRecord,
  type ExperimentStatus,
} from './application/experiment'
import { formatRelativeTime } from './application/eventLog'
import { isGpsStale } from './application/locationHealth'
import {
  type TripControllerSnapshot,
  TripController,
} from './application/tripController'
import {
  createFakeScenarioCatalog,
} from './config/fakeScenarios'
import {
  resolveRoute,
  STOP_SETS,
  type RouteDirection,
  type StopSetId,
} from './config/stops'
import {
  DEFAULT_THRESHOLDS,
  initialTripState,
  type DomainEvent,
} from './domain/types'
import {
  isLocationSourceError,
  type LocationSource,
} from './ports/locationSource'
import './App.css'

function currentWallClock(): number {
  return Date.now()
}

type SourceMode = 'fake' | 'browser'
type LocationHealth =
  | 'idle'
  | 'starting'
  | 'active'
  | 'stale'
  | 'permission-denied'
  | 'unsupported'
  | 'error'

const locationHealthLabels: Record<LocationHealth, string> = {
  idle: '대기 중',
  starting: 'GPS 시작 중',
  active: '위치 수신 중',
  stale: 'callback 대기 초과',
  'permission-denied': '위치 권한 거부',
  unsupported: 'Geolocation 미지원',
  error: 'GPS 오류',
}

const initialSnapshot: TripControllerSnapshot = {
  state: initialTripState(),
  eventLog: [],
  sampleCount: 0,
  measurements: {
    receivedSampleCount: 0,
    acceptedSampleCount: 0,
    ignoredSampleCount: 0,
    duplicateSampleCount: 0,
    maxADwellMs: 0,
    maxBDwellMs: 0,
  },
  diagnostics: [],
}

function eventLabel(
  eventType: DomainEvent['type'],
  originLabel: string,
  destinationLabel: string,
): string {
  switch (eventType) {
    case 'entered-a':
      return originLabel + ' 정류장 진입'
    case 'acquired-seed':
      return '씨앗 획득'
    case 'left-a':
      return originLabel + ' 정류장 이탈'
    case 'approaching-b':
      return destinationLabel + ' 정류장 접근'
    case 'arrived-at-b':
      return destinationLabel + ' 도착 인정'
    case 'cancelled-b-dwell':
      return destinationLabel + ' 체류 취소'
    case 'propagated-seed':
      return '씨앗 전파'
  }
}

function formatDistance(distance: number | undefined): string {
  return distance === undefined ? '-' : String(Math.round(distance)) + 'm'
}

function formatDwell(
  startedAt: number | undefined,
  currentTimestamp: number | undefined,
  durationMs: number,
  completed: boolean,
): string {
  const durationSeconds = durationMs / 1_000
  if (completed) return durationSeconds + ' / ' + durationSeconds + ' sec'
  if (startedAt === undefined || currentTimestamp === undefined) {
    return '0 / ' + durationSeconds + ' sec'
  }

  const elapsedMs = Math.max(0, currentTimestamp - startedAt)
  return (
    Math.min(elapsedMs, durationMs) / 1_000 +
    ' / ' +
    durationSeconds +
    ' sec'
  )
}

function formatEvent(
  event: DomainEvent,
  timelineStartTimestamp: number,
  originLabel: string,
  destinationLabel: string,
): string {
  const distance =
    'distanceMeters' in event
      ? ' · ' + Math.round(event.distanceMeters) + 'm'
      : ''
  return (
    formatRelativeTime(event.timestamp, timelineStartTimestamp) +
    ' · ' +
    eventLabel(event.type, originLabel, destinationLabel) +
    distance
  )
}

function recordMatchesRoute(
  record: ExperimentRecord,
  route: ReturnType<typeof resolveRoute>,
): boolean {
  if (!record.route) {
    return route.stopSetId === 'ab' && route.direction === 'forward'
  }

  return (
    record.route.stopSetId === route.stopSetId &&
    record.route.direction === route.direction
  )
}

function App() {
  const [sourceMode, setSourceMode] = useState<SourceMode>('fake')
  const [selectedStopSetId, setSelectedStopSetId] = useState<StopSetId>('ab')
  const [direction, setDirection] = useState<RouteDirection>('forward')
  const [locationHealth, setLocationHealth] = useState<LocationHealth>('idle')
  const [sourceError, setSourceError] = useState<string>()
  const [browserRunning, setBrowserRunning] = useState(false)
  const [browserSessionStartedAt, setBrowserSessionStartedAt] = useState<
    number | undefined
  >()
  const [browserRunStartedAt, setBrowserRunStartedAt] = useState<
    number | undefined
  >()
  const [wasStale, setWasStale] = useState(false)
  const route = useMemo(
    () => resolveRoute(selectedStopSetId, direction),
    [direction, selectedStopSetId],
  )
  const scenarios = useMemo(
    () =>
      createFakeScenarioCatalog(route.domainStops, {
        origin: route.origin.label,
        destination: route.destination.label,
      }),
    [route],
  )
  const source = useMemo<LocationSource>(
    () =>
      sourceMode === 'fake'
        ? new FakeLocationSource()
        : new BrowserLocationSource(),
    [sourceMode],
  )
  const [store] = useState<LocalStorageExperimentStore | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    return new LocalStorageExperimentStore(window.localStorage)
  })
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    scenarios[0].id,
  )
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [runStatus, setRunStatus] = useState<ExperimentStatus>('NOT_RUN')
  const [records, setRecords] = useState<ExperimentRecord[]>(() => {
    return store?.load() ?? []
  })
  const controller = useMemo(
    () =>
      new TripController(source, {
        stops: route.domainStops,
        thresholds: DEFAULT_THRESHOLDS,
        onUpdate: (nextSnapshot) => {
          setSnapshot(nextSnapshot)
          if (
            sourceMode === 'browser' &&
            nextSnapshot.measurements.receivedSampleCount > 0 &&
            nextSnapshot.error === undefined
          ) {
            setLocationHealth('active')
            setSourceError(undefined)
          }
        },
        onError: (error) => {
          setSourceError(error instanceof Error ? error.message : String(error))
          if (isLocationSourceError(error)) {
            setLocationHealth(error.code === 'permission-denied' ? 'permission-denied' : error.code === 'unsupported' ? 'unsupported' : 'error')
          } else {
            setLocationHealth('error')
          }
        },
      }),
    [route, source, sourceMode],
  )
  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ??
    scenarios[0]

  useEffect(() => {
    if (sourceMode === 'fake') controller.start()

    return () => {
      if (source instanceof FakeLocationSource) source.stopPlayback()
      controller.stop()
    }
  }, [controller, source, sourceMode])

  useEffect(() => {
    if (
      sourceMode !== 'browser' ||
      !browserRunning ||
      browserSessionStartedAt === undefined ||
      ['permission-denied', 'unsupported', 'error'].includes(locationHealth)
    ) {
      return
    }

    const checkStale = (): void => {
      const lastReceivedAt =
        snapshot.measurements.lastReceivedAt ?? browserSessionStartedAt
      if (
        isGpsStale(
          currentWallClock(),
          lastReceivedAt,
          browserSessionStartedAt,
        )
      ) {
        setLocationHealth('stale')
        setWasStale(true)
      }
    }

    const timer = window.setInterval(checkStale, 1_000)
    checkStale()
    return () => window.clearInterval(timer)
  }, [
    browserRunning,
    browserSessionStartedAt,
    locationHealth,
    snapshot.measurements.lastReceivedAt,
    sourceMode,
  ])

  const observation = snapshot.observation
  const currentTimestamp = observation?.timestamp
  const hasSeed = snapshot.state.seed !== undefined
  const hasPropagated = snapshot.state.propagation !== undefined
  const latestBrowserRecord = records.find(
    (record) => record.mode === 'real' && recordMatchesRoute(record, route),
  )

  function saveRecord(record: ExperimentRecord): void {
    setRecords((previous) => {
      const next = [record, ...previous]
      store?.save(next)
      return next
    })
  }

  function runFakeScenario(): void {
    if (!(source instanceof FakeLocationSource)) return
    controller.reset()
    setRunStatus('RUNNING')
    const startedAt = currentWallClock()

    source.play(selectedScenario.samples, 500, () => {
      const record = evaluateFakeScenario(
        selectedScenario,
        controller.getSnapshot(),
        startedAt,
        currentWallClock(),
        route,
      )
      saveRecord(record)
      setRunStatus(record.status)
    })
  }

  function startBrowserGps(): void {
    if (!(source instanceof BrowserLocationSource) || browserRunning) return
    controller.reset()
    const startedAt = currentWallClock()
    setBrowserRunning(true)
    setBrowserSessionStartedAt(startedAt)
    setBrowserRunStartedAt(startedAt)
    setWasStale(false)
    setSourceError(undefined)
    setLocationHealth('starting')
    setRunStatus('RUNNING')
    controller.start()
  }

  function stopBrowserGps(): void {
    if (!(source instanceof BrowserLocationSource) || !browserRunning) return
    controller.stop()
    const startedAt = browserRunStartedAt ?? currentWallClock()
    const record = evaluateBrowserRun(
      controller.getSnapshot(),
      startedAt,
      currentWallClock(),
      wasStale,
      route,
    )
    saveRecord(record)
    setBrowserRunning(false)
    setBrowserSessionStartedAt(undefined)
    setBrowserRunStartedAt(undefined)
    setLocationHealth(record.status === 'ERROR' ? locationHealth : 'idle')
    setRunStatus(record.status)
  }

  function reset(): void {
    if (source instanceof FakeLocationSource) {
      source.stopPlayback()
    } else {
      controller.stop()
    }
    controller.reset()
    setBrowserRunning(false)
    setBrowserSessionStartedAt(undefined)
    setBrowserRunStartedAt(undefined)
    setWasStale(false)
    setSourceError(undefined)
    setLocationHealth('idle')
    setRunStatus('NOT_RUN')
  }

  function changeRoute(
    nextStopSetId: StopSetId,
    nextDirection: RouteDirection,
  ): void {
    if (browserRunning || runStatus === 'RUNNING') return

    if (source instanceof FakeLocationSource) source.stopPlayback()
    controller.stop()
    controller.reset()
    setSnapshot(initialSnapshot)
    setRunStatus('NOT_RUN')
    setSourceError(undefined)
    setBrowserSessionStartedAt(undefined)
    setBrowserRunStartedAt(undefined)
    setWasStale(false)
    setLocationHealth('idle')
    setSelectedStopSetId(nextStopSetId)
    setDirection(nextDirection)
  }

  function changeSourceMode(nextMode: SourceMode): void {
    if (
      nextMode === sourceMode ||
      browserRunning ||
      runStatus === 'RUNNING'
    ) {
      return
    }
    if (source instanceof FakeLocationSource) source.stopPlayback()
    controller.stop()
    controller.reset()
    setSnapshot(initialSnapshot)
    setRunStatus('NOT_RUN')
    setSourceError(undefined)
    setBrowserSessionStartedAt(undefined)
    setBrowserRunStartedAt(undefined)
    setWasStale(false)
    setLocationHealth('idle')
    setSourceMode(nextMode)
  }

  function stop(): void {
    if (sourceMode === 'browser') {
      stopBrowserGps()
      return
    }
    if (source instanceof FakeLocationSource) source.stopPlayback()
    setRunStatus('NOT_RUN')
  }

  function clearResults(): void {
    store?.clear()
    setRecords([])
  }

  function formatMeasurement(value: number | undefined, suffix = 'm'): string {
    return value === undefined ? '-' : Math.round(value) + suffix
  }

  function exportResults(): void {
    const blob = new Blob([JSON.stringify(records, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'bus-seed-poc-experiment-results.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="debug-app">
      <header className="page-header">
        <div>
          <p className="eyebrow">BUS SEED PROPAGATION POC</p>
          <h1>GPS 상태 전이 디버거</h1>
          <p className="subtitle">
            {route.origin.label} 체류부터 {route.destination.label} 도착과 씨앗 전파까지 검증합니다.
          </p>
        </div>
        <div className="mode-badge">
          <span className="status-dot" />
          {sourceMode === 'fake' ? 'Fake GPS 활성' : 'Browser GPS'}
          <small>
            {sourceMode === 'fake'
              ? '시나리오 모드'
              : locationHealthLabels[locationHealth]}
          </small>
        </div>
      </header>

      <section className="control-panel panel">
        <div>
          <p className="section-label">실험 제어</p>
          <div className="controls route-controls">
            <label>
              <strong>정류장 세트</strong>
              <select
                value={selectedStopSetId}
                onChange={(event) =>
                  changeRoute(event.target.value as StopSetId, 'forward')
                }
                disabled={browserRunning || runStatus === 'RUNNING'}
              >
                {STOP_SETS.map((stopSet) => (
                  <option key={stopSet.id} value={stopSet.id}>
                    {stopSet.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <strong>이동 방향</strong>
              <select
                value={direction}
                onChange={(event) =>
                  changeRoute(selectedStopSetId, event.target.value as RouteDirection)
                }
                disabled={browserRunning || runStatus === 'RUNNING'}
              >
                <option value="forward">
                  {route.origin.label} → {route.destination.label}
                </option>
                <option value="reverse">
                  {route.destination.label} → {route.origin.label}
                </option>
              </select>
            </label>
          </div>
          <p className="muted">
            현재 경로: {route.origin.label} → {route.destination.label}
          </p>
          <div className="controls">
            <button
              type="button"
              className={sourceMode === 'fake' ? 'primary' : ''}
              onClick={() => changeSourceMode('fake')}
              disabled={browserRunning || runStatus === 'RUNNING'}
            >
              Fake GPS
            </button>
            <button
              type="button"
              className={sourceMode === 'browser' ? 'primary' : ''}
              onClick={() => changeSourceMode('browser')}
              disabled={browserRunning || runStatus === 'RUNNING'}
            >
              Browser GPS
            </button>
          </div>
          {sourceMode === 'fake' ? (
            <>
              <label>
                <strong>Fake GPS 시나리오</strong>
                <select
                  value={selectedScenario.id}
                  onChange={(event) => setSelectedScenarioId(event.target.value)}
                  disabled={runStatus === 'RUNNING'}
                >
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">{selectedScenario.description}</p>
            </>
          ) : (
            <>
              <strong>실제 위치 수동 실험</strong>
              <p className="muted">
                HTTPS 또는 localhost에서 위치 권한을 허용한 뒤 GPS를 시작하세요.
              </p>
              {sourceError && <p className="error-message">{sourceError}</p>}
            </>
          )}
        </div>
        <div className="controls">
          {sourceMode === 'fake' ? (
            <>
              <button
                type="button"
                className="primary"
                onClick={runFakeScenario}
                disabled={runStatus === 'RUNNING'}
              >
                시나리오 실행
              </button>
              <button
                type="button"
                onClick={stop}
                disabled={runStatus !== 'RUNNING'}
              >
                정지
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary"
              onClick={browserRunning ? stopBrowserGps : startBrowserGps}
            >
              {browserRunning ? 'GPS 정지 및 저장' : 'GPS 시작'}
            </button>
          )}
          <button type="button" onClick={reset}>초기화</button>
        </div>
        <span className={'run-status status-' + runStatus.toLowerCase()}>
          {runStatus}
        </span>
      </section>

      <section className="metric-grid">
        <article className="panel state-card">
          <p className="section-label">CURRENT STATE</p>
          <strong className="state-value">{snapshot.state.status}</strong>
          <p className="muted">
            수신 {snapshot.measurements.receivedSampleCount}개 · 처리{' '}
            {snapshot.sampleCount}개 · 무시 {snapshot.measurements.ignoredSampleCount}개 · 중복{' '}
            {snapshot.measurements.duplicateSampleCount}개
          </p>
        </article>
        <article className="panel metric-card">
          <p className="section-label">DISTANCE</p>
          <div className="metric-row"><span>{route.origin.label} 정류장</span><strong>{formatDistance(observation?.distanceToA)}</strong></div>
          <div className="metric-row"><span>{route.destination.label} 정류장</span><strong>{formatDistance(observation?.distanceToB)}</strong></div>
        </article>
        <article className="panel metric-card">
          <p className="section-label">DWELL</p>
          <div className="metric-row"><span>{route.origin.label} 체류</span><strong>{formatDwell(snapshot.state.aDwellStartedAt, currentTimestamp, DEFAULT_THRESHOLDS.aDwellDurationMs, snapshot.state.seed !== undefined)}</strong></div>
          <div className="metric-row"><span>{route.destination.label} 체류</span><strong>{formatDwell(snapshot.state.bDwellStartedAt, currentTimestamp, DEFAULT_THRESHOLDS.bDwellDurationMs, hasPropagated || snapshot.state.status === 'AT_B')}</strong></div>
        </article>
        <article className="panel metric-card">
          <p className="section-label">SEED</p>
          <div className="metric-row"><span>보유</span><strong>{hasSeed ? '있음' : '없음'}</strong></div>
          <div className="metric-row"><span>전파</span><strong>{hasPropagated ? '완료' : '-'}</strong></div>
        </article>
      </section>

      <section className="two-column">
        <article className="panel">
          <div className="panel-heading">
            <div><p className="section-label">LOCATION</p><h2>현재 위치</h2></div>
            <span className="accuracy">± {observation?.accuracy ?? '-'}m</span>
          </div>
          <dl className="location-list">
            <div><dt>위도</dt><dd>{observation?.latitude ?? '-'}</dd></div>
            <div><dt>경도</dt><dd>{observation?.longitude ?? '-'}</dd></div>
            <div><dt>Accuracy</dt><dd>{observation ? observation.accuracy + 'm' : '-'}</dd></div>
          </dl>
        </article>

        <article className="panel event-panel">
          <div className="panel-heading">
            <div><p className="section-label">EVENT LOG</p><h2>상태 이벤트</h2></div>
            <span className="event-count">{snapshot.eventLog.length}</span>
          </div>
          {snapshot.eventLog.length === 0 ? (
            <p className="empty-state">아직 기록된 이벤트가 없습니다.</p>
          ) : (
            <ol className="event-list">
              {snapshot.eventLog.map((event, index) => (
                <li key={event.type + '-' + event.timestamp + '-' + index}>
                  <span className="event-index">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    {formatEvent(
                      event,
                      snapshot.measurements.timelineStartTimestamp ??
                        event.timestamp,
                      route.origin.label,
                      route.destination.label,
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {snapshot.error && <p className="error-message">{snapshot.error}</p>}
        </article>
      </section>

      <section className="panel results-panel">
        <div className="panel-heading">
          <div><p className="section-label">EXPERIMENT RESULTS</p><h2>검증 결과</h2></div>
          <div className="controls"><button type="button" onClick={exportResults} disabled={records.length === 0}>JSON 내보내기</button><button type="button" onClick={clearResults} disabled={records.length === 0}>결과 삭제</button></div>
        </div>
          <div className="result-table-wrap">
          <table>
            <thead><tr><th>검증 항목</th><th>방법</th><th>성공 기준</th><th>실제 결과·증거</th></tr></thead>
            <tbody>
              {scenarios.map((scenario) => {
                const record = records.find((item) =>
                  item.id.startsWith(scenario.id + '-') &&
                  recordMatchesRoute(item, route),
                )
                return (
                  <tr key={scenario.id}>
                    <td>{scenario.title}</td>
                    <td>{scenario.description}</td>
                    <td>{scenario.expectedState}</td>
                    <td>
                      <span
                        className={
                          'result-pill status-' +
                          (record?.status ?? 'NOT_RUN').toLowerCase()
                        }
                      >
                        {record?.status ?? 'NOT_RUN'}
                      </span>
                      {record && (
                        <small>
                          {(record.failureReasons ?? []).join(' · ') ||
                            record.actualEvents.join(' → ')}
                          <br />
                          수신 {record.measurements?.receivedSampleCount ?? record.sampleCount}개 · 정확도 최대{' '}
                          {formatMeasurement(record.measurements?.maxAccuracyMeters)}
                        </small>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td>실제 Browser GPS</td>
                <td>
                  {route.origin.label} 접근 → 체류 → {route.destination.label} 도착 → 전파
                </td>
                <td>PROPAGATED</td>
                <td>
                  <span
                    className={
                      'result-pill status-' +
                      (latestBrowserRecord?.status ?? 'NOT_RUN').toLowerCase()
                    }
                  >
                    {latestBrowserRecord?.status ?? 'NOT_RUN'}
                  </span>
                  {latestBrowserRecord && (
                    <small>
                      {latestBrowserRecord.failureReasons.join(' · ') ||
                        latestBrowserRecord.actualEvents.join(' → ')}
                      <br />
                      수신 {latestBrowserRecord.measurements.receivedSampleCount}개 · 정확도 최대{' '}
                      {formatMeasurement(
                        latestBrowserRecord.measurements.maxAccuracyMeters,
                      )}
                    </small>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default App
