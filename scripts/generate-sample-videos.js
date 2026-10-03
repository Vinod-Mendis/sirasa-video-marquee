/* eslint-disable @typescript-eslint/no-require-imports */
// Script to generate sample WebM video files using Electron's headless Chromium & MediaRecorder
const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')

const OUTPUT_DIR = path.resolve(__dirname, '../sample-videos')

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 640,
    height: 360,
    webPreferences: {
      offscreen: true
    }
  })

  // Load a simple generator page
  const html = `
  <!DOCTYPE html>
  <html>
  <body>
    <canvas id="c" width="640" height="360"></canvas>
    <script>
      async function createVideo(label, color, durationMs) {
        return new Promise((resolve) => {
          const canvas = document.getElementById('c');
          const ctx = canvas.getContext('2d');
          const stream = canvas.captureStream(30);
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          const chunks = [];

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const buffer = await blob.arrayBuffer();
            resolve(Array.from(new Uint8Array(buffer)));
          };

          recorder.start();

          const startTime = performance.now();
          function draw(now) {
            const elapsed = now - startTime;
            const progress = (elapsed % 2000) / 2000;

            // Background
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 640, 360);

            // Animated shape
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            const x = 50 + progress * 540;
            ctx.arc(x, 180, 40, 0, Math.PI * 2);
            ctx.fill();

            // Label text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(label, 320, 100);

            // Sub text
            ctx.font = '20px Arial';
            ctx.fillText((elapsed / 1000).toFixed(1) + 's / ' + (durationMs / 1000) + 's', 320, 280);

            if (elapsed < durationMs) {
              requestAnimationFrame(draw);
            } else {
              recorder.stop();
            }
          }

          requestAnimationFrame(draw);
        });
      }

      window.generateSample = createVideo;
    </script>
  </body>
  </html>
  `

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  const samples = [
    { name: 'video_01_red.webm', label: 'RED CARPET 01', color: '#dc2626' },
    { name: 'video_02_blue.webm', label: 'STAGE LIGHTS 02', color: '#2563eb' },
    { name: 'video_03_green.webm', label: 'VIP LOUNGE 03', color: '#16a34a' },
    { name: 'video_04_purple.webm', label: 'LIVE AWARDS 04', color: '#9333ea' },
    { name: 'video_05_amber.webm', label: 'AFTERPARTY 05', color: '#d97706' }
  ]

  console.log('Generating sample videos into:', OUTPUT_DIR)

  for (const sample of samples) {
    const filePath = path.join(OUTPUT_DIR, sample.name)
    console.log(`Rendering ${sample.name}...`)
    const bytes = await win.webContents.executeJavaScript(
      `window.generateSample(${JSON.stringify(sample.label)}, ${JSON.stringify(sample.color)}, 3000)`
    )
    fs.writeFileSync(filePath, Buffer.from(bytes))
    console.log(`Saved ${sample.name} (${bytes.length} bytes)`)
  }

  console.log('Sample video generation finished successfully!')
  app.quit()
})
