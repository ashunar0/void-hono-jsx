import { voidMarkdown } from '@void/md/plugin'
import { defineConfig } from 'vite'
import { voidPlugin } from 'void'
import { voidHono } from './void-hono/plugin.ts'

export default defineConfig({
  // voidMarkdown() must come after the adapter
  plugins: [voidPlugin(), voidHono(), voidMarkdown()],
  build: { minify: true },
})
