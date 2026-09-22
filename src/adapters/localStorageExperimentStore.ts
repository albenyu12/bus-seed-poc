import type {
  ExperimentRouteMetadata,
  ExperimentMeasurements,
  ExperimentRecord,
} from '../application/experiment'

interface PersistedExperimentData {
  version: 1
  runs: unknown[]
}

const STORAGE_KEY = 'bus-seed-poc.experiment-results.v1'

export class LocalStorageExperimentStore {
  private readonly storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  load(): ExperimentRecord[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      if (!raw) return []

      const parsed: unknown = JSON.parse(raw)
      if (!this.isPersistedData(parsed)) return []
      return parsed.runs
        .map((run) => normalizeExperimentRecord(run))
        .filter((run): run is ExperimentRecord => run !== undefined)
    } catch {
      return []
    }
  }

  save(runs: ExperimentRecord[]): void {
    const data: PersistedExperimentData = { version: 1, runs }
    this.storage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY)
  }

  private isPersistedData(value: unknown): value is PersistedExperimentData {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<PersistedExperimentData>
    return candidate.version === 1 && Array.isArray(candidate.runs)
  }
}

function normalizeExperimentRecord(value: unknown): ExperimentRecord | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<ExperimentRecord>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    (candidate.mode !== 'fake' && candidate.mode !== 'real') ||
    typeof candidate.status !== 'string' ||
    !Array.isArray(candidate.expectedEvents) ||
    !Array.isArray(candidate.actualEvents) ||
    !Array.isArray(candidate.eventLog)
  ) {
    return undefined
  }

  const measurements = isExperimentMeasurements(candidate.measurements)
    ? candidate.measurements
    : legacyMeasurements(candidate)
  const route = isExperimentRouteMetadata(candidate.route)
    ? candidate.route
    : undefined

  return {
    ...candidate,
    failureReasons: Array.isArray(candidate.failureReasons)
      ? candidate.failureReasons.filter(
          (reason): reason is string => typeof reason === 'string',
      )
      : [],
    measurements,
    route,
  } as ExperimentRecord
}

function isExperimentRouteMetadata(
  value: unknown,
): value is ExperimentRouteMetadata {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ExperimentRouteMetadata>
  return (
    (candidate.stopSetId === 'ab' || candidate.stopSetId === 'cd') &&
    (candidate.direction === 'forward' || candidate.direction === 'reverse') &&
    typeof candidate.originStopId === 'string' &&
    typeof candidate.destinationStopId === 'string'
  )
}

function isExperimentMeasurements(
  value: unknown,
): value is ExperimentMeasurements {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ExperimentMeasurements>
  return (
    typeof candidate.receivedSampleCount === 'number' &&
    typeof candidate.acceptedSampleCount === 'number' &&
    typeof candidate.ignoredSampleCount === 'number' &&
    typeof candidate.duplicateSampleCount === 'number' &&
    typeof candidate.maxADwellMs === 'number' &&
    typeof candidate.maxBDwellMs === 'number' &&
    typeof candidate.finalState === 'string'
  )
}

function legacyMeasurements(
  record: Partial<ExperimentRecord>,
): ExperimentMeasurements {
  const sampleCount =
    typeof record.sampleCount === 'number' ? record.sampleCount : 0
  const finalState = record.actualState ?? record.expectedState ?? 'IDLE'
  return {
    receivedSampleCount: sampleCount,
    acceptedSampleCount: sampleCount,
    ignoredSampleCount: 0,
    duplicateSampleCount: 0,
    maxADwellMs: 0,
    maxBDwellMs: 0,
    finalState,
  } as ExperimentMeasurements
}
