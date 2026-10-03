import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { AppSettings, DEFAULT_SETTINGS, DisplayInfo, VideoItem, NudgePayload } from '@shared/types'

interface AppContextType {
  settings: AppSettings
  videos: VideoItem[]
  displays: DisplayInfo[]
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
}

const AppContext = createContext<AppContextType | null>(null)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
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

    const init = async (): Promise<void> => {
      try {
        if (window.api) {
          const [loadedSettings, loadedVideos, loadedDisplays] = await Promise.all([
            window.api.getSettings(),
            window.api.getVideos(),
            window.api.getDisplays()
          ])
          setSettings(loadedSettings)
          setVideos(loadedVideos)
          setDisplays(loadedDisplays)

          unlistenSettings = window.api.onSettingsUpdated((newSettings) => {
            setSettings(newSettings)
          })

          unlistenVideos = window.api.onVideosUpdated((newVideos) => {
            setVideos(newVideos)
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

  return (
    <AppContext.Provider
      value={{
        settings,
        videos,
        displays,
        loading,
        updateSettings,
        nudge,
        resetSettings,
        selectFolder,
        selectImage,
        clearImage,
        toggleWallFullscreen,
        reopenWallWindow,
        refreshDisplays
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
