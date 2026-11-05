import type { InferProps } from 'void'
import { defineHandler, ValidationError } from 'void/handler'

// Demo data: kept in memory, so it resets when the worker restarts.
const entries: { name: string; message: string }[] = []

export type Props = InferProps<typeof loader>

export const loader = defineHandler(() => {
  return { entries: [...entries] }
})

export const actions = {
  default: defineHandler(async (c) => {
    const { name, message } = await c.req.json<{ name: string; message: string }>()
    if (!name) throw new ValidationError({ name: 'Enter your name' })
    entries.push({ name, message })
  }),
  clear: defineHandler(() => {
    entries.length = 0
  }),
}
