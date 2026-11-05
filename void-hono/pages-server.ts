// Server rendering for the Hono JSX adapter. Stands in for "@void/hono/pages-server".
import { jsx } from 'hono/jsx'
import type { Child } from 'hono/jsx'
import { createSsrRouter, idleNavigationState } from 'void/pages-client'
import { renderBodyAttrs, renderHeadToString, renderHtmlAttrs } from 'void/pages-head'
import type { PageObject } from 'void/pages-protocol'
import { islandFrontmatterScript, serializePageData } from 'void/pages-server'
import {
  ErrorsContext,
  FrontmatterContext,
  NavigationContext,
  ParamsContext,
  RouterContext,
  SharedContext,
} from './context.ts'

type PageModule = { default: (props: any) => Child; frontmatter?: Record<string, unknown> }
type AssetTags = { css: string; preloads: string; body: string }
type RenderInput = {
  pageObj: PageObject
  assetTags: AssetTags
  components: Record<string, () => Promise<PageModule>>
  layoutTree: Record<string, string[]>
}

async function loadPage({ pageObj, components, layoutTree }: RenderInput) {
  const pageModule = await components[pageObj.component]()
  const layouts = await Promise.all(
    (layoutTree[pageObj.component] || []).map(async (id) => (await components[id]()).default),
  )
  let element = jsx(pageModule.default, pageObj.props)
  for (let i = layouts.length - 1; i >= 0; i--) element = jsx(layouts[i], null, element)
  return { pageModule, element }
}

function withPageContexts(pageObj: PageObject, element: Child) {
  return jsx(
    SharedContext.Provider,
    { value: pageObj.shared || {} },
    jsx(
      ParamsContext.Provider,
      { value: pageObj.params ?? {} },
      jsx(ErrorsContext.Provider, { value: pageObj.errors || {} }, element),
    ),
  )
}

// Hono JSX returns a Promise when the tree has an async component
const renderToString = async (element: { toString(): string | Promise<string> }) =>
  String(await element.toString())

function document(pageObj: PageObject, head: string, body: string) {
  const headHtml = pageObj.head ? renderHeadToString(pageObj.head) : ''
  const htmlAttrs = pageObj.head ? renderHtmlAttrs(pageObj.head) : ''
  const bodyAttrs = pageObj.head ? renderBodyAttrs(pageObj.head) : ''
  return `<!doctype html>
<html${htmlAttrs}>
<head>${headHtml}${head}</head>
<body${bodyAttrs}>
  ${body}
</body>
</html>`
}

/** A regular page: rendered here, then hydrated and driven by the Void Router in the browser. */
export async function renderHonoPage(input: RenderInput & { requestUrl?: string }) {
  const { pageObj, assetTags, requestUrl } = input
  const { element } = await loadPage(input)
  const html = await renderToString(
    jsx(
      RouterContext.Provider,
      { value: createSsrRouter(pageObj.url || '/', pageObj.params ?? {}, requestUrl) },
      jsx(NavigationContext.Provider, { value: idleNavigationState() }, withPageContexts(pageObj, element)),
    ),
  )
  return document(
    pageObj,
    `${assetTags.css}${assetTags.preloads}`,
    `<script id="__VOID_PAGE_DATA__" type="application/json">${serializePageData(pageObj)}</script>
  <div id="app">${html}</div>
  ${assetTags.body}`,
  )
}

/** An island page or a Markdown page: static HTML, with JavaScript only for its islands. */
export async function renderHonoIslandPage(
  input: RenderInput & {
    mdClientScriptIds: Set<string>
    pagesNeedingClientJS: Set<string>
    isDev: boolean
  },
) {
  const { pageObj, assetTags, mdClientScriptIds, pagesNeedingClientJS, isDev } = input
  const { pageModule, element } = await loadPage(input)
  const frontmatter = pageModule.frontmatter ?? {}
  // No RouterContext: island pages have no Void Router.
  // Frontmatter wraps the layouts so they can read the Markdown page's values.
  const html = await renderToString(
    withPageContexts(pageObj, jsx(FrontmatterContext.Provider, { value: frontmatter }, element)),
  )
  const needsJS = pagesNeedingClientJS.has(pageObj.component)
  // In dev, load the Vite client on pages without islands too.
  // Without it the browser does not reload when a file changes
  const needsAssets = needsJS || isDev
  const frontmatterScript =
    needsJS && html.includes('data-island=') ? islandFrontmatterScript(pageModule.frontmatter) : ''
  const mdScriptAttr = mdClientScriptIds.has(pageObj.component)
    ? ` data-md-script="${escapeAttr(pageObj.component)}"`
    : ''
  return document(
    pageObj,
    `${assetTags.css}${needsAssets ? assetTags.preloads : ''}`,
    `<div id="app"${mdScriptAttr}>${html}</div>
  ${frontmatterScript}${needsAssets ? assetTags.body : ''}`,
  )
}

function escapeAttr(value: string) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
