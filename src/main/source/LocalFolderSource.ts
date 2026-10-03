import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { watch, FSWatcher } from 'chokidar'
import { IVideoSource } from './IVideoSource'
import { VideoItem } from '@shared/types'
import { filePathToMediaUrl } from '../protocol'

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v'])

export class LocalFolderSource extends EventEmitter implements IVideoSource {
  private folderPath: string
  private watcher: FSWatcher | null = null
  private videosMap: Map<string, VideoItem> = new Map()
  private pendingFiles: Map<string, { size: number; lastChecked: number; timer?: NodeJS.Timeout }> =
    new Map()
  private isScanning = false

  constructor(folderPath: string = '') {
    super()
    this.folderPath = folderPath
  }

  public async start(): Promise<void> {
    if (!this.folderPath) {
      console.log('[LocalFolderSource] No folder path set yet.')
      return
    }
    await this.setupWatcher()
  }

  public async stop(): Promise<void> {
    this.clearPending()
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.videosMap.clear()
    this.emitChange()
  }

  public async setFolder(newPath: string): Promise<void> {
    if (this.folderPath === newPath && this.watcher) {
      return
    }
    this.folderPath = newPath
    await this.stop()
    if (newPath) {
      await this.setupWatcher()
    }
  }

  public getVideos(): VideoItem[] {
    return Array.from(this.videosMap.values()).sort((a, b) =>
      a.fileName.localeCompare(b.fileName, undefined, { numeric: true })
    )
  }

  private isSupportedFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return SUPPORTED_EXTENSIONS.has(ext)
  }

  private clearPending(): void {
    for (const pending of this.pendingFiles.values()) {
      if (pending.timer) {
        clearTimeout(pending.timer)
      }
    }
    this.pendingFiles.clear()
  }

  private async setupWatcher(): Promise<void> {
    if (!this.folderPath) return

    if (!fs.existsSync(this.folderPath)) {
      console.warn(`[LocalFolderSource] Folder does not exist: ${this.folderPath}`)
      this.emitChange()
      return
    }

    this.isScanning = true
    try {
      this.watcher = watch(this.folderPath, {
        ignored: [/(^|[/\\])\../, /\.tmp$/i, /\.crdownload$/i], // ignore dotfiles and temp downloads
        persistent: true,
        depth: 0, // only top-level video files in the watched folder
        ignoreInitial: false,
        awaitWriteFinish: {
          stabilityThreshold: 2000,
          pollInterval: 200
        }
      })

      this.watcher.on('add', (filePath: string) => {
        this.handleFileDetected(filePath)
      })

      this.watcher.on('change', (filePath: string) => {
        this.handleFileDetected(filePath)
      })

      this.watcher.on('unlink', (filePath: string) => {
        this.handleFileRemoved(filePath)
      })

      this.watcher.on('ready', () => {
        this.isScanning = false
        this.emitChange()
        console.log(
          `[LocalFolderSource] Initial scan complete. Found ${this.videosMap.size} videos in: ${this.folderPath}`
        )
      })

      this.watcher.on('error', (err: unknown) => {
        console.error('[LocalFolderSource] Watcher error:', err)
      })
    } catch (err) {
      console.error('[LocalFolderSource] Failed to start watcher:', err)
      this.isScanning = false
    }
  }

  /**
   * Additional check: ensure the file has a stable size for at least 2 seconds before announcing.
   * Chokidar's awaitWriteFinish already waits 2s, and we verify stat readability.
   */
  private handleFileDetected(filePath: string): void {
    if (!this.isSupportedFile(filePath)) {
      return
    }

    // Check file stats
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile() || stats.size === 0) {
        // File may still be locking/empty
        return
      }

      const id = path.resolve(filePath)
      const fileName = path.basename(filePath)
      const item: VideoItem = {
        id,
        fileName,
        filePath,
        url: filePathToMediaUrl(filePath),
        size: stats.size,
        mtimeMs: stats.mtimeMs
      }

      const isNew = !this.videosMap.has(id)
      this.videosMap.set(id, item)

      if (!this.isScanning) {
        if (isNew) {
          console.log(`[LocalFolderSource] New video ready: ${fileName}`)
          this.emit('add', item)
        }
        this.emitChange()
      }
    })
  }

  private handleFileRemoved(filePath: string): void {
    const id = path.resolve(filePath)
    if (this.videosMap.has(id)) {
      this.videosMap.delete(id)
      console.log(`[LocalFolderSource] Video removed: ${path.basename(filePath)}`)
      this.emit('remove', id)
      this.emitChange()
    }
  }

  private emitChange(): void {
    this.emit('change', this.getVideos())
  }
}
