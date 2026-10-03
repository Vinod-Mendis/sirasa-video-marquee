import React from 'react'
import { useApp } from '../../context/AppContext'

const ASPECT_PRESETS = [
  { label: '16:9 Landscape', value: 16 / 9 },
  { label: '4:3 Standard', value: 4 / 3 },
  { label: '1:1 Square', value: 1 },
  { label: '9:16 Portrait', value: 9 / 16 }
]

export const MarqueeSettingsCard: React.FC = () => {
  const { settings, updateSettings } = useApp()
  const { speed, tileHeightRatio, tileAspectRatio, gap, maxPlayingVideos } = settings

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="card-icon">🎞️</span>
          <span>Marquee Motion & Tile Rescaling</span>
        </div>
      </div>

      <div className="card-body">
        {/* Speed Control */}
        <div className="field-group">
          <div className="field-label-row">
            <label className="field-label">
              <span>Scroll Speed (Pixels / Second)</span>
              <span className="field-tip">Changes apply live without any jump or glitch</span>
            </label>
            <span className="field-value-badge">{speed} px/s</span>
          </div>
          <div className="slider-row">
            <input
              type="range"
              min={20}
              max={1000}
              step={5}
              value={speed}
              onChange={(e) => updateSettings({ speed: parseInt(e.target.value, 10) })}
              className="form-range"
            />
            <input
              type="number"
              min={10}
              max={2000}
              step={10}
              value={speed}
              onChange={(e) => updateSettings({ speed: parseInt(e.target.value, 10) || 100 })}
              className="form-input form-input-sm"
              style={{ width: 90 }}
            />
          </div>
        </div>

        {/* Tile Height Ratio */}
        <div className="field-group">
          <div className="field-label-row">
            <label className="field-label">
              <span>Tile Height Ratio</span>
              <span className="field-tip">
                Tile Height = Marquee Height × Ratio (
                {Math.round(settings.marqueeRect.height * tileHeightRatio)}px)
              </span>
            </label>
            <span className="field-value-badge">{(tileHeightRatio * 100).toFixed(0)}%</span>
          </div>
          <div className="slider-row">
            <input
              type="range"
              min={0.3}
              max={1.5}
              step={0.05}
              value={tileHeightRatio}
              onChange={(e) => updateSettings({ tileHeightRatio: parseFloat(e.target.value) })}
              className="form-range"
            />
          </div>
        </div>

        {/* Tile Aspect Ratio */}
        <div className="field-group">
          <label className="field-label">
            <span>Tile Aspect Ratio (Width : Height)</span>
            <span className="field-tip">Video renders with object-fit: cover</span>
          </label>
          <div className="aspect-ratio-presets">
            {ASPECT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`btn-preset ${Math.abs(tileAspectRatio - preset.value) < 0.01 ? 'active' : ''}`}
                onClick={() => updateSettings({ tileAspectRatio: preset.value })}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tile Gap */}
        <div className="field-group">
          <div className="field-label-row">
            <label className="field-label">Gap Between Tiles</label>
            <span className="field-value-badge">{gap} px</span>
          </div>
          <div className="slider-row">
            <input
              type="range"
              min={0}
              max={200}
              step={2}
              value={gap}
              onChange={(e) => updateSettings({ gap: parseInt(e.target.value, 10) })}
              className="form-range"
            />
          </div>
        </div>

        {/* Max Playing Videos */}
        <div className="field-group">
          <div className="field-label-row">
            <label className="field-label">
              <span>Max Simultaneous Playing Videos</span>
              <span className="field-tip">
                Only active tiles play; distant tiles are paused to conserve GPU/CPU
              </span>
            </label>
            <span className="field-value-badge">{maxPlayingVideos} videos</span>
          </div>
          <div className="slider-row">
            <input
              type="range"
              min={1}
              max={24}
              step={1}
              value={maxPlayingVideos}
              onChange={(e) => updateSettings({ maxPlayingVideos: parseInt(e.target.value, 10) })}
              className="form-range"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
