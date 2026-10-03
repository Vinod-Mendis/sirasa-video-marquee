import { ipcMain, dialog } from 'electron'
import { SettingsManager } from '../config/settingsManager'
import { WindowManager } from '../windows/windowManager'
import { IVideoSource } from '../source/IVideoSource'
import { AppSettings, NudgePayload } from '@shared/types'

export function registerIpcHandlers(
  settingsManager: SettingsManager,
  windowManager: WindowManager,
  videoSource: IVideoSource,
  preloadPath: string
): void {
  // Settings
  ipcMain.handle('get-settings', () => {
    return settingsManager.getSettings()
  })

  ipcMain.handle('update-settings', async (_, partial: Partial<AppSettings>) => {
    const oldSettings = settingsManager.getSettings()
    const newSettings = settingsManager.updateSettings(partial)

    // Check if display or mode changed
    if (partial.displayId !== undefined || partial.wallWindowMode !== undefined) {
      windowManager.applyDisplaySettings(newSettings)
    }

    // Check if folder changed
    if (partial.videosFolder !== undefined && partial.videosFolder !== oldSettings.videosFolder) {
      await videoSource.setFolder(partial.videosFolder)
    }

    windowManager.broadcast('settings-updated', newSettings)
    return newSettings
  })

  ipcMain.handle('reset-settings', () => {
    const defaultSettings = settingsManager.resetSettings()
    windowManager.broadcast('settings-updated', defaultSettings)
    return defaultSettings
  })

  ipcMain.handle('nudge-marquee-rect', (_, nudge: NudgePayload) => {
    const updated = settingsManager.nudgeMarqueeRect(
      nudge.dx || 0,
      nudge.dy || 0,
      nudge.dw || 0,
      nudge.dh || 0
    )
    windowManager.broadcast('settings-updated', updated)
    return updated
  })

  // Displays
  ipcMain.handle('get-displays', () => {
    return windowManager.getDisplays()
  })

  // Videos
  ipcMain.handle('get-videos', () => {
    return videoSource.getVideos()
  })

  // Dialogs
  ipcMain.handle('select-folder', async () => {
    const controlWin = windowManager.getControlWindow()
    const options = {
      title: 'Select Videos Folder',
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    }
    const result =
      controlWin && !controlWin.isDestroyed()
        ? await dialog.showOpenDialog(controlWin, options)
        : await dialog.showOpenDialog(options)

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('select-image', async () => {
    const controlWin = windowManager.getControlWindow()
    const options = {
      title: 'Select Background Image',
      properties: ['openFile'] as Array<'openFile'>,
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }
    const result =
      controlWin && !controlWin.isDestroyed()
        ? await dialog.showOpenDialog(controlWin, options)
        : await dialog.showOpenDialog(options)

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  // Window Controls
  ipcMain.handle('toggle-wall-fullscreen', () => {
    const isFs = windowManager.toggleWallFullscreen()
    settingsManager.updateSettings({
      wallWindowMode: isFs ? 'fullscreen' : 'windowed'
    })
    return isFs
  })

  ipcMain.handle('reopen-wall-window', () => {
    const current = settingsManager.getSettings()
    windowManager.createWallWindow(preloadPath, current)
  })

  // Video source events forward to windows
  videoSource.on('change', (videos) => {
    windowManager.broadcast('videos-updated', videos)
  })
}
