import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserLocationSource } from '../src/adapters/browserLocationSource'
import { isLocationSourceError } from '../src/ports/locationSource'

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  'navigator',
)

afterEach(() => {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor)
  } else {
    Reflect.deleteProperty(globalThis, 'navigator')
  }
})

function setNavigator(value: unknown): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value,
  })
}

describe('BrowserLocationSource', () => {
  it('maps browser positions and clears the watch on stop', () => {
    let success: ((position: GeolocationPosition) => void) | undefined
    const clearWatch = vi.fn()
    setNavigator({
      geolocation: {
        watchPosition: vi.fn((onSuccess) => {
          success = onSuccess
          return 17
        }),
        clearWatch,
      },
    })
    const onSample = vi.fn()
    const source = new BrowserLocationSource()

    const stop = source.start(onSample, vi.fn())
    success?.({
      timestamp: 123,
      coords: {
        latitude: 37,
        longitude: 127,
        accuracy: 8,
      },
    } as GeolocationPosition)
    stop()

    expect(onSample).toHaveBeenCalledWith({
      timestamp: 123,
      latitude: 37,
      longitude: 127,
      accuracy: 8,
    })
    expect(clearWatch).toHaveBeenCalledWith(17)
  })

  it('reports unsupported environments', () => {
    setNavigator({})
    const onError = vi.fn()

    new BrowserLocationSource().start(vi.fn(), onError)

    expect(onError).toHaveBeenCalledOnce()
    const error = onError.mock.calls[0][0]
    expect(isLocationSourceError(error)).toBe(true)
    expect(error).toMatchObject({ code: 'unsupported' })
  })

  it('maps permission denial and stops the watch', () => {
    let reportError: ((error: GeolocationPositionError) => void) | undefined
    const clearWatch = vi.fn()
    setNavigator({
      geolocation: {
        watchPosition: vi.fn((_onSuccess, onError) => {
          reportError = onError
          return 3
        }),
        clearWatch,
      },
    })
    const onError = vi.fn()

    new BrowserLocationSource().start(vi.fn(), onError)
    reportError?.({
      code: 1,
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
      message: 'denied',
    } as GeolocationPositionError)

    expect(onError.mock.calls[0][0]).toMatchObject({
      code: 'permission-denied',
    })
    expect(clearWatch).toHaveBeenCalledWith(3)
  })

  it('reports synchronous watch failures', () => {
    setNavigator({
      geolocation: {
        watchPosition: vi.fn(() => {
          throw new Error('blocked')
        }),
        clearWatch: vi.fn(),
      },
    })
    const onError = vi.fn()

    new BrowserLocationSource().start(vi.fn(), onError)

    expect(onError.mock.calls[0][0]).toMatchObject({ code: 'watch-failed' })
  })
})
