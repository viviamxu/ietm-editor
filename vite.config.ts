import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 监听所有地址，包括局域网和本地
    port: 5173,      // 确认端口号
  }
})
