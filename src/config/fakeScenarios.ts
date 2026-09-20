import type {
  DomainEvent,
  LocationSample,
  Stop,
  TripStatus,
} from '../domain/types'

const METERS_PER_LATITUDE_DEGREE = 111_320

export interface FakeScenario {
  id: string
  title: string
  description: string
  samples: LocationSample[]
  expectedState: TripStatus
  expectedEvents: readonly DomainEvent['type'][]
  failureReason?: string
}

function offsetNorth(
  stop: Stop,
  meters: number,
  accuracy = 5,
): LocationSample {
  return {
    timestamp: 0,
    latitude: stop.latitude + meters / METERS_PER_LATITUDE_DEGREE,
    longitude: stop.longitude,
    accuracy,
  }
}

function sampleAt(
  stop: Stop,
  meters: number,
  timestamp: number,
  accuracy = 5,
): LocationSample {
  return {
    ...offsetNorth(stop, meters, accuracy),
    timestamp,
  }
}

export function createNormalFakeScenario(
  stops: Record<'A' | 'B', Stop>,
): LocationSample[] {
  return [
    sampleAt(stops.A, 20, 0),
    sampleAt(stops.A, 20, 20_000),
    sampleAt(stops.A, 70, 21_000),
    sampleAt(stops.B, 70, 22_000),
    sampleAt(stops.B, 20, 23_000),
    sampleAt(stops.B, 20, 38_000),
  ]
}

export function createFakeScenarioCatalog(
  stops: Record<'A' | 'B', Stop>,
): FakeScenario[] {
  const normalSamples = createNormalFakeScenario(stops)

  return [
    {
      id: 'normal-fake-propagation',
      title: '정상 Fake GPS 전파 플로우',
      description: 'A20m → 20초 → A70m → B70m → B20m → 15초',
      samples: normalSamples,
      expectedState: 'PROPAGATED',
      expectedEvents: [
        'entered-a',
        'acquired-seed',
        'left-a',
        'approaching-b',
        'arrived-at-b',
        'propagated-seed',
      ],
    },
    {
      id: 'a-boundary-jitter',
      title: 'A 경계 GPS 흔들림',
      description: 'A 거리 40m 안팎에서 40m → 41m → 39m → 42m',
      samples: [
        sampleAt(stops.A, 20, 0),
        sampleAt(stops.A, 41, 5_000),
        sampleAt(stops.A, 39, 10_000),
        sampleAt(stops.A, 42, 15_000),
      ],
      expectedState: 'AT_A',
      expectedEvents: ['entered-a'],
      failureReason: 'A 체류 구간이 연속되지 않아 씨앗을 획득하지 않음',
    },
    {
      id: 'a-dwell-under-duration',
      title: 'A 체류 시간 부족',
      description: 'A 20m 안에서 19.9초 체류',
      samples: [sampleAt(stops.A, 20, 0), sampleAt(stops.A, 20, 19_900)],
      expectedState: 'AT_A',
      expectedEvents: ['entered-a'],
      failureReason: 'A 최소 체류 시간 20초에 도달하지 않음',
    },
    {
      id: 'a-low-accuracy',
      title: 'A 체류 중 GPS 저정확도',
      description: 'A 체류 중 accuracy ±100m 샘플 수신',
      samples: [
        sampleAt(stops.A, 20, 0),
        sampleAt(stops.A, 20, 20_000, 100),
      ],
      expectedState: 'AT_A',
      expectedEvents: ['entered-a'],
      failureReason: 'GPS accuracy가 허용 기준 50m를 초과해 샘플을 무시함',
    },
    {
      id: 'b-dwell-interrupted',
      title: 'B 체류 중 이탈',
      description: 'B 20m 진입 후 14초 뒤 B 70m로 이탈',
      samples: [
        sampleAt(stops.A, 20, 0),
        sampleAt(stops.A, 20, 20_000),
        sampleAt(stops.A, 70, 21_000),
        sampleAt(stops.B, 70, 22_000),
        sampleAt(stops.B, 20, 23_000),
        sampleAt(stops.B, 70, 37_000),
      ],
      expectedState: 'APPROACHING_B',
      expectedEvents: [
        'entered-a',
        'acquired-seed',
        'left-a',
        'approaching-b',
        'cancelled-b-dwell',
      ],
      failureReason: 'B 15초 체류 전에 60m 이상 벗어나 체류를 취소함',
    },
    {
      id: 'post-propagation-resample',
      title: '전파 후 GPS 재수신',
      description: '정상 전파 후 동일 이동의 GPS 샘플 추가 수신',
      samples: [...normalSamples, sampleAt(stops.B, 20, 39_000)],
      expectedState: 'PROPAGATED',
      expectedEvents: [
        'entered-a',
        'acquired-seed',
        'left-a',
        'approaching-b',
        'arrived-at-b',
        'propagated-seed',
      ],
      failureReason: '이미 전파된 이동에서 중복 전파가 발생하지 않음',
    },
  ]
}
