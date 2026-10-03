import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  AppSettings,
  DEFAULT_SETTINGS,
  DisplayInfo,
  VideoItem,
  NudgePayload,
  BackendSyncStatus,
  BackendSyncSource
} from '@shared/types'

interface AppContextType {
  settings: AppSettings
  videos: VideoItem[]
  displays: DisplayInfo[]
  syncStatus: BackendSyncStatus | null
  loading: boolean
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  nudge: (nudge: NudgePayload) => Promise<void>
  resetSettings: () => Promise<void>
  selectFolder: () => Promise<void>
  selectImage: () => Promise<void>
  clearImage: () => Promise<void>
  toggleWallFullscreen: () => Promise<void>
  reopenWallWindow: () => Promise<void>
  refreshDisplays: () => Promise<void>
  startSync: () => Promise<void>
  stopSync: () => Promise<void>
  fetchNow: () => Promise<void>
  triggerSyncNow: () => Promise<void>
  resetSyncHistory: () => Promise<void>
  openSyncLog: () => Promise<void>
  toggleAutoStartOnLaunch: (autoStart: boolean) => Promise<void>
  setPollInterval: (sec: number) => Promise<void>
  toggleSource: (sourceId: string, enabled: boolean) => Promise<void>
  addSource: (source: BackendSyncSource) => Promise<void>
  removeSource: (sourceId: string) => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [syncStatus, setSyncStatus] = useState<BackendSyncStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const refreshDisplays = useCallback(async () => {
    if (window.api?.getDisplays) {
      try {
        const list = await window.api.getDisplays()
        setDisplays(list)
      } catch (err) {
        console.error('Failed to get displays:', err)
      }
    }
  }, [])

  useEffect(() => {
    let unlistenSettings: (() => void) | undefined
    let unlistenVideos: (() => void) | undefined
    let unlistenSync: (() => void) | undefined

    const init = async (): Promise<void> => {
      try {
        if (window.api) {
          const [loadedSettings, loadedVideos, loadedDisplays, loadedSyncStatus] =
            await Promise.all([
              window.api.getSettings(),
              window.api.getVideos(),
              window.api.getDisplays(),
              window.api.getSyncStatus?.()
            ])
          setSettings(loadedSettings)
          setVideos(loadedVideos)
          setDisplays(loadedDisplays)
          if (loadedSyncStatus) {
            setSyncStatus(loadedSyncStatus)
          }

          unlistenSettings = window.api.onSettingsUpdated((newSettings) => {
            setSettings(newSettings)
          })

          unlistenVideos = window.api.onVideosUpdated((newVideos) => {
            setVideos(newVideos)
          })

          unlistenSync = window.api.onSyncStatusUpdated?.((newStatus) => {
            setSyncStatus(newStatus)
          })
        }
      } catch (err) {
        console.error('Failed to initialize app state:', err)
      } finally {
        setLoading(false)
      }
    }

    init()

    return () => {
      unlistenSettings?.()
      unlistenVideos?.()
      unlistenSync?.()
    }
  }, [])

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    // Optimistic update
    setSettings((prev) => ({
      ...prev,
      ...partial,
      designCanvas: {
        ...prev.designCanvas,
        ...(partial.designCanvas || {})
      },
      marqueeRect: {
        ...prev.marqueeRect,
        ...(partial.marqueeRect || {})
      },
      sync: {
        ...prev.sync,
        ...(partial.sync || {})
      }
    }))
    if (window.api) {
      try {
        const updated = await window.api.updateSettings(partial)
        setSettings(updated)
      } catch (err) {
        console.error('Failed to update settings:', err)
      }
    }
  }, [])

  const nudge = useCallback(async (nudgePayload: NudgePayload) => {
    if (window.api) {
      try {
        const updated = await window.api.nudgeMarqueeRect(nudgePayload)
        setSettings(updated)
      } catch (err) {
        console.error('Failed to nudge marquee rect:', err)
      }
    }
  }, [])

  const resetSettings = useCallback(async () => {
    if (window.api) {
      try {
        const reset = await window.api.resetSettings()
        setSettings(reset)
      } catch (err) {
        console.error('Failed to reset settings:', err)
      }
    }
  }, [])

  const selectFolder = useCallback(async () => {
    if (window.api) {
      try {
        const folder = await window.api.selectFolder()
        if (folder) {
          await updateSettings({ videosFolder: folder })
        }
      } catch (err) {
        console.error('Failed to select folder:', err)
      }
    }
  }, [updateSettings])

  const selectImage = useCallback(async () => {
    if (window.api) {
      try {
        const imagePath = await window.api.selectImage()
        if (imagePath) {
          await updateSettings({ backgroundImagePath: imagePath })
        }
      } catch (err) {
        console.error('Failed to select image:', err)
      }
    }
  }, [updateSettings])

  const clearImage = useCallback(async () => {
    await updateSettings({ backgroundImagePath: '' })
  }, [updateSettings])

  const toggleWallFullscreen = useCallback(async () => {
    if (window.api) {
      try {
        await window.api.toggleWallFullscreen()
      } catch (err) {
        console.error('Failed to toggle fullscreen:', err)
      }
    }
  }, [])

  const reopenWallWindow = useCallback(async () => {
    if (window.api) {
      try {
        await window.api.reopenWallWindow()
      } catch (err) {
        console.error('Failed to reopen wall window:', err)
      }
    }
  }, [])

  const startSync = useCallback(async () => {
    if (window.api?.startSync) {
      try {
        const status = await window.api.startSync()
        setSyncStatus(status)
      } catch (err) {
        console.error('Failed to start sync:', err)
      }
    }
  }, [])

  const stopSync = useCallback(async () => {
    if (window.api?.stopSync) {
      try {
        const status = await window.api.stopSync()
        setSyncStatus(status)
      } catch (err) {
        console.error('Failed to stop sync:', err)
      }
    }
  }, [])

  const fetchNow = useCallback(async () => {
    if (window.api?.fetchNow) {
      try {
        const status = await window.api.fetchNow()
        setSyncStatus(status)
      } catch (err) {
        console.error('Failed to trigger immediate fetch:', err)
      }
    }
  }, [])

  const triggerSyncNow = fetchNow

  const resetSyncHistory = useCallback(async () => {
    if (window.api?.resetSyncHistory) {
      try {
        const status = await window.api.resetSyncHistory()
        setSyncStatus(status)
      } catch (err) {
        console.error('Failed to reset sync history:', err)
      }
    }
  }, [])

  const openSyncLog = useCallback(async () => {
    if (window.api?.openSyncLog) {
      try {
        await window.api.openSyncLog()
      } catch (err) {
        console.error('Failed to open sync log:', err)
      }
    }
  }, [])

  const toggleAutoStartOnLaunch = useCallback(
    async (autoStart: boolean) => {
      await updateSettings({
        sync: {
          ...settings.sync,
          autoStartOnLaunch: autoStart
        }
      })
    },
    [settings.sync, updateSettings]
  )

  const setPollInterval = useCallback(
    async (sec: number) => {
      await updateSettings({
        sync: {
          ...settings.sync,
          pollIntervalSec: Math.max(3, sec || 10)
        }
      })
    },
    [settings.sync, updateSettings]
  )

  const toggleSource = useCallback(
    async (sourceId: string, enabled: boolean) => {
      const updatedSources = settings.sync.sources.map((src) =>
        src.id === sourceId ? { ...src, enabled } : src
      )
      await updateSettings({
        sync: {
          ...settings.sync,
          sources: updatedSources
        }
      })
    },
    [settings.sync, updateSettings]
  )

  const addSource = useCallback(
    async (source: BackendSyncSource) => {
      const existing = settings.sync.sources.find((s) => s.id === source.id)
      if (existing) return
      const updatedSources = [...settings.sync.sources, source]
      await updateSettings({
        sync: {
          ...settings.sync,
          sources: updatedSources
        }
      })
    },
    [settings.sync, updateSettings]
  )

  const removeSource = useCallback(
    async (sourceId: string) => {
      const updatedSources = settings.sync.sources.filter((s) => s.id !== sourceId)
      await updateSettings({
        sync: {
          ...settings.sync,
          sources: updatedSources
        }
      })
    },
    [settings.sync, updateSettings]
  )

  return (
    <AppContext.Provider
      value={{
        settings,
        videos,
        displays,
        syncStatus,
        loading,
        updateSettings,
        nudge,
        resetSettings,
        selectFolder,
        selectImage,
        clearImage,
        toggleWallFullscreen,
        reopenWallWindow,
        refreshDisplays,
        startSync,
        stopSync,
        fetchNow,
        triggerSyncNow,
        resetSyncHistory,
        openSyncLog,
        toggleAutoStartOnLaunch,
        setPollInterval,
        toggleSource,
        addSource,
        removeSource
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = (): AppContextType => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
