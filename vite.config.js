import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true }
      // Not: 127.0.0.1 yazdık ki Windows firewall'a takılmasın.
    }
  }
})
