import React from 'react'
import { WallCanvas } from '../../wall/WallCanvas'
import { useApp } from '../../context/AppContext'

export const LivePreviewCard: React.FC = () => {
  const { settings } = useApp()

  return (
    <div className="card preview-card">
      <div className="card-header">
        <div className="card-title">
          <span className="card-icon">👁️</span>
          <span>Operator Live Wall Monitor (Realtime Preview)</span>
        </div>
        <div className="preview-meta">
          <span>
            Canvas: {settings.designCanvas.width}×{settings.designCanvas.height} px
          </span>
          <span className="live-dot" />
          <span style={{ color: '#00ff88', fontWeight: 600 }}>LIVE</span>
        </div>
      </div>

      <div className="preview-container">
        <div className="preview-viewport">
          <WallCanvas isPreview={true} />
        </div>
      </div>
    </div>
  )
}
