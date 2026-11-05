import type { InferProps } from 'void'
import { defineHandler, ValidationError } from 'void/handler'
import { getItem, removeItem } from '../../lib/items'

export type Props = InferProps<typeof loader>

export const loader = defineHandler((c) => {
  const item = getItem(Number(c.req.param('id')))
  if (!item) return c.notFound()
  return { item }
})

export const actions = {
  // PUT /items/1?update
  update: defineHandler(async (c) => {
    const item = getItem(Number(c.req.param('id')))!
    const { name } = await c.req.json<{ name: string }>()
    if (!name) throw new ValidationError({ name: 'Enter a name' })
    item.name = name
    item.lastMethod = c.req.method
  }),
  // PATCH /items/1?note
  note: defineHandler(async (c) => {
    const item = getItem(Number(c.req.param('id')))!
    item.note = (await c.req.json<{ note: string }>()).note
    item.lastMethod = c.req.method
  }),
  // DELETE /items/1?remove
  remove: defineHandler((c) => {
    removeItem(Number(c.req.param('id')))
    // 303 makes the browser load the list with GET. A 302 would repeat the DELETE there
    return c.redirect('/items', 303)
  }),
  // POST /items/1?flash: an action can change the shared data
  flash: defineHandler((c) => {
    c.set('shared', { ...c.get('shared'), flash: 'Set by an action' })
  }),
}
