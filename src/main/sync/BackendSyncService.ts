import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import { BackendSyncSettings, BackendSyncStatus, BackendSyncState } from '@shared/types'
import { SyncManifest } from './syncManifest'
import { SyncLogger } from './syncLogger'

interface ApiRecord {
  _id: string
  imageUrl?: string
  uploadedAt?: string
  videoGeneratedAt?: string
  videoUrl?: string
}

interface DownloadTask {
  key: string
  sourceName: string
  id: string
  videoUrl: string
}

const MAX_CONCURRENT_DOWNLOADS = 3

export class BackendSyncService extends EventEmitter {
  private settings: BackendSyncSettings
  private videosFolder: string
  private manifest: SyncManifest
  private logger: SyncLogger
  private tempDir: string

  private isRunning = false
  private isPolling = false
  private isDestroyed = false
  private isFirstPoll = true

  private nextPollTimestamp: number | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null

  private downloadQueue: DownloadTask[] = []
  private activeDownloadsCount = 0
  private inFlightKeys: Set<string> = new Set()

  private batchTotal = 0
  private batchCompleted = 0

  private status: BackendSyncStatus = {
    state: 'idle',
    isRunning: false,
    secondsUntilNextFetch: 0,
    pollIntervalSec: 10,
    nextPollProgress: 0,
    lastSuccessfulFetchTime: null,
    activeDownloads: 0,
    queuedDownloads: 0,
    batchCompleted: 0,
    batchTotal: 0,
    downloadedCount: 0,
    failedCount: 0,
    lastError: null,
    sourcesStatus: {}
  }

  constructor(settings: BackendSyncSettings, videosFolder: string) {
    super()
    this.settings = settings
    this.videosFolder = videosFolder
    this.manifest = new SyncManifest()
    this.logger = new SyncLogger()

    const userDataPath = app.getPath('userData')
    this.tempDir = path.join(userDataPath, 'sync_temp')
    this.ensureTempDir()

    this.status.pollIntervalSec = this.settings.pollIntervalSec
    this.status.downloadedCount = this.manifest.getDownloadedCount()
    this.status.failedCount = this.manifest.getFailedCount()

    // Start 1-second heartbeat interval for precise timer updates
    this.heartbeatInterval = setInterval(() => {
      this.onTick()
    }, 1000)
  }

  public getLogger(): SyncLogger {
    return this.logger
  }

  public getStatus(): BackendSyncStatus {
    return {
      ...this.status,
      isRunning: this.isRunning,
      activeDownloads: this.activeDownloadsCount,
      queuedDownloads: this.downloadQueue.length,
      batchCompleted: this.batchCompleted,
      batchTotal: this.batchTotal,
      downloadedCount: this.manifest.getDownloadedCount(),
      failedCount: this.manifest.getFailedCount()
    }
  }

  /**
   * Called once at application startup.
   * If autoStartOnLaunch is false (default), sync remains IDLE.
   */
  public init(): void {
    if (this.settings.autoStartOnLaunch) {
      this.logger.info('Auto-starting backend sync on app launch as configured in settings.')
      this.startSync()
    } else {
      this.isRunning = false
      this.status.state = 'idle'
      this.logger.info(
        'Backend sync initialized in IDLE state (manual start required via Control Panel).'
      )
      this.emitStatus()
    }
  }

  /**
   * Starts sync polling immediately (first fetch right away)
   */
  public async startSync(): Promise<void> {
    if (this.isRunning) return

    this.isRunning = true
    this.isDestroyed = false
    this.nextPollTimestamp = null

    // Reconcile manifest with folder before first fetch
    if (this.videosFolder) {
      const missingCount = this.manifest.reconcileWithFolder(this.videosFolder)
      if (missingCount > 0) {
        this.logger.info(`Reconciled: ${missingCount} missing file(s) will be re-downloaded`)
      } else {
        this.logger.info('Reconciled: All manifest files exist on disk')
      }
    }

    this.logger.info(
      `Sync STARTED by operator. Poll interval: ${this.settings.pollIntervalSec}s, sources: ${this.settings.sources.length}`
    )

    this.updateStatus({
      isRunning: true,
      state: 'fetching',
      downloadedCount: this.manifest.getDownloadedCount(),
      failedCount: this.manifest.getFailedCount(),
      lastError: null
    })

    // Execute first fetch immediately
    await this.pollAllSources()
  }

  /**
   * Stops sync polling (pauses polling; in-flight downloads finish safely)
   */
  public stopSync(): void {
    if (!this.isRunning) return

    this.isRunning = false
    this.nextPollTimestamp = null
    this.logger.info('Sync STOPPED by operator (in-flight downloads will finish).')

    this.updateStatus({
      isRunning: false,
      state: this.activeDownloadsCount > 0 ? 'downloading' : 'idle',
      secondsUntilNextFetch: 0,
      nextPollProgress: 0
    })
  }

  /**
   * Triggers an immediate fetch and resets the countdown
   */
  public async fetchNow(): Promise<void> {
    if (this.isPolling) return

    this.logger.info('Immediate fetch triggered by operator.')
    this.nextPollTimestamp = null

    // If sync wasn't started, also activate it
    if (!this.isRunning) {
      this.isRunning = true
    }

    this.updateStatus({
      isRunning: true,
      state: 'fetching',
      secondsUntilNextFetch: 0,
      nextPollProgress: 0
    })

    await this.pollAllSources()
  }

  /**
   * Clears manifest and failed records so the next fetch re-downloads everything from both sources.
   */
  public resetSyncHistory(): void {
    this.manifest.clearAll()
    this.batchTotal = 0
    this.batchCompleted = 0
    this.logger.info('Sync history reset by operator. Manifest and failed records cleared.')
    this.updateStatus({
      downloadedCount: 0,
      failedCount: 0,
      lastError: null
    })
  }

  public stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    this.isRunning = false
    this.isDestroyed = true
    this.manifest.flushToDisk()
    this.logger.info('Backend sync service stopped on app shutdown.')
  }

  public updateSettings(settings: BackendSyncSettings, videosFolder: string): void {
    this.settings = settings
    this.videosFolder = videosFolder
    this.status.pollIntervalSec = settings.pollIntervalSec

    // If poll interval changed while waiting, adjust next poll timestamp
    if (this.isRunning && this.nextPollTimestamp && !this.isPolling) {
      const remainingSec = Math.max(1, Math.ceil((this.nextPollTimestamp - Date.now()) / 1000))
      if (remainingSec > settings.pollIntervalSec) {
        this.nextPollTimestamp = Date.now() + settings.pollIntervalSec * 1000
      }
    }
    this.emitStatus()
  }

  private ensureTempDir(): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true })
      }
    } catch (err) {
      this.logger.error('Failed to create temp directory', err)
    }
  }

  /**
   * 1-second heartbeat tick: calculates countdown, progress bar, and triggers scheduled polls.
   */
  private onTick(): void {
    if (this.isDestroyed) return

    const totalSec = Math.max(3, this.settings.pollIntervalSec)
    const totalMs = totalSec * 1000

    if (!this.isRunning) {
      const currentState: BackendSyncState = this.activeDownloadsCount > 0 ? 'downloading' : 'idle'
      this.status.state = currentState
      this.status.secondsUntilNextFetch = 0
      this.status.nextPollProgress = 0
      this.emitStatus()
      return
    }

    if (this.isPolling) {
      this.status.state = 'fetching'
      this.status.secondsUntilNextFetch = 0
      this.status.nextPollProgress = 1
      this.emitStatus()
      return
    }

    // Determine state
    if (this.activeDownloadsCount > 0) {
      this.status.state = 'downloading'
    } else if (this.status.lastError) {
      this.status.state = 'error'
    } else {
      this.status.state = 'waiting'
    }

    // Handle countdown timer
    if (this.nextPollTimestamp != null) {
      const diffMs = this.nextPollTimestamp - Date.now()

      if (diffMs <= 0) {
        this.nextPollTimestamp = null
        this.status.secondsUntilNextFetch = 0
        this.status.nextPollProgress = 1
        this.emitStatus()
        this.pollAllSources().catch((err) => {
          this.logger.error('Error during scheduled poll', err)
        })
        return
      }

      const remainingSec = Math.max(0, Math.ceil(diffMs / 1000))
      const elapsedMs = totalMs - diffMs
      const progress = Math.max(0, Math.min(1, elapsedMs / totalMs))

      this.status.secondsUntilNextFetch = remainingSec
      this.status.nextPollProgress = progress
    } else {
      this.status.secondsUntilNextFetch = 0
      this.status.nextPollProgress = 0
    }

    this.emitStatus()
  }

  private async pollAllSources(): Promise<void> {
    if (this.isPolling || this.isDestroyed) {
      return
    }

    if (!this.videosFolder) {
      this.updateStatus({
        state: 'error',
        lastError: 'No videos folder selected in settings'
      })
      this.scheduleNextFetchTimer()
      return
    }

    this.isPolling = true
    this.updateStatus({
      state: 'fetching',
      secondsUntilNextFetch: 0,
      nextPollProgress: 0
    })

    const timeoutMs = this.isFirstPoll ? 75000 : 35000 // up to 75s for Render wake-up
    this.isFirstPoll = false

    const enabledSources = this.settings.sources.filter((s) => s.enabled)
    let anyError = false
    let lastErrMsg: string | null = null
    let newlyFoundCount = 0

    for (const source of enabledSources) {
      try {
        const items = await this.fetchSourceRecords(source.url, timeoutMs)
        this.status.sourcesStatus[source.id] = {
          lastPolled: new Date().toISOString(),
          itemCount: items.length,
          error: null
        }

        // Process records
        for (const record of items) {
          if (!record._id || !record.videoUrl) {
            // Ignore records without videoUrl
            continue
          }

          const key = `${source.name}:${record._id}`
          if (this.inFlightKeys.has(key)) {
            continue
          }

          const targetFileName = `${source.name}_${record._id}.mp4`
          const targetPath = path.join(this.videosFolder, targetFileName)

          let fileExistsOnDisk = false
          try {
            if (fs.existsSync(targetPath)) {
              const stat = fs.statSync(targetPath)
              if (stat.isFile() && stat.size > 0) {
                fileExistsOnDisk = true
              }
            }
          } catch {
            fileExistsOnDisk = false
          }

          if (this.manifest.hasDownloaded(key)) {
            if (fileExistsOnDisk) {
              continue
            }
            // File is missing or 0 bytes on disk: remove stale manifest entry and re-download
            this.manifest.removeDownloaded(key)
            this.logger.info(
              `[${source.name}] File missing on disk for record ${record._id}, will re-download`
            )
          }

          if (this.manifest.canAttempt(key)) {
            this.enqueueDownload({
              key,
              sourceName: source.name,
              id: record._id,
              videoUrl: record.videoUrl
            })
            newlyFoundCount++
          }
        }
      } catch (err: unknown) {
        anyError = true
        const msg = err instanceof Error ? err.message : String(err)
        lastErrMsg = `[${source.name}] ${msg}`
        this.status.sourcesStatus[source.id] = {
          lastPolled: new Date().toISOString(),
          itemCount: 0,
          error: msg
        }
        this.logger.warn(`Source poll failed for ${source.name}: ${msg}`)
      }
    }

    if (newlyFoundCount > 0) {
      if (this.batchTotal === 0 || this.batchCompleted >= this.batchTotal) {
        this.batchTotal = newlyFoundCount
        this.batchCompleted = 0
      } else {
        this.batchTotal += newlyFoundCount
      }
      this.logger.info(`Queued ${newlyFoundCount} new video(s) to download`)
    }

    this.isPolling = false

    if (!anyError) {
      this.status.lastSuccessfulFetchTime = new Date().toISOString()
      this.status.lastError = null
    } else {
      this.status.lastError = lastErrMsg
    }

    // Schedule next poll countdown if still running
    if (this.isRunning) {
      this.scheduleNextFetchTimer()
    } else {
      this.nextPollTimestamp = null
      this.status.state = this.activeDownloadsCount > 0 ? 'downloading' : 'idle'
      this.emitStatus()
    }
  }

  private scheduleNextFetchTimer(): void {
    const totalSec = Math.max(3, this.settings.pollIntervalSec)
    this.nextPollTimestamp = Date.now() + totalSec * 1000
    this.status.secondsUntilNextFetch = totalSec
    this.status.nextPollProgress = 0
    this.emitStatus()
  }

  private async fetchSourceRecords(url: string, timeoutMs: number): Promise<ApiRecord[]> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SirasaVideoMarqueeSync/1.0'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const json = await response.json()
      if (!Array.isArray(json)) {
        throw new Error('API response is not an array')
      }

      return json as ApiRecord[]
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  private enqueueDownload(task: DownloadTask): void {
    if (this.inFlightKeys.has(task.key)) {
      return
    }

    this.inFlightKeys.add(task.key)
    this.downloadQueue.push(task)
    this.processQueue()
  }

  private processQueue(): void {
    if (this.isDestroyed) {
      return
    }

    while (this.activeDownloadsCount < MAX_CONCURRENT_DOWNLOADS && this.downloadQueue.length > 0) {
      const task = this.downloadQueue.shift()
      if (!task) break

      this.activeDownloadsCount++
      this.emitStatus()

      this.executeDownload(task)
        .catch((err) => {
          this.logger.error(`Unhandled error downloading ${task.id}`, err)
        })
        .finally(() => {
          this.activeDownloadsCount--
          this.batchCompleted++
          this.inFlightKeys.delete(task.key)

          if (this.downloadQueue.length === 0 && this.activeDownloadsCount === 0) {
            this.batchTotal = 0
            this.batchCompleted = 0
          }

          this.emitStatus()
          this.processQueue()
        })
    }
  }

  private async executeDownload(task: DownloadTask): Promise<void> {
    const { key, sourceName, id, videoUrl } = task
    const tempFileName = `${sourceName}_${id}_${Date.now()}.part`
    const tempFilePath = path.join(this.tempDir, tempFileName)
    const targetFileName = `${sourceName}_${id}.mp4`
    const targetFilePath = path.join(this.videosFolder, targetFileName)

    this.ensureTempDir()

    try {
      this.logger.info(`[${sourceName}] Downloading video for record ${id}...`)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90000)

      const response = await fetch(videoUrl, {
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }

      const contentLengthHeader = response.headers.get('content-length')
      const expectedBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : -1

      if (!response.body) {
        throw new Error('Response body is empty')
      }

      const fileStream = fs.createWriteStream(tempFilePath)
      let bytesWritten = 0

      // @ts-ignore - ReadableStream reader support
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fileStream.write(Buffer.from(value))
        bytesWritten += value.length
      }

      await new Promise<void>((resolve, reject) => {
        fileStream.end((err?: Error | null) => (err ? reject(err) : resolve()))
      })

      if (bytesWritten === 0) {
        throw new Error('Downloaded file is 0 bytes')
      }

      if (expectedBytes > 0 && bytesWritten !== expectedBytes) {
        throw new Error(
          `Byte count mismatch: expected ${expectedBytes} bytes, received ${bytesWritten} bytes`
        )
      }

      // Atomic rename/move into target folder
      try {
        fs.renameSync(tempFilePath, targetFilePath)
      } catch (renameErr: unknown) {
        const code = (renameErr as { code?: string })?.code
        if (code === 'EXDEV') {
          fs.copyFileSync(tempFilePath, targetFilePath)
          fs.unlinkSync(tempFilePath)
        } else {
          throw renameErr
        }
      }

      this.manifest.markDownloaded(key, sourceName, id, targetFileName, bytesWritten)

      this.logger.info(
        `[${sourceName}] Record ${id} saved as ${targetFileName} (${(bytesWritten / (1024 * 1024)).toFixed(2)} MB)`
      )
    } catch (err: unknown) {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath)
        }
      } catch {
        // ignore cleanup error
      }

      const errMsg = err instanceof Error ? err.message : String(err)
      this.manifest.recordFailure(key, errMsg)
      this.logger.error(`[${sourceName}] Download failed for record ${id}: ${errMsg}`)

      this.updateStatus({
        lastError: `[${sourceName}] Download failed: ${errMsg}`
      })
    }
  }

  private updateStatus(partial: Partial<BackendSyncStatus>): void {
    this.status = {
      ...this.status,
      ...partial
    }
    this.emitStatus()
  }

  private emitStatus(): void {
    this.emit('status', this.getStatus())
  }
}
