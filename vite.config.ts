import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // base: '/' is correct when serving from a custom domain.
  // Set to '/sports-simulate-web/' for the default GitHub Pages URL.
  // Switch back to '/' once a custom domain is configured.
  base: '/',
})
