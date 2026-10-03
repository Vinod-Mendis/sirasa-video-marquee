import { VideoItem } from '@shared/types'

export interface IVideoSource {
  /**
   * Initializes and starts the video source
   */
  start(): Promise<void>

  /**
   * Stops the video source and cleans up watchers/resources
   */
  stop(): Promise<void>

  /**
   * Sets/changes the directory or source location
   */
  setFolder(folderPath: string): Promise<void>

  /**
   * Returns current list of active video items
   */
  getVideos(): VideoItem[]

  /**
   * Event listeners
   */
  on(event: 'change', listener: (videos: VideoItem[]) => void): this
  on(event: 'add', listener: (video: VideoItem) => void): this
  on(event: 'remove', listener: (videoId: string) => void): this
  off(event: string, listener: (...args: unknown[]) => void): this
}
