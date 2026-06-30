import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // base: '/' is correct when serving from a custom domain.
  // Change to '/cfb-web/' temporarily if using the default GitLab Pages URL
  // (NAMESPACE.gitlab.io/cfb-web) before the custom domain is configured.
  base: '/',
})
