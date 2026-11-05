import { defineHandler } from 'void'

// GET /api/greet/:name
export const GET = defineHandler((c) => {
  const name = c.req.param('name') ?? ''
  return { greeting: `Hello, ${name}`, length: name.length }
})
