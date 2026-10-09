/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // 用相对路径，打包后的 dist/ 放在任何子目录下（包括 TapTap 的 zip）都能打开
  base: './',
  build: {
    outDir: 'dist',
    // 字体文件单独放，不内联进 CSS
    assetsInlineLimit: 0
  },
  test: {
    include: ['tests/**/*.test.ts']
  }
});
