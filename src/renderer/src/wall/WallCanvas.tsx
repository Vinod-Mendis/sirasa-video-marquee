import React, { useEffect, useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { MarqueeTrack } from './MarqueeTrack'
import { CalibrationOverlay } from './CalibrationOverlay'

interface WallCanvasProps {
  isPreview?: boolean
}

export const WallCanvas: React.FC<WallCanvasProps> = ({ isPreview = false }) => {
  const { settings, videos } = useApp()
  const { designCanvas, marqueeRect } = settings

  // Window viewport tracking for scaling
  const [containerSize, setContainerSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

  useEffect(() => {
    const handleResize = (): void => {
      setContainerSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate scale factor to fit design canvas inside container
  const scale = useMemo(() => {
    if (designCanvas.width <= 0 || designCanvas.height <= 0) return 1
    const scaleX = containerSize.width / designCanvas.width
    const scaleY = containerSize.height / designCanvas.height
    return Math.min(scaleX, scaleY)
  }, [containerSize, designCanvas])

  const bgUrl = settings.backgroundImagePath
    ? `media://file?path=${encodeURIComponent(settings.backgroundImagePath)}`
    : ''

  // Left ad width and right ad width based on marquee position
  const leftAdWidth = Math.max(0, marqueeRect.x)
  const rightAdLeft = marqueeRect.x + marqueeRect.width
  const rightAdWidth = Math.max(0, designCanvas.width - rightAdLeft)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        cursor: isPreview ? 'default' : 'none',
        userSelect: 'none'
      }}
    >
      {/* Design Canvas Scaled Root */}
      <div
        style={{
          width: designCanvas.width,
          height: designCanvas.height,
          position: 'relative',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          flexShrink: 0,
          backgroundColor: '#0d0e12',
          overflow: 'hidden'
        }}
      >
        {/* Layer 1: Background Image or Ad Placeholders */}
        {bgUrl ? (
          <img
            src={bgUrl}
            alt="Wall Background"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              pointerEvents: 'none'
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              background: 'linear-gradient(90deg, #10121a 0%, #161a26 50%, #10121a 100%)'
            }}
          >
            {/* Left Ad Placeholder */}
            {leftAdWidth > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: leftAdWidth,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #1b2030, #131722)',
                  borderRight: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: 2
                }}
              >
                LEFT AD ZONE ({leftAdWidth}px)
              </div>
            )}

            {/* Right Ad Placeholder */}
            {rightAdWidth > 0 && (
              <div
                style={{
                  position: 'absolute',
                  left: rightAdLeft,
                  top: 0,
                  width: rightAdWidth,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(225deg, #1b2030, #131722)',
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: 2
                }}
              >
                RIGHT AD ZONE ({rightAdWidth}px)
              </div>
            )}
          </div>
        )}

        {/* Layer 2: Marquee Rectangle */}
        <div
          style={{
            position: 'absolute',
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.width,
            height: marqueeRect.height,
            overflow: 'hidden'
          }}
        >
          <MarqueeTrack
            videos={videos}
            marqueeRect={marqueeRect}
            speed={settings.speed}
            tileHeightRatio={settings.tileHeightRatio}
            tileAspectRatio={settings.tileAspectRatio}
            gap={settings.gap}
            edgeFade={settings.edgeFade}
            maxPlayingVideos={settings.maxPlayingVideos}
          />
        </div>

        {/* Layer 3: Calibration Overlay (when toggled on) */}
        {settings.calibrationMode && (
          <CalibrationOverlay marqueeRect={marqueeRect} designCanvas={designCanvas} />
        )}
      </div>
    </div>
  )
}
