import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 库模式：把 React + Tiptap 等全部 bundle 进 SDK，
// 这样消费方（Vue / 原生 HTML / Angular 等）无需提供 React 运行时。
export default defineConfig({
  plugins: [react()],
  publicDir: false,
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'IETMEditor',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: [],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'style.css'
          }
          return 'assets/[name][extname]'
        },
      },
    },
  },
})
