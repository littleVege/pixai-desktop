/// <reference types="vitest/config" />
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  base: './',
  // `--mode artifact`: ship the snapshot images with the page and build into dist-artifact/
  publicDir: mode === 'artifact' ? 'artifact-public' : 'public',
  build: { outDir: mode === 'artifact' ? 'dist-artifact' : 'dist' },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  // The demo server (`pnpm server`) holds the PixAI key; the page talks to it through this proxy.
  // PORT (set by the preview launcher when 5173 is taken) wins over Vite's default.
  server: {
    ...(process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {}),
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'electron/**/*.test.ts'] },
}))
