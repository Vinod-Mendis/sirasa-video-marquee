import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { registerMediaScheme, setupMediaProtocol } from './protocol'
import { SettingsManager } from './config/settingsManager'
import { WindowManager } from './windows/windowManager'
import { LocalFolderSource } from './source/LocalFolderSource'
import { BackendSyncService } from './sync/BackendSyncService'
import { registerIpcHandlers } from './ipc/registerIpc'

// 1. Register custom media scheme before app is ready
registerMediaScheme()

// Disable autoplay policy restrictions so videos autoplay without user gesture
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

let settingsManager: SettingsManager
let windowManager: WindowManager
let videoSource: LocalFolderSource
let backendSyncService: BackendSyncService

app.whenReady().then(async () => {
  // Set app user model id for Windows
  electronApp.setAppUserModelId('com.sirasa.videomarquee')

  // Register protocol handler for media://
  setupMediaProtocol()

  // Initialize Core Services
  settingsManager = new SettingsManager()
  windowManager = new WindowManager()

  const initialSettings = settingsManager.getSettings()
  videoSource = new LocalFolderSource(initialSettings.videosFolder)
  backendSyncService = new BackendSyncService(initialSettings.sync, initialSettings.videosFolder)

  const preloadPath = join(__dirname, '../preload/index.js')

  // Register IPC
  registerIpcHandlers(settingsManager, windowManager, videoSource, backendSyncService, preloadPath)

  // Start Video Source Watcher
  await videoSource.start()

  // Initialize Backend Sync Service (remains idle on launch unless autoStartOnLaunch is enabled)
  backendSyncService.init()

  // Create Windows
  // Default windowed in dev mode if settings say windowed, or fullscreen for production wall
  windowManager.createControlWindow(preloadPath)
  windowManager.createWallWindow(preloadPath, initialSettings)

  // Window shortcuts
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createControlWindow(preloadPath)
      windowManager.createWallWindow(preloadPath, settingsManager.getSettings())
    }
  })
})

app.on('before-quit', async () => {
  if (backendSyncService) {
    backendSyncService.stop()
  }
  if (videoSource) {
    await videoSource.stop()
  }
  if (settingsManager) {
    settingsManager.flushToDisk()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
