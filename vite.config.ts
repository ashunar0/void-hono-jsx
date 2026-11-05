import { resolve } from 'node:path'
import { voidMarkdown } from '@void/md/plugin'
import { defineConfig } from 'vite'
import { voidPlugin } from 'void'
import { voidHono } from './void-hono/plugin.ts'

const adapter = (file: string) => resolve(import.meta.dirname, 'void-hono', file)

export default defineConfig({
  // voidMarkdown() must come after the adapter
  plugins: [voidPlugin(), voidHono({ viewTransitions: true }), voidMarkdown()],
  resolve: {
    // This playground runs the adapter from its source in ./void-hono.
    // The more specific ids come first: a plain string alias also matches as a prefix
    alias: [
      { find: '@void/hono/pages-server', replacement: adapter('pages-server.ts') },
      { find: '@void/hono/pages-client', replacement: adapter('pages-client.tsx') },
      { find: '@void/hono', replacement: adapter('index.tsx') },
    ],
  },
  build: { minify: true },
})
