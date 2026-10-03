import React from 'react'
import { useApp } from '../../context/AppContext'

export const MediaSourceCard: React.FC = () => {
  const { settings, videos, selectFolder, selectImage, clearImage } = useApp()

  const hasFolder = Boolean(settings.videosFolder)
  const hasImage = Boolean(settings.backgroundImagePath)

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <span className="card-icon">📁</span>
          <span>Media Source & Background</span>
        </div>
        <div className="card-badge">
          {hasFolder ? (
            <span className="status-badge status-active">
              ● Watching ({videos.length} {videos.length === 1 ? 'video' : 'videos'})
            </span>
          ) : (
            <span className="status-badge status-warning">No Folder Set</span>
          )}
        </div>
      </div>

      <div className="card-body">
        {/* Videos Folder Selector */}
        <div className="field-group">
          <label className="field-label">
            <span>Videos Folder (Watched Live)</span>
            <span className="field-tip">MP4, WebM, MOV, M4V • 2s write stabilization</span>
          </label>
          <div className="input-with-button">
            <input
              type="text"
              readOnly
              value={settings.videosFolder || 'No folder chosen'}
              className="form-input readonly-input"
              title={settings.videosFolder}
            />
            <button type="button" className="btn btn-primary" onClick={selectFolder}>
              Browse Folder...
            </button>
          </div>
        </div>

        {/* Background Image Selector */}
        <div className="field-group">
          <label className="field-label">
            <span>Wall Background Image</span>
            <span className="field-tip">Fixed design canvas backdrop with Left & Right ads</span>
          </label>
          <div className="input-with-button">
            <input
              type="text"
              readOnly
              value={settings.backgroundImagePath || 'Using default visual layout'}
              className="form-input readonly-input"
              title={settings.backgroundImagePath}
            />
            <button type="button" className="btn btn-secondary" onClick={selectImage}>
              Browse Image...
            </button>
            {hasImage && (
              <button
                type="button"
                className="btn btn-danger-outline"
                onClick={clearImage}
                title="Remove custom background image"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Video Playlist preview */}
        <div className="playlist-section">
          <div className="playlist-header">
            <span className="playlist-title">Active Video Playlist ({videos.length})</span>
            {videos.length === 0 && (
              <span className="playlist-empty-hint">
                Folder is empty or not selected. The wall will display the background cleanly.
              </span>
            )}
          </div>
          {videos.length > 0 && (
            <div className="playlist-chips">
              {videos.map((vid, idx) => (
                <div key={vid.id} className="video-chip" title={vid.filePath}>
                  <span className="video-chip-idx">#{idx + 1}</span>
                  <span className="video-chip-name">{vid.fileName}</span>
                  <span className="video-chip-size">
                    {(vid.size / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
