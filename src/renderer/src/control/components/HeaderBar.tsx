import React from 'react'
import { useApp } from '../../context/AppContext'

export const HeaderBar: React.FC = () => {
  const { settings, updateSettings, toggleWallFullscreen, reopenWallWindow } = useApp()

  const handleCalibrationToggle = (): void => {
    updateSettings({ calibrationMode: !settings.calibrationMode })
  }

  const isFullscreen = settings.wallWindowMode === 'fullscreen'

  return (
    <header className="control-header">
      <div className="header-left">
        <div className="brand-logo">
          <span className="brand-dot" />
          <span className="brand-name">SIRASA</span>
          <span className="brand-sub">VIDEO MARQUEE CONTROLLER</span>
        </div>
      </div>

      <div className="header-actions">
        <button
          type="button"
          className={`btn ${settings.calibrationMode ? 'btn-calibration-active' : 'btn-calibration'}`}
          onClick={handleCalibrationToggle}
          title="Toggle Calibration Grid and HUD overlay (Arrow keys enabled)"
        >
          <span className="icon">🎯</span>
          {settings.calibrationMode ? 'Calibration ACTIVE' : 'Calibration Mode'}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={toggleWallFullscreen}
          title="Toggle Wall Window between Fullscreen and Windowed mode"
        >
          <span className="icon">{isFullscreen ? '🗗' : '🗖'}</span>
          {isFullscreen ? 'Windowed Wall' : 'Fullscreen Wall'}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={reopenWallWindow}
          title="Re-open Wall Window if closed"
        >
          <span className="icon">🖥️</span>
          Wall Window
        </button>
      </div>
    </header>
  )
}
