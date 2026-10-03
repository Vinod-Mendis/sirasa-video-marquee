import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const MAX_LOG_SIZE = 5 * 1024 * 1024 // 5 MB

export class SyncLogger {
  private logPath: string

  constructor() {
    const userDataPath = app.getPath('userData')
    this.logPath = path.join(userDataPath, 'sync.log')
  }

  public getLogFilePath(): string {
    return this.logPath
  }

  public info(message: string): void {
    this.writeLog('INFO', message)
  }

  public warn(message: string): void {
    this.writeLog('WARN', message)
  }

  public error(message: string, error?: unknown): void {
    let errDetails = ''
    if (error instanceof Error) {
      errDetails = ` - ${error.message}`
    } else if (error) {
      errDetails = ` - ${String(error)}`
    }
    this.writeLog('ERROR', `${message}${errDetails}`)
  }

  private writeLog(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
    const timestamp = new Date().toISOString()
    const line = `[${timestamp}] [${level}] ${message}\n`

    try {
      this.checkRotate()
      fs.appendFileSync(this.logPath, line, 'utf-8')
    } catch (err) {
      console.error('[SyncLogger] Failed to write log line:', err)
    }

    if (level === 'ERROR') {
      console.error(`[BackendSync] ${message}`)
    } else {
      console.log(`[BackendSync] ${message}`)
    }
  }

  private checkRotate(): void {
    try {
      if (fs.existsSync(this.logPath)) {
        const stats = fs.statSync(this.logPath)
        if (stats.size > MAX_LOG_SIZE) {
          const oldPath = `${this.logPath}.old`
          if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath)
          }
          fs.renameSync(this.logPath, oldPath)
        }
      }
    } catch {
      // Ignore rotation errors
    }
  }
}
