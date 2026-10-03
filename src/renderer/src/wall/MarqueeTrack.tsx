import React, { useEffect, useRef, useMemo } from 'react'
import { MarqueeRectConfig, VideoItem } from '@shared/types'

interface MarqueeTrackProps {
  videos: VideoItem[]
  marqueeRect: MarqueeRectConfig
  speed: number
  tileHeightRatio: number
  tileAspectRatio: number
  gap: number
  edgeFade: number
  maxPlayingVideos: number
}

interface TileData {
  slotId: string
  x: number
  videoUrl: string
  videoFileName: string
  isPlaying: boolean
  domEl: HTMLDivElement | null
  videoEl: HTMLVideoElement | null
}

export const MarqueeTrack: React.FC<MarqueeTrackProps> = ({
  videos,
  marqueeRect,
  speed,
  tileHeightRatio,
  tileAspectRatio,
  gap,
  edgeFade,
  maxPlayingVideos
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)

  // Stable references for rAF loop
  const speedRef = useRef(speed)
  const marqueeRectRef = useRef(marqueeRect)
  const tileHeightRatioRef = useRef(tileHeightRatio)
  const tileAspectRatioRef = useRef(tileAspectRatio)
  const gapRef = useRef(gap)
  const maxPlayingVideosRef = useRef(maxPlayingVideos)
  const videosRef = useRef(videos)

  // Update refs in an effect to satisfy React 19 / eslint rules
  useEffect(() => {
    speedRef.current = speed
    marqueeRectRef.current = marqueeRect
    tileHeightRatioRef.current = tileHeightRatio
    tileAspectRatioRef.current = tileAspectRatio
    gapRef.current = gap
    maxPlayingVideosRef.current = maxPlayingVideos
    videosRef.current = videos
  }, [speed, marqueeRect, tileHeightRatio, tileAspectRatio, gap, maxPlayingVideos, videos])

  // Dimensions
  const tileHeight = Math.max(20, marqueeRect.height * tileHeightRatio)
  const tileWidth = Math.max(20, tileHeight * tileAspectRatio)
  const slotWidth = tileWidth + gap
  const topOffset = Math.max(0, (marqueeRect.height - tileHeight) / 2)

  // Calculate needed slot count to fill width + buffer
  const neededSlotsCount = useMemo(() => {
    if (videos.length === 0) return 0
    const visibleCount = Math.ceil(marqueeRect.width / Math.max(slotWidth, 50))
    // Keep at least 4 buffer tiles beyond visible width
    return Math.max(visibleCount + 4, 6)
  }, [videos.length, marqueeRect.width, slotWidth])

  // Stable slot descriptors derived directly from neededSlotsCount
  const slotDescriptors = useMemo(() => {
    if (neededSlotsCount === 0) return []
    const newSlots: string[] = []
    for (let i = 0; i < neededSlotsCount; i++) {
      newSlots.push(`slot-${i}`)
    }
    return newSlots
  }, [neededSlotsCount])

  // Mutable tile data pool accessed by rAF
  const tilesRef = useRef<TileData[]>([])
  const trackOffsetRef = useRef<number>(0)
  const playlistIndexRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)

  // Handle initialization or updates to tilesRef when slots or videos change
  useEffect(() => {
    if (slotDescriptors.length === 0 || videos.length === 0) {
      tilesRef.current = []
      return
    }

    const currentTiles = tilesRef.current
    const newTiles: TileData[] = []

    slotDescriptors.forEach((slotId, index) => {
      const existing = currentTiles.find((t) => t.slotId === slotId)
      if (existing) {
        newTiles.push(existing)
      } else {
        const video = videos[playlistIndexRef.current % videos.length]
        playlistIndexRef.current++
        newTiles.push({
          slotId,
          x: index * slotWidth,
          videoUrl: video.url,
          videoFileName: video.fileName,
          isPlaying: false,
          domEl: null,
          videoEl: null
        })
      }
    })

    tilesRef.current = newTiles

    // Update positions and sizes on DOM elements without jump
    newTiles.forEach((tile) => {
      if (tile.domEl) {
        tile.domEl.style.transform = `translate3d(${tile.x}px, 0, 0)`
        tile.domEl.style.width = `${tileWidth}px`
        tile.domEl.style.height = `${tileHeight}px`
        tile.domEl.style.top = `${topOffset}px`
      }
    })
  }, [slotDescriptors, videos, slotWidth, tileWidth, tileHeight, topOffset])

  // Smoothly adjust tile dimensions and spacing when height/ratio/gap changes live
  useEffect(() => {
    const tiles = tilesRef.current
    if (tiles.length === 0) return

    // Find the tile closest to visible center to anchor around (zero jump)
    const currentOffset = trackOffsetRef.current
    const centerTarget = marqueeRect.width / 2

    let anchorIndex = 0
    let minDiff = Infinity

    tiles.forEach((t, i) => {
      const screenX = t.x + currentOffset + tileWidth / 2
      const diff = Math.abs(screenX - centerTarget)
      if (diff < minDiff) {
        minDiff = diff
        anchorIndex = i
      }
    })

    const anchorTile = tiles[anchorIndex]
    const anchorX = anchorTile.x

    tiles.forEach((t, i) => {
      t.x = anchorX + (i - anchorIndex) * slotWidth
      if (t.domEl) {
        t.domEl.style.transform = `translate3d(${t.x}px, 0, 0)`
        t.domEl.style.width = `${tileWidth}px`
        t.domEl.style.height = `${tileHeight}px`
        t.domEl.style.top = `${topOffset}px`
      }
    })
  }, [tileHeight, tileWidth, slotWidth, topOffset, marqueeRect.width])

  // When videos list changes (e.g. video added or removed live)
  useEffect(() => {
    if (videos.length === 0) return

    const tiles = tilesRef.current
    const currentOffset = trackOffsetRef.current
    const visibleWidth = marqueeRectRef.current.width

    // Check tiles outside the visible area on the right edge
    // Any tile currently off-screen to the right can be updated to newly added videos
    tiles.forEach((tile) => {
      const screenX = tile.x + currentOffset
      // If offscreen to the right, verify its video is valid or update
      if (screenX > visibleWidth) {
        const isValid = videos.some((v) => v.url === tile.videoUrl)
        if (!isValid) {
          const nextVideo = videos[playlistIndexRef.current % videos.length]
          playlistIndexRef.current++
          tile.videoUrl = nextVideo.url
          tile.videoFileName = nextVideo.fileName
          if (tile.videoEl && tile.videoEl.src !== nextVideo.url) {
            tile.videoEl.src = nextVideo.url
            tile.videoEl.load()
          }
        }
      }
    })
  }, [videos])

  // Main animation and wrapping loop
  useEffect(() => {
    lastTimeRef.current = performance.now()

    const animate = (now: number): void => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1) // clamp delta time
      lastTimeRef.current = now

      const currentSpeed = speedRef.current
      const currentMarquee = marqueeRectRef.current
      const currentVideos = videosRef.current
      const currentMaxPlaying = maxPlayingVideosRef.current

      const curTileHeight = Math.max(20, currentMarquee.height * tileHeightRatioRef.current)
      const curTileWidth = Math.max(20, curTileHeight * tileAspectRatioRef.current)
      const curSlotWidth = curTileWidth + gapRef.current

      // Advance track offset
      trackOffsetRef.current -= currentSpeed * dt

      // Normalize track offset if scrolled very far to prevent float precision issues
      if (trackOffsetRef.current < -50000) {
        trackOffsetRef.current += 50000
        tilesRef.current.forEach((t) => {
          t.x -= 50000
          if (t.domEl) {
            t.domEl.style.transform = `translate3d(${t.x}px, 0, 0)`
          }
        })
      }

      const offset = trackOffsetRef.current

      // Apply transform to the track container
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${offset}px, 0, 0)`
      }

      const tiles = tilesRef.current
      if (tiles.length > 0 && currentVideos.length > 0) {
        // 1. Check tile wrapping for tiles that have fully exited the left edge
        // Tile is off-screen left when: tile.x + offset + curTileWidth < 0
        tiles.forEach((tile) => {
          const screenRight = tile.x + offset + curTileWidth
          if (screenRight < 0) {
            // Find current rightmost tile x
            let maxX = -Infinity
            for (let i = 0; i < tiles.length; i++) {
              if (tiles[i].x > maxX) {
                maxX = tiles[i].x
              }
            }

            // Wrap tile to the right edge
            tile.x = maxX + curSlotWidth
            if (tile.domEl) {
              tile.domEl.style.transform = `translate3d(${tile.x}px, 0, 0)`
            }

            // Assign next video from playlist
            const nextVideo = currentVideos[playlistIndexRef.current % currentVideos.length]
            playlistIndexRef.current++

            if (tile.videoUrl !== nextVideo.url) {
              tile.videoUrl = nextVideo.url
              tile.videoFileName = nextVideo.fileName
              if (tile.videoEl) {
                tile.videoEl.src = nextVideo.url
                tile.videoEl.load()
              }
            }
          }
        })

        // 2. Playback management:
        // Only play tiles in or near the visible rectangle; pause the rest.
        // Cap simultaneous playing videos at currentMaxPlaying.
        const buffer = curTileWidth * 0.75
        const nearTiles: { tile: TileData; distToCenter: number }[] = []

        tiles.forEach((tile) => {
          const screenLeft = tile.x + offset
          const screenRight = screenLeft + curTileWidth

          const isNear = screenRight >= -buffer && screenLeft <= currentMarquee.width + buffer
          if (isNear) {
            const center = screenLeft + curTileWidth / 2
            const dist = Math.abs(center - currentMarquee.width / 2)
            nearTiles.push({ tile, distToCenter: dist })
          } else {
            // Tile is far outside - pause it
            if (tile.isPlaying && tile.videoEl) {
              tile.isPlaying = false
              tile.videoEl.pause()
            }
          }
        })

        // Sort near tiles by distance to center
        nearTiles.sort((a, b) => a.distToCenter - b.distToCenter)

        // The top `currentMaxPlaying` near tiles play; the rest pause
        nearTiles.forEach(({ tile }, index) => {
          const shouldPlay = index < currentMaxPlaying
          if (shouldPlay && !tile.isPlaying && tile.videoEl) {
            tile.isPlaying = true
            const playPromise = tile.videoEl.play()
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(() => {
                // Ignore playback interruptions from rapid wrapping or pauses
              })
            }
          } else if (!shouldPlay && tile.isPlaying && tile.videoEl) {
            tile.isPlaying = false
            tile.videoEl.pause()
          }
        })
      }

      rafIdRef.current = requestAnimationFrame(animate)
    }

    rafIdRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  // Soft edge fade mask
  const maskStyle: React.CSSProperties =
    edgeFade > 0
      ? {
          WebkitMaskImage: `linear-gradient(to right, transparent 0px, black ${edgeFade}px, black calc(100% - ${edgeFade}px), transparent 100%)`,
          maskImage: `linear-gradient(to right, transparent 0px, black ${edgeFade}px, black calc(100% - ${edgeFade}px), transparent 100%)`
        }
      : {}

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: marqueeRect.width,
        height: marqueeRect.height,
        overflow: 'hidden',
        ...maskStyle
      }}
    >
      <div
        ref={trackRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: '100000px', // long track
          willChange: 'transform'
        }}
      >
        {slotDescriptors.map((slotId) => (
          <div
            key={slotId}
            ref={(el) => {
              const tile = tilesRef.current.find((t) => t.slotId === slotId)
              if (tile) {
                tile.domEl = el
                if (el) {
                  el.style.transform = `translate3d(${tile.x}px, 0, 0)`
                  el.style.width = `${tileWidth}px`
                  el.style.height = `${tileHeight}px`
                  el.style.top = `${topOffset}px`
                }
              }
            }}
            style={{
              position: 'absolute',
              width: tileWidth,
              height: tileHeight,
              top: topOffset,
              backgroundColor: '#0a0a0e',
              borderRadius: 6,
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              transform: 'translate3d(0, 0, 0)'
            }}
          >
            <video
              ref={(el) => {
                const tile = tilesRef.current.find((t) => t.slotId === slotId)
                if (tile) {
                  tile.videoEl = el
                  if (el && !el.src && tile.videoUrl) {
                    el.src = tile.videoUrl
                  }
                }
              }}
              muted
              loop
              playsInline
              preload="auto"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
