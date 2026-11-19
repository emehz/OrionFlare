import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En GitHub Pages el sitio vive en https://emehz.github.io/OrionFlare/.
// Si algún día usas un dominio propio, define BASE_PATH=/ al compilar.
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'build' || isPreview ? (process.env.BASE_PATH ?? '/OrionFlare/') : '/',
  build: {
    sourcemap: false, // nunca publicar el código fuente legible
    chunkSizeWarningLimit: 1800,
  },
}))
