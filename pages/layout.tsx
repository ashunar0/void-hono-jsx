import '@void/md/theme.css'
import { Link, useShared } from '@void/hono'
import { useFrontmatter } from '@void/md'
import pages from '@void/md/pages'
import type { PropsWithChildren } from 'hono/jsx'

export default function Layout({ children }: PropsWithChildren) {
  const fm = useFrontmatter()
  const shared = useShared()
  return (
    <div style="display:flex;gap:2rem;max-width:960px;margin:0 auto;padding:2rem">
      <nav style="min-width:180px">
        <ul style="list-style:none;padding:0">
          {pages.map((page) => (
            <li>
              <Link href={page.path}>{page.title}</Link>
            </li>
          ))}
          <li>
            <Link href="/counter">Counter (island page)</Link>
          </li>
          <li>
            <Link href="/plain">Plain (regular page)</Link>
          </li>
          <li>
            <Link href="/hello">Hello (regular page)</Link>
          </li>
          <li>
            <Link href="/guestbook">Guestbook (form)</Link>
          </li>
          <li>
            <Link href="/feedback">Feedback (island form)</Link>
          </li>
          <li>
            <Link href="/fetch">Typed fetch</Link>
          </li>
          <li>
            {/* Stays marked on /items/1, /items/2, ... */}
            <Link href="/items" activeMatch="prefix">
              Items (dynamic routes)
            </Link>
          </li>
          <li>
            <Link href="/upload">Upload</Link>
          </li>
        </ul>
        <p id="shared">
          {shared.site} · {shared.path}
        </p>
        {shared.flash && <p id="flash">{shared.flash}</p>}
      </nav>
      <main class="void-md" data-page-title={String(fm.title ?? '')}>
        {children}
      </main>
    </div>
  )
}
