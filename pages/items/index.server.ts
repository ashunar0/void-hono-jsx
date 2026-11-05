import type { InferProps } from 'void'
import { defineHandler, ValidationError } from 'void/handler'
import { createItem, listItems } from '../../lib/items'

export type Props = InferProps<typeof loader>

export const loader = defineHandler(() => ({ items: listItems() }))

export const action = defineHandler(async (c) => {
  const { name } = await c.req.json<{ name: string }>()
  if (!name) throw new ValidationError({ name: 'Enter a name' })
  // A redirect from an action: the browser lands on the new item's page
  return c.redirect(`/items/${createItem(name).id}`)
})
