import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Try ports in order: 8000, 8001, 8002
        // The backend startup script always uses 8000 via run_local.bat
        target: 'http://127.0.0.1:8011',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            // Silently swallow proxy connection errors (backend might be starting up)
            if (res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ detail: 'Backend is starting up, please wait...' }));
            }
          });
        }
      }
    }
  }
})
