import React from 'react'
import { useApp } from '../../context/AppContext'

export const LayoutSettingsCard: React.FC = () => {
  const { settings, updateSettings } = useApp()
  const { designCanvas, marqueeRect, edgeFade } = settings

  const handleCanvasChange = (key: 'width' | 'height', val: number): void => {
    updateSettings({
      designCanvas: {
        ...designCanvas,
        [key]: Math.max(100, val || 0)
      }
    })
  }

  const handleRectChange = (key: 'x' | 'y' | 'width' | 'height', val: number): void => {
    updateSettings({
      marqueeRect: {
        ...marqueeRect,
        [key]: Math.max(key === 'width' || key === 'height' ? 50 : 0, val || 0)
      }
    })
  }

  const handleCenterMarquee = (): void => {
    const x = Math.max(0, Math.round((designCanvas.width - marqueeRect.width) / 2))
    const y = Math.max(0, Math.round((designCanvas.height - marqueeRect.height) / 2))
    updateSettings({
      marqueeRect: {
        ...marqueeRect,
        x,
        y
      }
    })
  }

  const handleDefaultPreset = (): void => {
    updateSettings({
      designCanvas: { width: 7680, height: 240 },
      marqueeRect: { x: 1920, y: 0, width: 3840, height: 240 }
    })
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="card-icon">📐</span>
          <span>Canvas & Marquee Rectangle</span>
        </div>
        <div className="card-actions">
          <button type="button" className="btn btn-xs" onClick={handleCenterMarquee}>
            Center in Canvas
          </button>
          <button type="button" className="btn btn-xs" onClick={handleDefaultPreset}>
            Reset 7680×240 Preset
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Design Canvas Dimensions */}
        <div className="settings-subheading">Design Canvas (Coordinates Scale to Real Display)</div>
        <div className="grid-2-col">
          <div className="field-group">
            <label className="field-label">Canvas Width (px)</label>
            <input
              type="number"
              min={640}
              max={16384}
              step={10}
              value={designCanvas.width}
              onChange={(e) => handleCanvasChange('width', parseInt(e.target.value, 10))}
              className="form-input"
            />
          </div>
          <div className="field-group">
            <label className="field-label">Canvas Height (px)</label>
            <input
              type="number"
              min={60}
              max={4320}
              step={10}
              value={designCanvas.height}
              onChange={(e) => handleCanvasChange('height', parseInt(e.target.value, 10))}
              className="form-input"
            />
          </div>
        </div>

        {/* Marquee Rectangle Coordinates */}
        <div className="settings-subheading" style={{ marginTop: 14 }}>
          Marquee Window (Clipped Rectangle for Looping Videos)
        </div>
        <div className="grid-4-col">
          <div className="field-group">
            <label className="field-label">X Position (px)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={marqueeRect.x}
              onChange={(e) => handleRectChange('x', parseInt(e.target.value, 10))}
              className="form-input"
            />
          </div>
          <div className="field-group">
            <label className="field-label">Y Position (px)</label>
            <input
              type="number"
              min={0}
              step={1}
              value={marqueeRect.y}
              onChange={(e) => handleRectChange('y', parseInt(e.target.value, 10))}
              className="form-input"
            />
          </div>
          <div className="field-group">
            <label className="field-label">Width (px)</label>
            <input
              type="number"
              min={100}
              step={1}
              value={marqueeRect.width}
              onChange={(e) => handleRectChange('width', parseInt(e.target.value, 10))}
              className="form-input"
            />
          </div>
          <div className="field-group">
            <label className="field-label">Height (px)</label>
            <input
              type="number"
              min={50}
              step={1}
              value={marqueeRect.height}
              onChange={(e) => handleRectChange('height', parseInt(e.target.value, 10))}
              className="form-input"
            />
          </div>
        </div>

        {/* Soft Edge Fade */}
        <div className="field-group" style={{ marginTop: 14 }}>
          <div className="field-label-row">
            <label className="field-label">Soft Edge Fade (Left & Right)</label>
            <span className="field-value-badge">{edgeFade} px</span>
          </div>
          <div className="slider-row">
            <input
              type="range"
              min={0}
              max={300}
              step={5}
              value={edgeFade}
              onChange={(e) => updateSettings({ edgeFade: parseInt(e.target.value, 10) })}
              className="form-range"
            />
            <span className="slider-bounds">0px (Sharp) — 300px (Wide Blend)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
