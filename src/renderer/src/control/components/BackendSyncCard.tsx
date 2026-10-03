import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'

export const BackendSyncCard: React.FC = () => {
  const {
    settings,
    syncStatus,
    startSync,
    stopSync,
    fetchNow,
    resetSyncHistory,
    openSyncLog,
    toggleAutoStartOnLaunch,
    setPollInterval,
    toggleSource,
    addSource,
    removeSource
  } = useApp()

  const [showAddSource, setShowAddSource] = useState(false)
  const [newSourceName, setNewSourceName] = useState('')
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [isTriggering, setIsTriggering] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const sync = settings.sync
  const isRunning = syncStatus?.isRunning ?? false
  const state = syncStatus?.state ?? 'idle'

  const handleResetSyncHistory = async (): Promise<void> => {
    const ok = window.confirm(
      'Reset sync history?\n\nThis will clear the downloaded files manifest and failed records. The next fetch will re-download all videos from both sources.'
    )
    if (ok) {
      setIsResetting(true)
      try {
        await resetSyncHistory()
      } finally {
        setTimeout(() => setIsResetting(false), 600)
      }
    }
  }

  const handleFetchNow = async (): Promise<void> => {
    setIsTriggering(true)
    try {
      await fetchNow()
    } finally {
      setTimeout(() => setIsTriggering(false), 800)
    }
  }

  const handleAddCustomSource = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newSourceName.trim() || !newSourceUrl.trim()) return

    const id = newSourceName.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    await addSource({
      id,
      name: newSourceName.trim(),
      url: newSourceUrl.trim(),
      enabled: true
    })

    setNewSourceName('')
    setNewSourceUrl('')
    setShowAddSource(false)
  }

  // Format timestamp helper
  const formatTime = (isoString: string | null): string => {
    if (!isoString) return 'None yet'
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString()
    } catch {
      return isoString
    }
  }

  // Determine current status string
  // Requirements: Idle / Fetching... / Downloading (3 of 8) / Waiting / Error: <short message>
  let statusText = 'Idle'
  let statusBadgeClass = 'status-idle'

  if (state === 'idle') {
    statusText = 'Idle'
    statusBadgeClass = 'status-idle'
  } else if (state === 'fetching') {
    statusText = 'Fetching...'
    statusBadgeClass = 'status-fetching'
  } else if (state === 'downloading') {
    const total = syncStatus?.batchTotal || syncStatus?.activeDownloads || 1
    const current = Math.min((syncStatus?.batchCompleted || 0) + 1, total)
    statusText = `Downloading (${current} of ${total})`
    statusBadgeClass = 'status-downloading'
  } else if (state === 'waiting') {
    statusText = 'Waiting'
    statusBadgeClass = 'status-waiting'
  } else if (state === 'error') {
    const errMsg = syncStatus?.lastError ? syncStatus.lastError.slice(0, 38) : 'Connection failed'
    statusText = `Error: ${errMsg}`
    statusBadgeClass = 'status-error'
  }

  // Timer label & progress calculation
  const remainingSec = syncStatus?.secondsUntilNextFetch ?? 0
  const progressPercent = Math.round((syncStatus?.nextPollProgress ?? 0) * 100)

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="card-icon">🔄</span>
          <span>Backend Video Sync</span>
        </div>
        <div className="card-actions">
          <span className={`status-badge ${statusBadgeClass}`}>● {statusText}</span>
          <button
            type="button"
            className="btn btn-xs"
            onClick={openSyncLog}
            title="Open backend sync log file"
          >
            Open Log
          </button>
        </div>
      </div>

      <div className="card-body">
        {/* Prominent Start/Stop Action & Next-Fetch Timer Banner */}
        <div className="sync-action-banner">
          <div className="sync-action-buttons">
            {!isRunning ? (
              <button
                type="button"
                className="btn btn-start-sync"
                onClick={startSync}
                title="Start background sync polling immediately"
              >
                <span className="btn-icon">▶</span>
                <b>Start sync</b>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-stop-sync"
                onClick={stopSync}
                title="Pause background polling (in-flight downloads finish safely)"
              >
                <span className="btn-icon">⏹</span>
                <b>Stop sync</b>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-fetch-now"
              onClick={handleFetchNow}
              disabled={isTriggering || state === 'fetching'}
              title="Immediately fetch from all enabled sources and reset countdown"
            >
              {isTriggering || state === 'fetching' ? 'Fetching...' : '⚡ Fetch now'}
            </button>
          </div>

          {/* Compact Countdown & Progress Bar */}
          <div className="sync-timer-wrapper">
            <div className="sync-timer-header">
              <span className="sync-timer-label">
                {isRunning
                  ? state === 'fetching'
                    ? 'Fetching from sources...'
                    : `Next fetch in ${remainingSec}s`
                  : 'Sync paused'}
              </span>
              <span className="sync-timer-interval">Interval: {sync.pollIntervalSec}s</span>
            </div>
            <div className="sync-progress-track">
              <div
                className={`sync-progress-fill ${!isRunning ? 'paused' : ''} ${state === 'fetching' ? 'pulsing' : ''}`}
                style={{
                  width: `${isRunning ? (state === 'fetching' ? 100 : progressPercent) : 0}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* Sync Status Metrics (Last fetch time, Total downloaded, Failed items) */}
        <div className="sync-status-stats">
          <div className="sync-stat-item">
            <span className="sync-stat-label">Last Successful Fetch</span>
            <span className="sync-stat-value">
              {formatTime(syncStatus?.lastSuccessfulFetchTime ?? null)}
            </span>
          </div>
          <div className="sync-stat-item">
            <span className="sync-stat-label">Total Downloaded</span>
            <span className="sync-stat-value" style={{ color: '#00ff88' }}>
              {syncStatus?.downloadedCount ?? 0}
            </span>
          </div>
          <div className="sync-stat-item">
            <span className="sync-stat-label">Active / Queued</span>
            <span className="sync-stat-value">
              {syncStatus?.activeDownloads ?? 0} / {syncStatus?.queuedDownloads ?? 0}
            </span>
          </div>
          <div className="sync-stat-item">
            <span className="sync-stat-label">Failed Items</span>
            <span
              className="sync-stat-value"
              style={{ color: (syncStatus?.failedCount ?? 0) > 0 ? '#f87171' : '#94a3b8' }}
            >
              {syncStatus?.failedCount ?? 0}
            </span>
          </div>
        </div>

        {/* Last Error Message if any */}
        {syncStatus?.lastError && (
          <div className="sync-error-banner" title={syncStatus.lastError}>
            <span className="error-icon">⚠️</span>
            <span className="error-text">{syncStatus.lastError}</span>
          </div>
        )}

        {/* Sync Settings: Auto-start on launch & Poll interval */}
        <div className="grid-2-col" style={{ marginTop: 4 }}>
          <div className="field-group">
            <label className="field-label">
              <span>Start sync automatically on launch</span>
              <span className="field-tip">
                Off by default; enable so app auto-recovers if restarted
              </span>
            </label>
            <div className="toggle-switch-row">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={sync.autoStartOnLaunch}
                  onChange={(e) => toggleAutoStartOnLaunch(e.target.checked)}
                />
                <span className="slider round" />
              </label>
              <span className="toggle-switch-label">
                {sync.autoStartOnLaunch ? (
                  <b style={{ color: '#00ff88' }}>Auto-start Enabled</b>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Manual start only</span>
                )}
              </span>
            </div>
          </div>

          <div className="field-group">
            <div className="field-label-row">
              <label className="field-label">
                <span>Poll Interval (Seconds)</span>
                <span className="field-tip">Frequency between automatic fetches</span>
              </label>
              <span className="field-value-badge">{sync.pollIntervalSec}s</span>
            </div>
            <div className="slider-row">
              <input
                type="range"
                min={5}
                max={120}
                step={5}
                value={sync.pollIntervalSec}
                onChange={(e) => setPollInterval(parseInt(e.target.value, 10))}
                className="form-range"
              />
              <input
                type="number"
                min={3}
                max={600}
                value={sync.pollIntervalSec}
                onChange={(e) => setPollInterval(parseInt(e.target.value, 10) || 10)}
                className="form-input form-input-sm"
                style={{ width: 65 }}
              />
            </div>
          </div>
        </div>

        {/* Configured Sources List */}
        <div className="field-group" style={{ marginTop: 4 }}>
          <div className="field-label-row">
            <label className="field-label">
              <span>Configured API Sources</span>
              <span className="field-tip">
                Each source returns a JSON array; videos named as
                $&#123;source&#125;_$&#123;_id&#125;.mp4
              </span>
            </label>
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => setShowAddSource(!showAddSource)}
            >
              {showAddSource ? 'Cancel' : '+ Add Source'}
            </button>
          </div>

          <div className="sync-sources-list">
            {sync.sources.map((source) => {
              const srcStatus = syncStatus?.sourcesStatus?.[source.id]
              return (
                <div key={source.id} className="sync-source-row">
                  <div className="source-info">
                    <label className="source-toggle-label">
                      <input
                        type="checkbox"
                        checked={source.enabled}
                        onChange={(e) => toggleSource(source.id, e.target.checked)}
                      />
                      <span className="source-name">{source.name}</span>
                    </label>
                    <span className="source-url" title={source.url}>
                      {source.url}
                    </span>
                  </div>

                  <div className="source-meta">
                    {srcStatus && (
                      <span className="source-stat">
                        {srcStatus.error ? (
                          <span style={{ color: '#f87171' }}>Error</span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>{srcStatus.itemCount} items</span>
                        )}
                      </span>
                    )}
                    {sync.sources.length > 1 && (
                      <button
                        type="button"
                        className="btn-remove-source"
                        onClick={() => removeSource(source.id)}
                        title="Remove source"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Add custom source modal/form */}
          {showAddSource && (
            <form onSubmit={handleAddCustomSource} className="add-source-form">
              <div className="add-source-inputs">
                <input
                  type="text"
                  placeholder="Source Name (e.g. drawings)"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="form-input form-input-sm"
                  required
                />
                <input
                  type="url"
                  placeholder="API URL (https://...)"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  className="form-input form-input-sm"
                  required
                />
              </div>
              <div className="add-source-actions">
                <button type="submit" className="btn btn-xs btn-primary">
                  Save Source
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={() => setShowAddSource(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Reset Sync History Row */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>
              Reset Sync History
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              Clears downloaded manifest and failure records so all videos re-download
            </div>
          </div>
          <button
            type="button"
            className="btn btn-xs btn-danger-outline"
            onClick={handleResetSyncHistory}
            disabled={isResetting}
            title="Clear download manifest and failed records (confirm required)"
          >
            {isResetting ? 'Resetting...' : '🗑️ Reset sync history'}
          </button>
        </div>
      </div>
    </div>
  )
}
