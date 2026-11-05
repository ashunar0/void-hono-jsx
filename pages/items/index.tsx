import { Form, Link, useForm } from '@void/hono'
import { routeUrl } from 'void/routes'
import type { Props } from './index.server'

export default function Items({ items }: Props) {
  const form = useForm('/items', { name: '' })
  return (
    <div>
      <h1>Items</h1>
      <ul id="items">
        {items.map((item, index) => (
          <li>
            {/* The first link prefetches on hover, the others as soon as they render */}
            <Link
              href={routeUrl('/items/:id', { params: { id: String(item.id) } })}
              prefetch={index === 0 ? true : 'mount'}
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
      <Form form={form}>
        <input
          name="name"
          placeholder="New item"
          value={String(form.data.name)}
          onInput={(event: Event) => form.setData('name', (event.target as HTMLInputElement).value)}
        />
        <button type="submit" disabled={form.pending}>
          Create
        </button>
        {form.errors.name && <span id="name-error"> {form.errors.name}</span>}
      </Form>
    </div>
  )
}
