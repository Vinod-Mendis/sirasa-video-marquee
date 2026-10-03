import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface ManifestDownloadedItem {
  key: string // ${sourceName}:${_id}
  sourceName: string
  id: string
  fileName: string
  size: number
  downloadedAt: string
}

export interface ManifestFailureRecord {
  key: string
  attempts: number
  lastError: string
  lastAttemptAt: string
  abandonedUntilRestart?: boolean
}

export interface SyncManifestData {
  downloaded: Record<string, ManifestDownloadedItem>
  failures: Record<string, ManifestFailureRecord>
}

const MAX_FAILURES = 5

export class SyncManifest {
  private filePath: string
  private data: SyncManifestData
  private saveTimeout: NodeJS.Timeout | null = null

  constructor() {
    const userDataPath = app.getPath('userData')
    this.filePath = path.join(userDataPath, 'sync-manifest.json')
    this.data = this.loadFromDisk()
  }

  private loadFromDisk(): SyncManifestData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        const downloaded: Record<string, ManifestDownloadedItem> = parsed.downloaded || {}
        const failures: Record<string, ManifestFailureRecord> = parsed.failures || {}

        // Reset abandonedUntilRestart on app start so failed items can be tried again in this new session
        for (const key of Object.keys(failures)) {
          if (failures[key].abandonedUntilRestart) {
            failures[key].attempts = 0
            failures[key].abandonedUntilRestart = false
          }
        }

        return { downloaded, failures }
      }
    } catch (err) {
      console.error('[SyncManifest] Failed to load manifest, initializing new one:', err)
    }
    return { downloaded: {}, failures: {} }
  }

  public hasDownloaded(key: string): boolean {
    return Boolean(this.data.downloaded[key])
  }

  public canAttempt(key: string): boolean {
    if (this.hasDownloaded(key)) {
      return false
    }

    const failure = this.data.failures[key]
    if (!failure) {
      return true
    }

    if (failure.abandonedUntilRestart || failure.attempts >= MAX_FAILURES) {
      return false
    }

    // Exponential backoff between retries: 5s, 10s, 20s, 40s...
    const backoffMs = Math.min(60000, 5000 * Math.pow(2, failure.attempts - 1))
    const lastAttemptTime = new Date(failure.lastAttemptAt).getTime()
    const now = Date.now()

    return now - lastAttemptTime >= backoffMs
  }

  public removeDownloaded(key: string): void {
    let changed = false
    if (this.data.downloaded[key]) {
      delete this.data.downloaded[key]
      changed = true
    }
    if (this.data.failures[key]) {
      delete this.data.failures[key]
      changed = true
    }
    if (changed) {
      this.scheduleSave()
    }
  }

  public reconcileWithFolder(folderPath: string): number {
    let missingCount = 0

    if (folderPath && fs.existsSync(folderPath)) {
      for (const [key, item] of Object.entries(this.data.downloaded)) {
        const filePath = path.join(folderPath, item.fileName)
        let existsAndValid = false
        try {
          if (fs.existsSync(filePath)) {
            const stat = fs.statSync(filePath)
            if (stat.isFile() && stat.size > 0) {
              existsAndValid = true
            }
          }
        } catch {
          existsAndValid = false
        }

        if (!existsAndValid) {
          delete this.data.downloaded[key]
          missingCount++
        }
      }
    } else {
      const total = Object.keys(this.data.downloaded).length
      if (total > 0) {
        missingCount = total
        this.data.downloaded = {}
      }
    }

    // Clear failed-attempt counters on reconciliation as required
    this.data.failures = {}

    this.flushToDisk()
    return missingCount
  }

  public clearAll(): void {
    this.data.downloaded = {}
    this.data.failures = {}
    this.flushToDisk()
  }

  public markDownloaded(
    key: string,
    sourceName: string,
    id: string,
    fileName: string,
    size: number
  ): void {
    delete this.data.failures[key]
    this.data.downloaded[key] = {
      key,
      sourceName,
      id,
      fileName,
      size,
      downloadedAt: new Date().toISOString()
    }
    this.scheduleSave()
  }

  public recordFailure(key: string, errorMsg: string): void {
    const existing = this.data.failures[key]
    const attempts = (existing?.attempts || 0) + 1
    const abandoned = attempts >= MAX_FAILURES

    this.data.failures[key] = {
      key,
      attempts,
      lastError: errorMsg,
      lastAttemptAt: new Date().toISOString(),
      abandonedUntilRestart: abandoned
    }
    this.scheduleSave()
  }

  public getDownloadedCount(): number {
    return Object.keys(this.data.downloaded).length
  }

  public getFailedCount(): number {
    return Object.keys(this.data.failures).length
  }

  public getAbandonedCount(): number {
    return Object.values(this.data.failures).filter((f) => f.abandonedUntilRestart).length
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
    this.saveTimeout = setTimeout(() => {
      this.flushToDisk()
    }, 500)
  }

  public flushToDisk(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      console.error('[SyncManifest] Failed to write manifest to disk:', err)
    }
  }
}
