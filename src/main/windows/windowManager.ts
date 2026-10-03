import { BrowserWindow, screen, powerSaveBlocker, app, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { AppSettings, DisplayInfo } from '@shared/types'

export class WindowManager {
  private controlWindow: BrowserWindow | null = null
  private wallWindow: BrowserWindow | null = null
  private powerSaveBlockerId: number | null = null

  constructor() {
    this.initPowerSaveBlocker()
  }

  private initPowerSaveBlocker(): void {
    try {
      this.powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep')
      console.log('[WindowManager] PowerSaveBlocker started (id:', this.powerSaveBlockerId, ')')
    } catch (err) {
      console.error('[WindowManager] Failed to start powerSaveBlocker:', err)
    }
  }

  public getDisplays(): DisplayInfo[] {
    const primary = screen.getPrimaryDisplay()
    return screen.getAllDisplays().map((d, index) => ({
      id: d.id,
      label: d.label || `Display ${index + 1} (${d.bounds.width}x${d.bounds.height})`,
      bounds: { ...d.bounds },
      isPrimary: d.id === primary.id,
      scaleFactor: d.scaleFactor
    }))
  }

  public createControlWindow(preloadPath: string): BrowserWindow {
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.focus()
      return this.controlWindow
    }

    this.controlWindow = new BrowserWindow({
      width: 1100,
      height: 780,
      minWidth: 850,
      minHeight: 550,
      title: 'Sirasa Video Marquee - Control Panel',
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: preloadPath,
        sandbox: false,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })

    this.controlWindow.on('ready-to-show', () => {
      this.controlWindow?.show()
    })

    this.controlWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    this.controlWindow.on('closed', () => {
      this.controlWindow = null
      // If control window is closed, close wall window and exit app
      if (this.wallWindow && !this.wallWindow.isDestroyed()) {
        this.wallWindow.close()
      }
      app.quit()
    })

    this.loadUrl(this.controlWindow, 'control')
    return this.controlWindow
  }

  public createWallWindow(preloadPath: string, settings: AppSettings): BrowserWindow {
    if (this.wallWindow && !this.wallWindow.isDestroyed()) {
      this.wallWindow.focus()
      return this.wallWindow
    }

    const targetDisplay = this.findTargetDisplay(settings.displayId)
    const isFullscreen = settings.wallWindowMode === 'fullscreen'

    this.wallWindow = new BrowserWindow({
      x: isFullscreen ? targetDisplay.bounds.x : targetDisplay.bounds.x + 50,
      y: isFullscreen ? targetDisplay.bounds.y : targetDisplay.bounds.y + 50,
      width: isFullscreen ? targetDisplay.bounds.width : 1280,
      height: isFullscreen ? targetDisplay.bounds.height : 240,
      frame: !isFullscreen,
      fullscreen: isFullscreen,
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      show: false,
      title: 'Sirasa Video Marquee - Wall Display',
      webPreferences: {
        preload: preloadPath,
        sandbox: false,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })

    this.wallWindow.removeMenu()

    // Hide cursor in wall window
    this.wallWindow.webContents.on('did-finish-load', () => {
      this.wallWindow?.webContents.insertCSS(
        '* { cursor: none !important; user-select: none !important; }'
      )
    })

    this.wallWindow.on('ready-to-show', () => {
      this.wallWindow?.show()
    })

    this.wallWindow.on('closed', () => {
      this.wallWindow = null
    })

    this.loadUrl(this.wallWindow, 'wall')
    return this.wallWindow
  }

  public applyDisplaySettings(settings: AppSettings): void {
    if (!this.wallWindow || this.wallWindow.isDestroyed()) return

    const targetDisplay = this.findTargetDisplay(settings.displayId)
    const isFullscreen = settings.wallWindowMode === 'fullscreen'

    if (isFullscreen) {
      this.wallWindow.setFullScreen(false)
      this.wallWindow.setBounds(targetDisplay.bounds)
      this.wallWindow.setFullScreen(true)
    } else {
      this.wallWindow.setFullScreen(false)
      this.wallWindow.setBounds({
        x: targetDisplay.bounds.x + 40,
        y: targetDisplay.bounds.y + 40,
        width: 1280,
        height: 240
      })
    }
  }

  public toggleWallFullscreen(): boolean {
    if (!this.wallWindow || this.wallWindow.isDestroyed()) return false
    const nowFullscreen = !this.wallWindow.isFullScreen()
    this.wallWindow.setFullScreen(nowFullscreen)
    return nowFullscreen
  }

  public broadcast(channel: string, ...args: unknown[]): void {
    if (this.controlWindow && !this.controlWindow.isDestroyed()) {
      this.controlWindow.webContents.send(channel, ...args)
    }
    if (this.wallWindow && !this.wallWindow.isDestroyed()) {
      this.wallWindow.webContents.send(channel, ...args)
    }
  }

  public getControlWindow(): BrowserWindow | null {
    return this.controlWindow
  }

  public getWallWindow(): BrowserWindow | null {
    return this.wallWindow
  }

  private findTargetDisplay(displayId: number | null): Electron.Display {
    const displays = screen.getAllDisplays()
    if (displayId != null) {
      const match = displays.find((d) => d.id === displayId)
      if (match) return match
    }
    return screen.getPrimaryDisplay()
  }

  private loadUrl(window: BrowserWindow, view: 'control' | 'wall'): void {
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${view}`)
    } else {
      window.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: view
      })
    }
  }
}
