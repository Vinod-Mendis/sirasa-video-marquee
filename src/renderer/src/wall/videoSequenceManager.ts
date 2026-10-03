import { VideoItem } from '@shared/types'

export function getSourceFromFileName(fileName: string): string {
  const match = fileName.match(/^([a-zA-Z0-9_-]+?)_[0-9a-fA-F]{10,}/)
  if (match) return match[1]
  const idx = fileName.indexOf('_')
  return idx > 0 ? fileName.slice(0, idx) : 'default'
}

export function shuffleArray<T>(items: T[]): T[] {
  const array = [...items]
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

export class VideoSequenceManager {
  private allVideos: VideoItem[] = []
  private visibleCount: number = 6
  private lastAssignedUrl: string | null = null
  private recentHistory: string[] = [] // URLs of recently assigned tiles
  private pendingNewVideos: VideoItem[] = []
  private sourcePools: Map<string, VideoItem[]> = new Map()
  private lastChosenSource: string | null = null

  constructor(videos: VideoItem[] = [], visibleCount: number = 6) {
    this.updateVideos(videos)
    this.visibleCount = Math.max(1, visibleCount)
  }

  public setVisibleCount(count: number): void {
    this.visibleCount = Math.max(1, count)
  }

  public getVideos(): VideoItem[] {
    return this.allVideos
  }

  public updateVideos(videos: VideoItem[]): { added: VideoItem[]; removedUrls: Set<string> } {
    const oldUrlMap = new Map(this.allVideos.map((v) => [v.url, v]))
    const newUrlMap = new Map(videos.map((v) => [v.url, v]))

    const added: VideoItem[] = []
    for (const v of videos) {
      if (!oldUrlMap.has(v.url)) {
        added.push(v)
      }
    }

    const removedUrls = new Set<string>()
    for (const v of this.allVideos) {
      if (!newUrlMap.has(v.url)) {
        removedUrls.add(v.url)
      }
    }

    this.allVideos = [...videos]

    // Queue added videos for immediate placement just beyond right edge
    if (added.length > 0) {
      this.pendingNewVideos.push(...added)
    }

    // Clean up pools and history of removed videos
    if (removedUrls.size > 0) {
      this.pendingNewVideos = this.pendingNewVideos.filter((v) => !removedUrls.has(v.url))
      this.recentHistory = this.recentHistory.filter((url) => !removedUrls.has(url))
      for (const [src, pool] of this.sourcePools.entries()) {
        this.sourcePools.set(
          src,
          pool.filter((v) => !removedUrls.has(v.url))
        )
      }
    }

    return { added, removedUrls }
  }

  public hasPendingNewVideos(): boolean {
    return this.pendingNewVideos.length > 0
  }

  public popPendingNewVideo(): VideoItem | null {
    if (this.pendingNewVideos.length === 0) return null

    // If next pending has same URL as last assigned, try to find another pending if available
    let chosenIdx = 0
    if (this.allVideos.length > 1 && this.pendingNewVideos[0].url === this.lastAssignedUrl) {
      for (let i = 1; i < this.pendingNewVideos.length; i++) {
        if (this.pendingNewVideos[i].url !== this.lastAssignedUrl) {
          chosenIdx = i
          break
        }
      }
    }

    const item = this.pendingNewVideos.splice(chosenIdx, 1)[0]
    this.recordAssigned(item)
    return item
  }

  public getNextVideo(): VideoItem | null {
    if (this.allVideos.length === 0) return null
    if (this.allVideos.length === 1) {
      const single = this.allVideos[0]
      this.recordAssigned(single)
      return single
    }

    // If there is a newly downloaded video waiting, prioritize it!
    if (this.pendingNewVideos.length > 0) {
      const nextNew = this.popPendingNewVideo()
      if (nextNew) return nextNew
    }

    // Group videos by source
    const sources = this.getGroupedSources()
    const chosenSource = this.selectNextSource(sources)
    const video = this.selectVideoFromSource(chosenSource, sources)

    if (video) {
      this.recordAssigned(video)
      return video
    }

    // Fallback: any video different from lastAssignedUrl
    const fallback = this.allVideos.find((v) => v.url !== this.lastAssignedUrl) || this.allVideos[0]
    this.recordAssigned(fallback)
    return fallback
  }

  private recordAssigned(video: VideoItem): void {
    this.lastAssignedUrl = video.url
    this.lastChosenSource = getSourceFromFileName(video.fileName)
    this.recentHistory.push(video.url)
    const windowSize = Math.max(2, this.visibleCount)
    if (this.recentHistory.length > windowSize * 2) {
      this.recentHistory.splice(0, this.recentHistory.length - windowSize * 2)
    }
  }

  private getGroupedSources(): Map<string, VideoItem[]> {
    const map = new Map<string, VideoItem[]>()
    for (const v of this.allVideos) {
      const src = getSourceFromFileName(v.fileName)
      let list = map.get(src)
      if (!list) {
        list = []
        map.set(src, list)
      }
      list.push(v)
    }
    return map
  }

  /**
   * Interleave sources (Requirement 2):
   * If both drawings and quick-drawings exist, alternate between them.
   */
  private selectNextSource(sources: Map<string, VideoItem[]>): string {
    const srcNames = Array.from(sources.keys())
    if (srcNames.length <= 1) {
      return srcNames[0] || 'default'
    }

    // Prefer alternating away from lastChosenSource
    const otherSources = srcNames.filter((s) => s !== this.lastChosenSource)
    if (otherSources.length > 0) {
      // If drawings and quick-drawings are both present, alternate between them
      if (this.lastChosenSource === 'drawings' && sources.has('quick-drawings')) {
        return 'quick-drawings'
      }
      if (this.lastChosenSource === 'quick-drawings' && sources.has('drawings')) {
        return 'drawings'
      }
      return otherSources[Math.floor(Math.random() * otherSources.length)]
    }

    return srcNames[0]
  }

  /**
   * Requirement 1:
   * Repeat in shuffled order.
   * Never appears next to itself.
   * Never twice within visible width if there are enough different videos.
   */
  private selectVideoFromSource(
    sourceName: string,
    allSources: Map<string, VideoItem[]>
  ): VideoItem | null {
    let sourceVideos = allSources.get(sourceName) || []
    if (sourceVideos.length === 0) {
      for (const [s, list] of allSources.entries()) {
        if (s !== sourceName && list.length > 0) {
          sourceName = s
          sourceVideos = list
          break
        }
      }
    }
    if (sourceVideos.length === 0) return null

    let pool = this.sourcePools.get(sourceName)
    if (!pool || pool.length === 0) {
      pool = shuffleArray(sourceVideos)
      // If pool[0] equals lastAssignedUrl and pool has > 1 items, swap to avoid adjacent repetition
      if (pool.length > 1 && pool[0].url === this.lastAssignedUrl) {
        const swapIdx = pool.findIndex((v) => v.url !== this.lastAssignedUrl)
        if (swapIdx > 0) {
          ;[pool[0], pool[swapIdx]] = [pool[swapIdx], pool[0]]
        }
      }
      this.sourcePools.set(sourceName, pool)
    }

    const windowUrls = new Set(this.recentHistory.slice(-(this.visibleCount - 1)))
    const enoughVideos = this.allVideos.length >= this.visibleCount

    // 1. If enough videos: pick candidate that is NOT in window and NOT lastAssignedUrl
    if (enoughVideos) {
      const idx = pool.findIndex((v) => v.url !== this.lastAssignedUrl && !windowUrls.has(v.url))
      if (idx !== -1) {
        return pool.splice(idx, 1)[0]
      }
      // If current source pool has none meeting window criteria, check other sources
      for (const [otherSrc, otherList] of allSources.entries()) {
        if (otherSrc === sourceName) continue
        const otherCandidate = otherList.find(
          (v) => v.url !== this.lastAssignedUrl && !windowUrls.has(v.url)
        )
        if (otherCandidate) {
          const otherPool = this.sourcePools.get(otherSrc)
          if (otherPool) {
            const pIdx = otherPool.indexOf(otherCandidate)
            if (pIdx !== -1) otherPool.splice(pIdx, 1)
          }
          return otherCandidate
        }
      }
    }

    // 2. If short playlist or no candidate found without window overlap:
    // Filter out lastAssignedUrl (NEVER appear next to itself)
    const validCandidates = pool.filter((v) => v.url !== this.lastAssignedUrl)
    if (validCandidates.length > 0) {
      // Pick the candidate that appeared least recently in recentHistory
      let bestItem = validCandidates[0]
      let oldestIdx = Infinity

      for (const cand of validCandidates) {
        const lastSeenIdx = this.recentHistory.lastIndexOf(cand.url)
        if (lastSeenIdx === -1) {
          bestItem = cand
          break
        }
        if (lastSeenIdx < oldestIdx) {
          oldestIdx = lastSeenIdx
          bestItem = cand
        }
      }

      const pIdx = pool.indexOf(bestItem)
      if (pIdx !== -1) {
        pool.splice(pIdx, 1)
      }
      return bestItem
    }

    // Fallback: If only 1 video in source and it equals lastAssignedUrl, try other sources
    for (const [otherSrc, otherList] of allSources.entries()) {
      if (otherSrc === sourceName) continue
      const otherValid = otherList.find((v) => v.url !== this.lastAssignedUrl)
      if (otherValid) {
        const otherPool = this.sourcePools.get(otherSrc)
        if (otherPool) {
          const pIdx = otherPool.indexOf(otherValid)
          if (pIdx !== -1) otherPool.splice(pIdx, 1)
        }
        return otherValid
      }
    }

    // Absolute fallback: pick first from pool
    return pool.shift() || sourceVideos[0]
  }
}
