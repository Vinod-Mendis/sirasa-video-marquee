import React, { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { HeaderBar } from './components/HeaderBar'
import { CalibrationPad } from './components/CalibrationPad'
import { LivePreviewCard } from './components/LivePreviewCard'
import { MediaSourceCard } from './components/MediaSourceCard'
import { BackendSyncCard } from './components/BackendSyncCard'
import { LayoutSettingsCard } from './components/LayoutSettingsCard'
import { MarqueeSettingsCard } from './components/MarqueeSettingsCard'
import { DisplaySettingsCard } from './components/DisplaySettingsCard'

export const ControlDashboard: React.FC = () => {
  const { settings, nudge, updateSettings } = useApp()

  // Calibration hotkeys listener (active only on the Control window)
  useEffect(() => {
    if (!settings.calibrationMode) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement
      const tagName = target?.tagName?.toLowerCase()
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
        return
      }

      const step = e.shiftKey ? 10 : 1
      const isAlt = e.altKey

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (isAlt) {
          nudge({ dw: -step })
        } else {
          nudge({ dx: -step })
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (isAlt) {
          nudge({ dw: step })
        } else {
          nudge({ dx: step })
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (isAlt) {
          nudge({ dh: -step })
        } else {
          nudge({ dy: -step })
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (isAlt) {
          nudge({ dh: step })
        } else {
          nudge({ dy: step })
        }
      } else if (e.key === 'Escape') {
        updateSettings({ calibrationMode: false })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settings.calibrationMode, nudge, updateSettings])

  return (
    <div className="control-layout">
      <HeaderBar />

      <CalibrationPad />

      <main className="control-content">
        <LivePreviewCard />

        <div className="control-grid">
          <div className="grid-column">
            <BackendSyncCard />
            <MediaSourceCard />
            <LayoutSettingsCard />
          </div>

          <div className="grid-column">
            <MarqueeSettingsCard />
            <DisplaySettingsCard />
          </div>
        </div>
      </main>
    </div>
  )
}
