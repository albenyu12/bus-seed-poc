import { calculateObservation } from '../domain/locationLogic'
import { propagateSeed } from '../domain/seedPropagation'
import {
  reduceTrip,
  resetDwellAfterLowAccuracy,
} from '../domain/stateMachine'
import {
  type DomainEvent,
  type LocationObservation,
  type LocationSample,
  type Stop,
  type StopId,
  type TripState,
  type TripThresholds,
  initialTripState,
} from '../domain/types'
import type { LocationSource } from '../ports/locationSource'

export interface TripControllerSnapshot {
  state: TripState
  observation?: LocationObservation
  eventLog: DomainEvent[]
  sampleCount: number
  measurements: TripMeasurements
  diagnostics: LocationDiagnostic[]
  error?: string
}

export interface TripMeasurements {
  timelineStartTimestamp?: number
  lastReceivedAt?: number
  receivedSampleCount: number
  acceptedSampleCount: number
  ignoredSampleCount: number
  duplicateSampleCount: number
  maxAccuracyMeters?: number
  maxADwellMs: number
  maxBDwellMs: number
}

export type LocationDiagnostic =
  | {
      timestamp: number
      reason: 'low-accuracy'
      accuracy: number
      maxAcceptedAccuracyMeters: number
    }
  | {
      timestamp: number
      reason: 'duplicate-timestamp'
    }

export interface TripControllerOptions {
  stops: Record<StopId, Stop>
  thresholds: TripThresholds
  onUpdate?: (snapshot: TripControllerSnapshot) => void
  onError?: (error: unknown) => void
}

export class TripController {
  private readonly source: LocationSource

  private readonly options: TripControllerOptions

  private state = initialTripState()

  private eventLog: DomainEvent[] = []

  private sampleCount = 0

  private measurements: TripMeasurements = {
    receivedSampleCount: 0,
    acceptedSampleCount: 0,
    ignoredSampleCount: 0,
    duplicateSampleCount: 0,
    maxADwellMs: 0,
    maxBDwellMs: 0,
  }

  private diagnostics: LocationDiagnostic[] = []

  private lastTimestamp?: number

  private lastObservation?: LocationObservation

  private lastError?: string

  private stopSource?: () => void

  constructor(source: LocationSource, options: TripControllerOptions) {
    this.source = source
    this.options = options
  }

  start(): void {
    this.stopSource?.()
    this.stopSource = this.source.start(
      (sample) => this.handleSample(sample),
      (error) => this.handleError(error),
    )
  }

  stop(): void {
    this.stopSource?.()
    this.stopSource = undefined
  }

  getSnapshot(): TripControllerSnapshot {
    return {
      state: this.state,
      observation: this.lastObservation,
      eventLog: [...this.eventLog],
      sampleCount: this.sampleCount,
      measurements: { ...this.measurements },
      diagnostics: [...this.diagnostics],
      error: this.lastError,
    }
  }

  reset(): void {
    this.state = initialTripState()
    this.eventLog = []
    this.sampleCount = 0
    this.measurements = {
      receivedSampleCount: 0,
      acceptedSampleCount: 0,
      ignoredSampleCount: 0,
      duplicateSampleCount: 0,
      maxADwellMs: 0,
      maxBDwellMs: 0,
    }
    this.diagnostics = []
    this.lastTimestamp = undefined
    this.lastObservation = undefined
    this.lastError = undefined
    this.options.onUpdate?.(this.getSnapshot())
  }

  private handleSample(sample: LocationSample): void {
    this.measurements.receivedSampleCount += 1
    this.measurements.lastReceivedAt = Date.now()
    if (
      this.measurements.timelineStartTimestamp === undefined &&
      Number.isFinite(sample.timestamp)
    ) {
      this.measurements.timelineStartTimestamp = sample.timestamp
    }
    if (Number.isFinite(sample.accuracy)) {
      this.measurements.maxAccuracyMeters = Math.max(
        this.measurements.maxAccuracyMeters ?? 0,
        sample.accuracy,
      )
    }

    if (this.lastTimestamp !== undefined) {
      if (sample.timestamp < this.lastTimestamp) {
        this.handleError(new Error('Location timestamp moved backwards'))
        return
      }

      if (sample.timestamp === this.lastTimestamp) {
        this.measurements.duplicateSampleCount += 1
        this.diagnostics.push({
          timestamp: sample.timestamp,
          reason: 'duplicate-timestamp',
        })
        this.options.onUpdate?.(this.getSnapshot())
        return
      }
    }

    const interpretation = calculateObservation(
      sample,
      this.options.stops,
      this.options.thresholds.maxAcceptedAccuracyMeters,
    )
    if (interpretation.kind === 'invalid') {
      this.handleError(new Error(`Invalid location sample: ${interpretation.reason}`))
      return
    }

    this.measurements.maxADwellMs = Math.max(
      this.measurements.maxADwellMs,
      dwellElapsed(this.state.aDwellStartedAt, sample.timestamp),
    )
    this.measurements.maxBDwellMs = Math.max(
      this.measurements.maxBDwellMs,
      dwellElapsed(this.state.bDwellStartedAt, sample.timestamp),
    )

    if (interpretation.kind === 'ignored') {
      this.state = resetDwellAfterLowAccuracy(this.state)
      this.lastObservation = interpretation.observation
      this.lastTimestamp = sample.timestamp
      this.measurements.ignoredSampleCount += 1
      this.diagnostics.push({
        timestamp: sample.timestamp,
        reason: interpretation.reason,
        accuracy: sample.accuracy,
        maxAcceptedAccuracyMeters:
          this.options.thresholds.maxAcceptedAccuracyMeters,
      })
      this.lastError = undefined
      this.options.onUpdate?.(this.getSnapshot())
      return
    }

    const transition = reduceTrip(
      this.state,
      interpretation.observation,
      this.options.thresholds,
    )
    const propagation = propagateSeed(transition.state, transition.events)
    const events = [...transition.events, ...propagation.events]

    this.state = propagation.state
    this.lastObservation = interpretation.observation
    this.lastTimestamp = sample.timestamp
    this.sampleCount += 1
    this.measurements.acceptedSampleCount += 1
    this.lastError = undefined
    this.eventLog.push(...events)
    this.options.onUpdate?.(this.getSnapshot())
  }

  private handleError(error: unknown): void {
    this.lastError = error instanceof Error ? error.message : String(error)
    this.options.onError?.(error)
    this.options.onUpdate?.(this.getSnapshot())
  }
}

function dwellElapsed(startedAt: number | undefined, timestamp: number): number {
  if (startedAt === undefined) return 0
  return Math.max(0, timestamp - startedAt)
}
