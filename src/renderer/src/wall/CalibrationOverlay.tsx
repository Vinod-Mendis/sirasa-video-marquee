import React from 'react'
import { DesignCanvasConfig, MarqueeRectConfig } from '@shared/types'

interface CalibrationOverlayProps {
  marqueeRect: MarqueeRectConfig
  designCanvas: DesignCanvasConfig
}

export const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({
  marqueeRect,
  designCanvas
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: marqueeRect.x,
        top: marqueeRect.y,
        width: marqueeRect.width,
        height: marqueeRect.height,
        boxSizing: 'border-box',
        border: '3px dashed #00ff88',
        boxShadow: '0 0 25px rgba(0, 255, 136, 0.6), inset 0 0 25px rgba(0, 255, 136, 0.2)',
        pointerEvents: 'none',
        zIndex: 100
      }}
    >
      {/* Corner crosshairs */}
      <div
        style={{
          position: 'absolute',
          top: -8,
          left: -8,
          width: 16,
          height: 16,
          backgroundColor: '#00ff88',
          borderRadius: 2
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: -8,
          right: -8,
          width: 16,
          height: 16,
          backgroundColor: '#00ff88',
          borderRadius: 2
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -8,
          left: -8,
          width: 16,
          height: 16,
          backgroundColor: '#00ff88',
          borderRadius: 2
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -8,
          right: -8,
          width: 16,
          height: 16,
          backgroundColor: '#00ff88',
          borderRadius: 2
        }}
      />

      {/* Floating HUD Badge */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 14,
          backgroundColor: 'rgba(0, 0, 0, 0.88)',
          border: '1px solid #00ff88',
          borderRadius: 6,
          padding: '6px 14px',
          color: '#ffffff',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 0.5,
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.7)'
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: '#00ff88'
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#00ff88',
              boxShadow: '0 0 8px #00ff88'
            }}
          />
          CALIBRATION
        </span>
        <span>
          X: <b style={{ color: '#00ff88' }}>{marqueeRect.x}px</b>
        </span>
        <span>
          Y: <b style={{ color: '#00ff88' }}>{marqueeRect.y}px</b>
        </span>
        <span>
          W: <b style={{ color: '#00ff88' }}>{marqueeRect.width}px</b>
        </span>
        <span>
          H: <b style={{ color: '#00ff88' }}>{marqueeRect.height}px</b>
        </span>
        <span style={{ color: '#888' }}>
          Canvas: {designCanvas.width}×{designCanvas.height}px
        </span>
      </div>
    </div>
  )
}
