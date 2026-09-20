import type { Stop } from '../domain/types'

export const STOPS: Record<'A' | 'B', Stop> = {
  A: {
    id: 'A',
    latitude: 37.496557766470936,
    longitude: 126.86220100201324,
  },
  B: {
    id: 'B',
    latitude: 37.499469108053304,
    longitude: 126.86708674015095,
  },
}
