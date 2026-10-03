# Sirasa Video Marquee Display

Offline event video marquee display application built with **Electron + Vite + React + TypeScript**.

Designed specifically for ultra-wide LED wall strips (e.g. 100 ft × 3 ft / 7680×240 px) showing a fixed background image with sponsor ad zones and a large middle rectangle displaying a seamless looping video marquee from a local folder.

---

## Architecture Overview

The application operates with a dual-window model and a decoupled backend-ready architecture:

```
┌────────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                   │
│                                                            │
│  - MediaProtocol (media:// streaming protocol)             │
│  - SettingsManager (persists to appData/userData/...)      │
│  - LocalFolderSource (chokidar watcher with 2s stability)  │
│  - WindowManager (multi-display, powerSaveBlocker, kiosk)  │
│  - IPC Broadcast Bus                                       │
└──────────────┬──────────────────────────────┬──────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│       WALL DISPLAY WINDOW    │ │     CONTROL PANEL WINDOW     │
│                              │ │                              │
│ - Scaled Design Canvas       │ │ - Live Realtime Monitor      │
│   (default 7680×240 px)      │ │ - Media Folder Watcher Status│
│ - Background & Ad Layers     │ │ - Marquee Motion Settings    │
│ - Smooth rAF translate3d     │ │ - Canvas & Rect Coordinates  │
│   Marquee Engine             │ │ - Target Display Selector    │
│ - Seamless wrapping & loop   │ │ - Interactive Calibration HUD│
│ - Zero-jump live updates     │ │   & Hotkey Nudge Pad         │
│ - Cursor hidden / Kiosk mode │ │                              │
└──────────────────────────────┘ └──────────────────────────────┘
```

### 1. Dual Windows

- **Wall Window**: Frameless / borderless fullscreen on the designated target display. Cursor hidden, menus removed, powersave blocker active. Renders the fixed-size design canvas (7680×240 px) scaled to fit the real display while preserving coordinates in design pixels.
- **Control Window**: Operator interface on the primary/operator monitor. Live preview monitor, hotkeys, directory picker, speed/height sliders, gap settings, edge fade, display switcher, and calibration HUD.

### 2. High-Performance Marquee Engine

- **Hardware-Accelerated Movement**: Driven by `requestAnimationFrame` and delta time with `translate3d(trackOffset, 0, 0)`. Never uses CSS animations.
- **Zero-Jump Live Controls**: Modifying speed, tile height, aspect ratio, or gap on the fly adjusts dimensions without resetting or jumping visible tiles.
- **Seamless Wrapping**: Tiles wrap seamlessly as they exit the left edge ($X + \text{width} < 0$).
- **Short Playlist Adaptation**: Handles short playlists (even 1 or 2 videos) by repeating instances across the width.
- **Live Folder Injection**: When a new video is detected, it is queued and introduced beyond the right edge without disturbing active visible tiles.
- **Smart Resource Management**: Muted, looped HTML5 videos with `playsInline`. Distant off-screen tiles are paused, capping active videos to `maxPlayingVideos` (default 8) to conserve CPU/GPU.

### 3. Local Folder Source & Write Stabilization

- Implements `IVideoSource` interface so any future backend sync (S3, cloud sync, HTTP pull) can simply write files to the watched folder.
- Watches with `chokidar` for `.mp4`, `.webm`, `.mov`, `.m4v`.
- **2-Second Size Stabilization**: Ignores partially copied or downloading files until size has remained steady for ~2 seconds.
- Serves videos safely via a custom `media://` scheme registered with standard streaming privileges, enabling byte ranges and bypassing strict file URL limitations with `autoplayPolicy: 'no-user-gesture-required'`.

### 4. Backend Video Sync (Decoupled Worker)

- **Completely Decoupled**: Runs in the background in the Electron Main process without ever blocking the UI or touching the marquee ticker code. Writes completed, verified MP4 files directly into the watched videos folder where the existing watcher (`LocalFolderSource`) detects them.
- **Configurable API Sources**: Polls configured endpoints (e.g. `api/drawings`, `api/quick-drawings`) returning JSON arrays of `{ _id, imageUrl, uploadedAt, videoGeneratedAt?, videoUrl? }`. Ignores records without `videoUrl` until ready on subsequent polls.
- **Render Server Wake-Up Handling**: Render cold-starts can take up to a minute; includes a 75s initial request timeout with exponential retry backoff.
- **Download Pipeline & Size Verification**: Downloads to a dedicated `sync_temp` folder outside the watched directory. Verifies HTTP status, non-zero bytes, and matches with `content-length`. Atomically renames into the videos folder as `${sourceName}_${_id}.mp4` (cross-drive compatible on Windows).
- **Concurrency & Resilient Retries**: Capped at 2–3 concurrent downloads. Retries failures up to 5 times with exponential backoff before marking as abandoned until the next app start. If network drops, local marquee continues playback uninterrupted.
- **Persistent Manifest**: Stored in `userData/sync-manifest.json` tracking downloaded keys (`${sourceName}:${_id}`) and failure counts across sessions.
- **Privacy-Safe File Logging**: Logs to `userData/sync.log` with auto-rotation (capped at 5MB). Strictly omits `imageUrl` and attendee names from logs.

### 5. Calibration Mode

- Toggleable calibration HUD overlay.
- Visual glowing boundary guides and real-time numeric badge ($X, Y, W, H$).
- **Operator Hotkeys (Control Window Only)**:
  - `←` / `→` : Nudge X Position ($\pm 1\text{px}$, hold `Shift` for $\pm 10\text{px}$)
  - `↑` / `↓` : Nudge Y Position ($\pm 1\text{px}$, hold `Shift` for $\pm 10\text{px}$)
  - `Alt + ←` / `Alt + →` : Nudge Width ($\pm 1\text{px}$, hold `Shift` for $\pm 10\text{px}$)
  - `Alt + ↑` / `Alt + ↓` : Nudge Height ($\pm 1\text{px}$, hold `Shift` for $\pm 10\text{px}$)
  - `Escape` : Exit Calibration Mode

---

## Quick Start & Run Commands

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Sample Media Assets (Optional)

The project includes a generator that creates 5 test videos (`.webm`) with animated test patterns and a sample `7680×240` background banner with left and right sponsor ads:

```bash
npm run generate:samples
```

Sample assets are saved in the `sample-videos/` directory.

### 3. Start Development Mode

```bash
npm run dev
```

Both the **Control Panel** and the **Wall Display** will launch. By default, the Wall Window opens in windowed mode for easy side-by-side operator testing on a single monitor. You can toggle to full-screen kiosk on any attached display at any time.

### 4. Code Quality & Type Checks

```bash
# Run ESLint
npm run lint

# Run TypeScript checks for both Main and Renderer
npm run typecheck

# Format files with Prettier
npm run format
```

### 5. Production Build

```bash
# Compile and package output
npm run build

# Package executable for Windows
npm run build:win
```

---

## Operational Guide

1. **Select Videos Folder**:
   - In the Control Window, click **Browse Folder...** under _Media Source & Background_.
   - Point to `sample-videos` (or any local folder with MP4/WebM videos).
   - The playlist preview will list all discovered videos and start scrolling immediately.
2. **Add Videos Live**:
   - Drag or copy any `.mp4` or `.webm` file into the watched folder during runtime.
   - Once the file finishes copying (2s stability threshold), it is automatically queued and scrolls in from the right edge seamlessly.
3. **Calibrate Wall Marquee Area**:
   - Click **Calibration Mode** in the top header.
   - Use the arrow keys (or the on-screen nudge pad in the Control Window) to align the marquee rectangle perfectly with the physical LED wall aperture.
4. **Choose Target Screen**:
   - Under _Target Display & Kiosk_, select which monitor should display the wall.
   - Click **Borderless Fullscreen** to lock the display in kiosk mode with cursor hidden and system sleep blocked.

# sirasa-video-marquee
