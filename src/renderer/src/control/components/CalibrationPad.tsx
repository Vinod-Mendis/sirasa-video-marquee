import React from 'react'
import { useApp } from '../../context/AppContext'

export const CalibrationPad: React.FC = () => {
  const { settings, nudge, updateSettings } = useApp()
  const { marqueeRect } = settings

  if (!settings.calibrationMode) {
    return null
  }

  return (
    <div className="calibration-banner">
      <div className="calibration-info">
        <div className="calibration-title">
          <span className="live-dot" />
          <b>CALIBRATION MODE ACTIVE</b>
          <span className="cal-coords">
            X: <code>{marqueeRect.x}</code> | Y: <code>{marqueeRect.y}</code> | W:{' '}
            <code>{marqueeRect.width}</code> | H: <code>{marqueeRect.height}</code>
          </span>
        </div>
        <div className="calibration-shortcuts">
          <span>
            <b>Arrows</b>: Nudge Position (X/Y)
          </span>
          <span>
            <b>Alt + Arrows</b>: Nudge Size (W/H)
          </span>
          <span>
            <b>Shift</b>: 10px multiplier
          </span>
        </div>
      </div>

      <div className="calibration-buttons">
        <div className="cal-group">
          <span className="cal-label">Position (X/Y):</span>
          <button
            type="button"
            className="btn-nudge"
            onClick={() => nudge({ dx: -1 })}
            title="Left 1px"
          >
            ← -1
          </button>
          <button
            type="button"
            className="btn-nudge"
            onClick={() => nudge({ dx: 1 })}
            title="Right 1px"
          >
            +1 →
          </button>
          <button
            type="button"
            className="btn-nudge"
            onClick={() => nudge({ dy: -1 })}
            title="Up 1px"
          >
            ↑ -1
          </button>
          <button
            type="button"
            className="btn-nudge"
            onClick={() => nudge({ dy: 1 })}
            title="Down 1px"
          >
            +1 ↓
          </button>
          <button
            type="button"
            className="btn-nudge btn-nudge-lg"
            onClick={() => nudge({ dx: -10 })}
            title="Left 10px"
          >
            -10X
          </button>
          <button
            type="button"
            className="btn-nudge btn-nudge-lg"
            onClick={() => nudge({ dx: 10 })}
            title="Right 10px"
          >
            +10X
          </button>
        </div>

        <div className="cal-group">
          <span className="cal-label">Size (W/H):</span>
          <button
            type="button"
            className="btn-nudge"
            onClick={() => nudge({ dw: -1 })}
            title="Width -1px"
          >
            W -1
          </button>
          <button
            type="button"
            className="btn-nudge"
            onClick={() => nudge({ dw: 1 })}
            title="Width +1px"
          >
            W +1
          </button>
          <button
            type="button"
            className="btn-nudge"
            onClick={() => nudge({ dh: -1 })}
            title="Height -1px"
          >
            H -1
          </button>
          <button
            type="button"
            className="btn-nudge"
            onClick={() => nudge({ dh: 1 })}
            title="Height +1px"
          >
            H +1
          </button>
          <button
            type="button"
            className="btn-nudge btn-nudge-lg"
            onClick={() => nudge({ dw: -10 })}
            title="Width -10px"
          >
            -10W
          </button>
          <button
            type="button"
            className="btn-nudge btn-nudge-lg"
            onClick={() => nudge({ dw: 10 })}
            title="Width +10px"
          >
            +10W
          </button>
        </div>

        <button
          type="button"
          className="btn btn-close-cal"
          onClick={() => updateSettings({ calibrationMode: false })}
        >
          Exit Calibration
        </button>
      </div>
    </div>
  )
}
