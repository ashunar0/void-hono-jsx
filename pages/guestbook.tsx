import { Form, action, useForm } from '@void/hono'
import type { Props } from './guestbook.server'

export default function Guestbook({ entries }: Props) {
  const form = useForm('/guestbook?default', { name: '', message: '' }, { resetOnSuccess: true })
  return (
    <div>
      <h1>Guestbook</h1>
      <Form form={form}>
        <p>
          <input
            name="name"
            placeholder="Name"
            value={String(form.data.name)}
            onInput={(event: Event) => form.setData('name', (event.target as HTMLInputElement).value)}
          />
          {form.errors.name && <span id="name-error"> {form.errors.name}</span>}
        </p>
        <p>
          <input
            name="message"
            placeholder="Message"
            value={String(form.data.message)}
            onInput={(event: Event) => form.setData('message', (event.target as HTMLInputElement).value)}
          />
        </p>
        <button type="submit" disabled={form.pending}>
          Sign
        </button>
        {form.recentlySuccessful && <span id="saved"> Saved</span>}
      </Form>
      <ul id="entries">
        {entries.map((entry) => (
          <li>
            {entry.name}: {entry.message}
          </li>
        ))}
      </ul>
      <button type="button" id="clear" onClick={() => action('/guestbook?clear')}>
        Clear
      </button>
    </div>
  )
}
