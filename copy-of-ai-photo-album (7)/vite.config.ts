import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix: Define __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'client', // Set the root to the 'client' directory
  envDir: '..', // Point to the project root for .env files
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client'),
    },
  },
  build: {
    outDir: '../server/dist/public'
  },
  publicDir: 'public',
  server: {
    proxy: {
      // Proxy API requests to the backend server
      '/api': {
        target: 'http://localhost:3001', // Your backend server address
        changeOrigin: true,
      },
    },
  },
})