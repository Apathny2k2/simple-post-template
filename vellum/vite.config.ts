import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// `vite build --mode sounds` builds the sound console on its own from sounds.html
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: mode === 'sounds' ? { outDir: 'dist-sounds', rollupOptions: { input: 'sounds.html' } } : undefined,
}))
