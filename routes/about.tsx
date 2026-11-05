import { defineHandler } from 'void'

export const GET = defineHandler((c) => {
  return c.html(<h1>I'm Hono</h1>)
})
