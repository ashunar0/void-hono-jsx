import { useState } from 'hono/jsx'
import { fetch } from 'void/client'
import type { Props } from './fetch.server'

export default function TypedFetch({ fromLoader }: Props) {
  const [fromBrowser, setFromBrowser] = useState('')
  return (
    <div>
      <h1>Typed fetch</h1>
      <p id="from-loader">{fromLoader.greeting}</p>
      <button
        type="button"
        onClick={async () => {
          // The path, params and response type come from routes/api/greet/[name].ts
          const result = await fetch('/api/greet/:name', { params: { name: 'browser' } })
          setFromBrowser(`${result.greeting} (${result.length})`)
        }}
      >
        Call the API
      </button>
      <p id="from-browser">{fromBrowser}</p>
    </div>
  )
}
