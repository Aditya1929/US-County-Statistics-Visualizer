import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/nws': {
        target: 'https://api.weather.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nws/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large deps into separate chunks for better caching
          maplibre: ['maplibre-gl'],
          recharts: ['recharts'],
          d3: ['d3-scale', 'd3-scale-chromatic', 'd3-array'],
          topojson: ['topojson-client'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})
