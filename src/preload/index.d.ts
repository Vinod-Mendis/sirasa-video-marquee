import { ElectronAPI } from '@electron-toolkit/preload'
import { MarqueeAPI } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: MarqueeAPI
  }
}
