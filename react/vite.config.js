import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/react/',   // 👈 ADD THIS LINE
  server: {
    allowedHosts: ['preprodadmin.zolio.ai'],
  },
  plugins: [react()],
})