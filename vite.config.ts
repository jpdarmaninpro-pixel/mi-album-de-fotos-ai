import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// Fix: Define __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file for the current mode
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  
  return {
    plugins: [react()],
    root: 'client', // Set the root to the 'client' directory
    envDir: '..', // Point to the project root for .env files
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client'),
      },
    },
    define: {
      // Expose certain env variables to the client
      'process.env.VITE_AWS_S3_BUCKET': JSON.stringify(env.AWS_S3_BUCKET),
      'process.env.VITE_AWS_REGION': JSON.stringify(env.AWS_REGION),
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
  }
})
