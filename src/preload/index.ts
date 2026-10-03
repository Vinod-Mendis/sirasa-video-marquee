import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { AppSettings, DisplayInfo, VideoItem, NudgePayload, BackendSyncStatus } from '@shared/types'

export interface MarqueeAPI {
  getSettings: () => Promise<AppSettings>
  updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings>
  resetSettings: () => Promise<AppSettings>
  nudgeMarqueeRect: (nudge: NudgePayload) => Promise<AppSettings>
  getDisplays: () => Promise<DisplayInfo[]>
  getVideos: () => Promise<VideoItem[]>
  selectFolder: () => Promise<string | null>
  selectImage: () => Promise<string | null>
  toggleWallFullscreen: () => Promise<boolean>
  reopenWallWindow: () => Promise<void>
  onSettingsUpdated: (callback: (settings: AppSettings) => void) => () => void
  onVideosUpdated: (callback: (videos: VideoItem[]) => void) => () => void
  getSyncStatus: () => Promise<BackendSyncStatus>
  startSync: () => Promise<BackendSyncStatus>
  stopSync: () => Promise<BackendSyncStatus>
  fetchNow: () => Promise<BackendSyncStatus>
  triggerSyncNow: () => Promise<BackendSyncStatus>
  resetSyncHistory: () => Promise<BackendSyncStatus>
  openSyncLog: () => Promise<void>
  onSyncStatusUpdated: (callback: (status: BackendSyncStatus) => void) => () => void
}

const api: MarqueeAPI = {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (partial) => ipcRenderer.invoke('update-settings', partial),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  nudgeMarqueeRect: (nudge) => ipcRenderer.invoke('nudge-marquee-rect', nudge),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getVideos: () => ipcRenderer.invoke('get-videos'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectImage: () => ipcRenderer.invoke('select-image'),
  toggleWallFullscreen: () => ipcRenderer.invoke('toggle-wall-fullscreen'),
  reopenWallWindow: () => ipcRenderer.invoke('reopen-wall-window'),
  onSettingsUpdated: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, settings: AppSettings): void =>
      callback(settings)
    ipcRenderer.on('settings-updated', handler)
    return () => {
      ipcRenderer.removeListener('settings-updated', handler)
    }
  },
  onVideosUpdated: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, videos: VideoItem[]): void => callback(videos)
    ipcRenderer.on('videos-updated', handler)
    return () => {
      ipcRenderer.removeListener('videos-updated', handler)
    }
  },
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  startSync: () => ipcRenderer.invoke('start-sync'),
  stopSync: () => ipcRenderer.invoke('stop-sync'),
  fetchNow: () => ipcRenderer.invoke('fetch-now'),
  triggerSyncNow: () => ipcRenderer.invoke('trigger-sync-now'),
  resetSyncHistory: () => ipcRenderer.invoke('reset-sync-history'),
  openSyncLog: () => ipcRenderer.invoke('open-sync-log'),
  onSyncStatusUpdated: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, status: BackendSyncStatus): void =>
      callback(status)
    ipcRenderer.on('sync-status-updated', handler)
    return () => {
      ipcRenderer.removeListener('sync-status-updated', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
