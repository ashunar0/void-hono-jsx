import { defer, defineHandler } from 'void'
import type { InferProps } from 'void'

export type Props = InferProps<typeof loader>

export const loader = defineHandler((c) => {
  return {
    message: 'Hello from the loader',
    name: c.req.query('name') ?? 'Hono',
    // Slow data: the page renders first and receives this when it is ready
    slow: defer(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return { text: 'Deferred data arrived' }
    }),
  }
})
