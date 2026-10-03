/* eslint-disable @typescript-eslint/no-require-imports */
// Script to generate a 7680x240 sample background banner with left and right sponsor ads
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const OUTPUT_FILE = path.resolve(__dirname, '../sample-videos/sample_wall_background.png')

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1920,
    height: 60,
    webPreferences: { offscreen: true }
  })

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#000;">
    <canvas id="c" width="7680" height="240"></canvas>
    <script>
      function renderBanner() {
        const canvas = document.getElementById('c');
        const ctx = canvas.getContext('2d');

        // Dark tech gradient background
        const bgGrad = ctx.createLinearGradient(0, 0, 7680, 0);
        bgGrad.addColorStop(0, '#0a0d18');
        bgGrad.addColorStop(0.25, '#12182c');
        bgGrad.addColorStop(0.5, '#0e1322');
        bgGrad.addColorStop(0.75, '#12182c');
        bgGrad.addColorStop(1, '#0a0d18');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 7680, 240);

        // Grid lines effect
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < 7680; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 240);
          ctx.stroke();
        }

        // Left Ad Area (0 to 1920)
        const leftGrad = ctx.createLinearGradient(0, 0, 1920, 240);
        leftGrad.addColorStop(0, '#1a1f36');
        leftGrad.addColorStop(1, '#0d1120');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(40, 20, 1840, 200);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 20, 1840, 200);

        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('OFFICIAL MAIN EVENT SPONSOR', 960, 105);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '28px sans-serif';
        ctx.fillText('PREMIUM ULTRA-WIDE LED WALL EXPERIENCE', 960, 160);

        // Right Ad Area (5760 to 7680)
        const rightGrad = ctx.createLinearGradient(5760, 0, 7680, 240);
        rightGrad.addColorStop(0, '#1e1b4b');
        rightGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = rightGrad;
        ctx.fillRect(5800, 20, 1840, 200);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.strokeRect(5800, 20, 1840, 200);

        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SPECIAL GUEST HIGHLIGHTS', 6720, 105);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '28px sans-serif';
        ctx.fillText('SIRASA BROADCAST & MEDIA FESTIVAL 2026', 6720, 160);

        return canvas.toDataURL('image/png').split(',')[1];
      }
      window.renderBanner = renderBanner;
    </script>
  </body>
  </html>
  `

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  const base64 = await win.webContents.executeJavaScript('window.renderBanner()')
  fs.writeFileSync(OUTPUT_FILE, Buffer.from(base64, 'base64'))
  console.log('Saved background banner to:', OUTPUT_FILE)
  app.quit()
})
