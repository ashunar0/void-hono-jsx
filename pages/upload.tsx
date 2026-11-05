import { Form, useForm } from '@void/hono'
import type { Props } from './upload.server'

export default function Upload({ last }: Props) {
  // A File in the form data makes useForm() send multipart/form-data
  const form = useForm('/upload', { title: '', file: null as File | null })
  return (
    <div>
      <h1>Upload</h1>
      <Form form={form}>
        <input
          name="title"
          placeholder="Title"
          value={String(form.data.title)}
          onInput={(event: Event) => form.setData('title', (event.target as HTMLInputElement).value)}
        />
        <input
          type="file"
          name="file"
          onChange={(event: Event) => form.setData('file', (event.target as HTMLInputElement).files?.[0] ?? null)}
        />
        <button type="submit" disabled={form.pending}>
          Upload
        </button>
        {form.errors.file && <span id="file-error"> {form.errors.file}</span>}
      </Form>
      {last && (
        <p id="last">
          {last.title}: {last.name} ({last.size} bytes) "{last.head}"
        </p>
      )}
    </div>
  )
}
