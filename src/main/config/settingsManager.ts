import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'

export class SettingsManager {
  private settingsFilePath: string
  private currentSettings: AppSettings
  private saveTimeout: NodeJS.Timeout | null = null
  private listeners: Array<(settings: AppSettings) => void> = []

  constructor() {
    const userDataPath = app.getPath('userData')
    this.settingsFilePath = path.join(userDataPath, 'settings.json')
    this.currentSettings = this.loadFromDisk()
  }

  private loadFromDisk(): AppSettings {
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const data = fs.readFileSync(this.settingsFilePath, 'utf-8')
        const parsed = JSON.parse(data)
        // Deep merge with defaults
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          designCanvas: {
            ...DEFAULT_SETTINGS.designCanvas,
            ...(parsed.designCanvas || {})
          },
          marqueeRect: {
            ...DEFAULT_SETTINGS.marqueeRect,
            ...(parsed.marqueeRect || {})
          },
          sync: {
            ...DEFAULT_SETTINGS.sync,
            ...(parsed.sync || {}),
            sources: parsed.sync?.sources || DEFAULT_SETTINGS.sync.sources
          }
        }
      }
    } catch (err) {
      console.error('[SettingsManager] Failed to load settings from disk, using defaults:', err)
    }
    return { ...DEFAULT_SETTINGS }
  }

  public getSettings(): AppSettings {
    return { ...this.currentSettings }
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.currentSettings = {
      ...this.currentSettings,
      ...partial,
      designCanvas: {
        ...this.currentSettings.designCanvas,
        ...(partial.designCanvas || {})
      },
      marqueeRect: {
        ...this.currentSettings.marqueeRect,
        ...(partial.marqueeRect || {})
      },
      sync: {
        ...this.currentSettings.sync,
        ...(partial.sync || {})
      }
    }

    this.scheduleSave()
    this.notifyListeners()
    return this.getSettings()
  }

  public nudgeMarqueeRect(dx = 0, dy = 0, dw = 0, dh = 0): AppSettings {
    const rect = this.currentSettings.marqueeRect
    return this.updateSettings({
      marqueeRect: {
        x: Math.max(0, rect.x + dx),
        y: Math.max(0, rect.y + dy),
        width: Math.max(100, rect.width + dw),
        height: Math.max(50, rect.height + dh)
      }
    })
  }

  public resetSettings(): AppSettings {
    this.currentSettings = { ...DEFAULT_SETTINGS }
    this.scheduleSave()
    this.notifyListeners()
    return this.getSettings()
  }

  public onChange(listener: (settings: AppSettings) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notifyListeners(): void {
    const clone = this.getSettings()
    for (const listener of this.listeners) {
      try {
        listener(clone)
      } catch (err) {
        console.error('[SettingsManager] Error in change listener:', err)
      }
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
    this.saveTimeout = setTimeout(() => {
      this.flushToDisk()
    }, 300)
  }

  public flushToDisk(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    try {
      const dir = path.dirname(this.settingsFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(
        this.settingsFilePath,
        JSON.stringify(this.currentSettings, null, 2),
        'utf-8'
      )
    } catch (err) {
      console.error('[SettingsManager] Failed to write settings to disk:', err)
    }
  }
}
