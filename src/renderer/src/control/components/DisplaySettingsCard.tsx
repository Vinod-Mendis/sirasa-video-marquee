import React from 'react'
import { useApp } from '../../context/AppContext'

export const DisplaySettingsCard: React.FC = () => {
  const { settings, displays, updateSettings, resetSettings, refreshDisplays } = useApp()

  const handleDisplayChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const val = e.target.value
    updateSettings({
      displayId: val === 'primary' ? null : parseInt(val, 10)
    })
  }

  const handleReset = (): void => {
    if (window.confirm('Reset all layout, marquee, and display settings to defaults?')) {
      resetSettings()
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="card-icon">🖥️</span>
          <span>Target Display & Kiosk</span>
        </div>
        <div className="card-actions">
          <button type="button" className="btn btn-xs" onClick={refreshDisplays}>
            Refresh Displays
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Display Selector */}
        <div className="field-group">
          <label className="field-label">
            <span>Wall Display Output</span>
            <span className="field-tip">
              Choose which connected screen renders the borderless wall
            </span>
          </label>
          <select
            value={settings.displayId != null ? String(settings.displayId) : 'primary'}
            onChange={handleDisplayChange}
            className="form-select"
          >
            <option value="primary">Primary Display (Auto)</option>
            {displays.map((disp) => (
              <option key={disp.id} value={disp.id}>
                {disp.label} [{disp.bounds.width}×{disp.bounds.height}]{' '}
                {disp.isPrimary ? '(Primary)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Window Presentation Mode */}
        <div className="field-group">
          <label className="field-label">
            <span>Wall Window Presentation Mode</span>
            <span className="field-tip">
              Use &quot;Windowed&quot; during development or on single-monitor setups; use
              &quot;Borderless Fullscreen&quot; on the event LED wall.
            </span>
          </label>
          <div className="mode-toggle-group">
            <button
              type="button"
              className={`mode-btn ${settings.wallWindowMode === 'fullscreen' ? 'active' : ''}`}
              onClick={() => updateSettings({ wallWindowMode: 'fullscreen' })}
            >
              <b>Borderless Fullscreen (Production Kiosk)</b>
              <span>Locks to display edges, cursor hidden, prevents sleep</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${settings.wallWindowMode === 'windowed' ? 'active' : ''}`}
              onClick={() => updateSettings({ wallWindowMode: 'windowed' })}
            >
              <b>Windowed Mode (Operator / Dev Preview)</b>
              <span>Visible window on screen for testing</span>
            </button>
          </div>
        </div>

        {/* Reset settings */}
        <div className="danger-zone">
          <span>Reset Configuration</span>
          <button type="button" className="btn btn-danger-outline" onClick={handleReset}>
            Reset to Default Settings
          </button>
        </div>
      </div>
    </div>
  )
}
