import type { InferProps } from 'void'
import { defineHandler, ValidationError } from 'void/handler'

// Demo data: the last upload, kept in memory
let last: { title: string; name: string; size: number; head: string } | null = null

export type Props = InferProps<typeof loader>

export const loader = defineHandler(() => ({ last }))

export const action = defineHandler(async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  if (!(file instanceof File) || file.size === 0) throw new ValidationError({ file: 'Choose a file' })
  last = { title: String(body['title']), name: file.name, size: file.size, head: (await file.text()).slice(0, 20) }
})
