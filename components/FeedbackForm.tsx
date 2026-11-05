import { useIslandForm } from '@void/hono'

export default function FeedbackForm() {
  const form = useIslandForm({ comment: '' })
  return (
    <form
      onSubmit={(event: Event) => {
        event.preventDefault()
        return form.post('/feedback')
      }}
    >
      <input
        name="comment"
        placeholder="Comment"
        value={form.data.comment}
        onInput={(event: Event) => form.setData('comment', (event.target as HTMLInputElement).value)}
      />
      {form.errors.comment && <span id="comment-error"> {form.errors.comment}</span>}
      <button type="submit" disabled={form.pending}>
        Send
      </button>
    </form>
  )
}
