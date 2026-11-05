import { Form, Link, action, useForm, useParams, useRouter } from '@void/hono'
import type { Props } from './[id].server'

export default function ItemPage({ item }: Props) {
  const { id } = useParams()
  const router = useRouter()
  const form = useForm('/items/:id?update', { name: item.name }, { params: { id } })
  const noteForm = useForm('/items/:id?note', { note: 'Patched note' }, { params: { id } })
  return (
    <div>
      <h1 id="name">{item.name}</h1>
      <p id="param">id from useParams(): {id}</p>
      <p id="route">router.path: {router.path}</p>
      <p id="method">last method: {item.lastMethod}</p>
      <p id="note">note: {item.note}</p>

      <Form form={form} method="put">
        <input
          name="name"
          value={String(form.data.name)}
          onInput={(event: Event) => form.setData('name', (event.target as HTMLInputElement).value)}
        />
        <button type="submit" id="save" disabled={form.pending}>
          Save (PUT)
        </button>
        {form.errors.name && <span id="name-error"> {form.errors.name}</span>}
      </Form>

      <p>
        <button type="button" id="patch" onClick={() => noteForm.patch()}>
          Set note (PATCH)
        </button>{' '}
        <button type="button" id="remove" onClick={() => action('/items/:id?remove', { params: { id }, method: 'DELETE' })}>
          Remove (DELETE)
        </button>{' '}
        <button type="button" id="flash" onClick={() => action('/items/:id?flash', { params: { id } })}>
          Flash (shared data)
        </button>
      </p>
      <p>
        <Link href={`/items/${Number(id) + 1}`} id="next">
          Next item
        </Link>{' '}
        {/* View transitions are on for the app. This link turns them off */}
        <Link href="/items" id="back" viewTransition={false}>
          Back to the list
        </Link>
      </p>
    </div>
  )
}
