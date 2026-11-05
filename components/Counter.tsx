import { useState } from 'hono/jsx'
import { useFrontmatter } from '@void/md'

export default function Counter({ start = '0' }: { start?: string }) {
  const [count, setCount] = useState(Number(start))
  const fm = useFrontmatter()
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {String(fm.title ?? 'count')}: {count}
    </button>
  )
}
