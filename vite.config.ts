import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173 },
  // cubejs 内部用 `this.Cube` 访问跨文件的全局变量，Vite 预打包 ESM 互操作下 `this` 变 undefined 导致运行时抛错。
  // 让 Vite 不预打包 cubejs，让浏览器直接 import 它的 CommonJS 源。
  optimizeDeps: {
    exclude: ['cubejs'],
  },
})
