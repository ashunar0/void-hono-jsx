import { Link } from '@void/hono'
import { useState } from 'hono/jsx'

// A regular page: rendered on the server, hydrated in the browser.
export default function Plain() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <h1>Plain page</h1>
      <button type="button" onClick={() => setCount(count + 1)}>
        clicked: {count}
      </button>
      <p>
        <Link href="/hello">Go to /hello</Link>
      </p>
    </div>
  )
}
