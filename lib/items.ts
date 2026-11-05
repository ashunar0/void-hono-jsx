// Demo data for the /items pages: kept in memory, so it resets when the worker restarts.
export type Item = { id: number; name: string; note: string; lastMethod: string }

const items = new Map<number, Item>([
  [1, { id: 1, name: 'First item', note: '', lastMethod: '-' }],
  [2, { id: 2, name: 'Second item', note: '', lastMethod: '-' }],
])
let nextId = 3

export const listItems = () => [...items.values()]
export const getItem = (id: number) => items.get(id)
export const removeItem = (id: number) => items.delete(id)
export function createItem(name: string): Item {
  const item = { id: nextId++, name, note: '', lastMethod: 'POST' }
  items.set(item.id, item)
  return item
}
