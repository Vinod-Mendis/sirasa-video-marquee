import { protocol, net } from 'electron'
import { pathToFileURL } from 'url'
import fs from 'fs'

export const MEDIA_SCHEME = 'media'

/**
 * Must be called before app.whenReady()
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true
      }
    }
  ])
}

/**
 * Registers protocol handler for media://
 */
export function setupMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      let targetPath = url.searchParams.get('path')

      if (!targetPath) {
        // Fallback if URL is formatted as media://file/C:/... or media:///C:/...
        const decoded = decodeURIComponent(url.pathname)
        targetPath =
          decoded.startsWith('/') && decoded.charAt(2) === ':' ? decoded.slice(1) : decoded
      }

      if (!targetPath || !fs.existsSync(targetPath)) {
        return new Response('File not found', { status: 404 })
      }

      const fileUrl = pathToFileURL(targetPath).toString()
      return net.fetch(fileUrl)
    } catch (err) {
      console.error('[MediaProtocol] Error handling request:', err)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
}

/**
 * Converts a local file path to a media:// URL
 */
export function filePathToMediaUrl(filePath: string): string {
  if (!filePath) return ''
  return `${MEDIA_SCHEME}://file?path=${encodeURIComponent(filePath)}`
}
