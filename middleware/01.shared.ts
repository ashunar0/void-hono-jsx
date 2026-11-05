import { defineMiddleware } from 'void'

declare module 'void' {
  interface CloudContextVariables {
    shared: { site: string; path: string; flash?: string }
  }
}

// Shared data: every page and layout reads it with useShared()
export default defineMiddleware(async (c, next) => {
  c.set('shared', { site: 'Void + Hono JSX', path: c.req.path })
  await next()
})
