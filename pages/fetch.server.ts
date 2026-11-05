import { defineHandler } from 'void'
import type { InferProps } from 'void'
import { fetch } from 'void/client'

export type Props = InferProps<typeof loader>

export const loader = defineHandler(async () => {
  // On the server this calls the route directly, without an HTTP round-trip
  const fromLoader = await fetch('/api/greet/:name', { params: { name: 'loader' } })
  return { fromLoader }
})
