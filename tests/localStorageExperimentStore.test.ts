import { describe, expect, it } from 'vitest'
import { LocalStorageExperimentStore } from '../src/adapters/localStorageExperimentStore'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('LocalStorageExperimentStore', () => {
  it('ignores malformed runs and normalizes legacy records', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      'bus-seed-poc.experiment-results.v1',
      JSON.stringify({
        version: 1,
        runs: [
          null,
          {
            id: 'legacy-1',
            title: 'Legacy',
            mode: 'fake',
            status: 'PASS',
            expectedState: 'PROPAGATED',
            expectedEvents: [],
            actualEvents: [],
            sampleCount: 2,
            eventLog: [],
          },
        ],
      }),
    )

    const runs = new LocalStorageExperimentStore(storage).load()

    expect(runs).toHaveLength(1)
    expect(runs[0].id).toBe('legacy-1')
    expect(runs[0].measurements).toMatchObject({
      receivedSampleCount: 2,
      acceptedSampleCount: 2,
      duplicateSampleCount: 0,
    })
  })
})
