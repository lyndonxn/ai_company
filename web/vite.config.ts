import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // 会话网关
      '/api': {
        target: process.env.GATEWAY_ORIGIN || 'http://127.0.0.1:8790',
        changeOrigin: true,
      },
      // 大脑服务(mock 引擎经此取流式回复)
      '/brain': {
        target: process.env.BRAIN_ORIGIN || 'http://127.0.0.1:8900',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/brain/, ''),
      },
    },
  },
});
