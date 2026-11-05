import { Link, useRouter } from '@void/hono'
import type { Props } from './hello.server'

export default function Hello({ message, name, slow }: Props) {
  const router = useRouter()
  return (
    <div>
      <h1>Hello, {name}</h1>
      <p id="message">{message}</p>
      <p id="path">path: {router.path}</p>
      <p id="slow">{slow.loading ? 'Loading...' : slow.error ? slow.error.message : slow.value.text}</p>
      <p>
        <Link href="/plain">Back to /plain</Link>
      </p>
    </div>
  )
}
