import type { LocationSample } from '../domain/types'
import type { LocationSource } from '../ports/locationSource'

export class FakeLocationSource implements LocationSource {
  private onSample?: (sample: LocationSample) => void

  private onError?: (error: unknown) => void

  private playbackTimers: ReturnType<typeof setTimeout>[] = []

  start(
    onSample: (sample: LocationSample) => void,
    onError: (error: unknown) => void,
  ): () => void {
    this.onSample = onSample
    this.onError = onError

    return () => {
      this.stopPlayback()
      this.onSample = undefined
      this.onError = undefined
    }
  }

  emit(sample: LocationSample): void {
    this.onSample?.(sample)
  }

  emitError(error: unknown): void {
    this.onError?.(error)
  }

  play(
    samples: LocationSample[],
    intervalMs = 500,
    onComplete?: () => void,
  ): void {
    this.stopPlayback()

    samples.forEach((sample, index) => {
      const timer = setTimeout(() => {
        this.emit(sample)
        if (index === samples.length - 1) {
          onComplete?.()
        }
      }, index * intervalMs)

      this.playbackTimers.push(timer)
    })
  }

  stopPlayback(): void {
    this.playbackTimers.forEach((timer) => clearTimeout(timer))
    this.playbackTimers = []
  }
}
