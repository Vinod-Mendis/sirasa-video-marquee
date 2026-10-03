import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'
import { watch, FSWatcher } from 'chokidar'
import { IVideoSource } from './IVideoSource'
import { VideoItem } from '@shared/types'
import { filePathToMediaUrl } from '../protocol'

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v'])

export function getSourceFromFileName(fileName: string): string {
  const match = fileName.match(/^([a-zA-Z0-9_-]+?)_[0-9a-fA-F]{10,}/)
  if (match) {
    return match[1]
  }
  const idx = fileName.indexOf('_')
  return idx > 0 ? fileName.slice(0, idx) : 'default'
}

export function interleaveVideosBySource(videos: VideoItem[]): VideoItem[] {
  if (videos.length <= 1) return [...videos]

  // Group by source name
  const sourceGroups = new Map<string, VideoItem[]>()
  for (const v of videos) {
    const src = getSourceFromFileName(v.fileName)
    let group = sourceGroups.get(src)
    if (!group) {
      group = []
      sourceGroups.set(src, group)
    }
    group.push(v)
  }

  if (sourceGroups.size <= 1) {
    return [...videos].sort((a, b) =>
      a.fileName.localeCompare(b.fileName, undefined, { numeric: true })
    )
  }

  // Sort each group (newest first by mtimeMs, then numeric filename)
  for (const group of sourceGroups.values()) {
    group.sort(
      (a, b) =>
        b.mtimeMs - a.mtimeMs || a.fileName.localeCompare(b.fileName, undefined, { numeric: true })
    )
  }

  // Interleave sources round-robin
  const queues = Array.from(sourceGroups.values()).map((g) => [...g])
  const result: VideoItem[] = []
  let queueIdx = 0

  while (result.length < videos.length) {
    let checked = 0
    while (checked < queues.length) {
      const q = queues[queueIdx % queues.length]
      queueIdx++
      checked++
      if (q.length > 0) {
        result.push(q.shift()!)
        break
      }
    }
  }

  return result
}

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
    return interleaveVideosBySource(Array.from(this.videosMap.values()))
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
    const targetNorm = path.resolve(filePath).toLowerCase()
    let foundId: string | null = null

    for (const id of this.videosMap.keys()) {
      if (path.resolve(id).toLowerCase() === targetNorm) {
        foundId = id
        break
      }
    }

    if (foundId) {
      const item = this.videosMap.get(foundId)
      this.videosMap.delete(foundId)
      console.log(`[LocalFolderSource] Video removed: ${item?.fileName || path.basename(filePath)}`)
      this.emit('remove', foundId)
      this.emitChange()
    } else {
      console.warn(`[LocalFolderSource] Unlink event for untracked file: ${filePath}`)
    }
  }

  private emitChange(): void {
    this.emit('change', this.getVideos())
  }
}
