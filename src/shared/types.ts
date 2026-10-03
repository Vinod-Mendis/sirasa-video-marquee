export interface DesignCanvasConfig {
  width: number // default 7680
  height: number // default 240
}

export interface MarqueeRectConfig {
  x: number // default 1920
  y: number // default 0
  width: number // default 3840
  height: number // default 240
}

export interface BackendSyncSource {
  id: string
  name: string
  url: string
  enabled: boolean
}

export interface BackendSyncSettings {
  autoStartOnLaunch: boolean // default false (Start sync automatically on launch)
  pollIntervalSec: number // default 10
  sources: BackendSyncSource[]
}

export type BackendSyncState = 'idle' | 'fetching' | 'downloading' | 'waiting' | 'error'

export interface BackendSyncStatus {
  state: BackendSyncState
  isRunning: boolean
  secondsUntilNextFetch: number
  pollIntervalSec: number
  nextPollProgress: number // 0.0 to 1.0 (fills up as poll interval elapses)
  lastSuccessfulFetchTime: string | null
  activeDownloads: number
  queuedDownloads: number
  batchCompleted: number
  batchTotal: number
  downloadedCount: number
  failedCount: number
  lastError: string | null
  sourcesStatus: Record<
    string,
    {
      lastPolled: string | null
      itemCount: number
      error: string | null
    }
  >
}

export interface AppSettings {
  videosFolder: string
  backgroundImagePath: string
  designCanvas: DesignCanvasConfig
  marqueeRect: MarqueeRectConfig
  speed: number // px per second, default 150
  tileHeightRatio: number // default 1.0 (e.g. 0.4 to 1.5)
  tileAspectRatio: number // default 16/9 (~1.777778)
  gap: number // default 30
  edgeFade: number // px fade width, default 60 (0 for no fade)
  maxPlayingVideos: number // default 8
  displayId: number | null // null = primary display
  calibrationMode: boolean // default false
  wallWindowMode: 'fullscreen' | 'windowed' // windowed for easy single-display dev/preview
  sync: BackendSyncSettings
}

export interface VideoItem {
  id: string
  fileName: string
  filePath: string
  url: string
  size: number
  mtimeMs: number
}

export interface DisplayInfo {
  id: number
  label: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  isPrimary: boolean
  scaleFactor: number
}

export interface NudgePayload {
  dx?: number
  dy?: number
  dw?: number
  dh?: number
}

export const DEFAULT_SYNC_SOURCES: BackendSyncSource[] = [
  {
    id: 'drawings',
    name: 'drawings',
    url: 'https://sirasa-mongodb-server.onrender.com/api/drawings',
    enabled: true
  },
  {
    id: 'quick-drawings',
    name: 'quick-drawings',
    url: 'https://sirasa-mongodb-server.onrender.com/api/quick-drawings',
    enabled: true
  }
]

export const DEFAULT_SYNC_SETTINGS: BackendSyncSettings = {
  autoStartOnLaunch: false,
  pollIntervalSec: 10,
  sources: DEFAULT_SYNC_SOURCES
}

export const DEFAULT_SETTINGS: AppSettings = {
  videosFolder: '',
  backgroundImagePath: '',
  designCanvas: {
    width: 7680,
    height: 240
  },
  marqueeRect: {
    x: 1920,
    y: 0,
    width: 3840,
    height: 240
  },
  speed: 150,
  tileHeightRatio: 1.0,
  tileAspectRatio: 16 / 9,
  gap: 30,
  edgeFade: 60,
  maxPlayingVideos: 8,
  displayId: null,
  calibrationMode: false,
  wallWindowMode: 'fullscreen',
  sync: DEFAULT_SYNC_SETTINGS
}
