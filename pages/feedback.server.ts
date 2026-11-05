import type { InferProps } from 'void'
import { defineHandler, ValidationError } from 'void/handler'

// Demo data: kept in memory, so it resets when the worker restarts.
const comments: string[] = []

export type Props = InferProps<typeof loader>

export const loader = defineHandler(() => {
  return { comments: [...comments] }
})

export const action = defineHandler(async (c) => {
  const { comment } = await c.req.json<{ comment: string }>()
  if (!comment) throw new ValidationError({ comment: 'Write a comment' })
  comments.push(comment)
})
