import FeedbackForm from '../components/FeedbackForm' with { island: 'load' }
import type { Props } from './feedback.server'

// An island page: static HTML, and only the form is hydrated.
export default function Feedback({ comments }: Props) {
  return (
    <div>
      <h1>Feedback</h1>
      <FeedbackForm />
      <ul id="comments">
        {comments.map((comment) => (
          <li>{comment}</li>
        ))}
      </ul>
    </div>
  )
}
