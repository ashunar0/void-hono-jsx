// Browser runtime for regular pages. Stands in for "@void/hono/pages-client".
// Void's router does the navigation; this file only renders what it hands over.
import { useLayoutEffect, useState } from 'hono/jsx'
import { hydrateRoot } from 'hono/jsx/dom/client'
import {
  createRouterFacade,
  createVoidRouter,
  idleNavigationState,
  type NavigationState,
  type VoidRouterConfig,
} from 'void/pages-client'
import type { PageObject } from 'void/pages-protocol'
import { ErrorsContext, NavigationContext, ParamsContext, RouterContext, SharedContext } from './context.ts'
import { setActionRouter } from './form.tsx'

export type HonoPagesConfig = Omit<VoidRouterConfig, 'adapter' | 'onRouteChange' | 'onNavigationChange'>

type View = { pageData: PageObject; component: any; layouts: any[]; key: number }

const EMPTY: Record<string, never> = {}
const currentUrl = () => window.location.pathname + window.location.search + window.location.hash
const sameParams = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

export async function startHonoPages(config: HonoPagesConfig) {
  const appEl = document.getElementById('app')
  if (!appEl) throw new Error('pages: Missing #app element for Void Hono pages hydration.')

  // Set once <App> has rendered
  let setView: ((update: (view: View) => View) => void) | null = null
  let setRouteUrl: ((url: string) => void) | null = null
  let setNavigation: ((navigation: NavigationState) => void) | null = null
  let onCommit: (() => void) | null = null

  const { router, initialPageData, initialComponent, initialLayouts, start, commitInitialRender } =
    await createVoidRouter({
      ...config,
      adapter: {
        // A deferred prop is `{ loading, value, error }`, as in Vue, Svelte and Solid
        createDeferred: () => ({ value: null, loading: true, error: null }),
        resolveDeferred: (_ref, value) => ({ value, loading: false, error: null }),
        rejectDeferred: (_ref, error) => ({ value: null, loading: false, error: new Error(error) }),
        isLoading: (ref) => (ref as { loading: boolean }).loading,
        // Resolves after the new page is in the DOM, so the router can restore scroll
        applyUpdate(pageData, component, layouts, { preserveState }) {
          return new Promise<void>((resolve) => {
            onCommit = resolve
            setView?.((view) => {
              // Back/forward preserves state, but another route or another record
              // needs a new page so that useForm() targets that route and record.
              const keep =
                preserveState &&
                view.component === component &&
                sameParams(view.pageData.params ?? EMPTY, pageData.params ?? EMPTY)
              // A new key remounts the page, which drops its state
              return { pageData, component, layouts, key: keep ? view.key : view.key + 1 }
            })
          })
        },
        // A deferred prop settled: render the page again with the new props
        onDeferredUpdate(props) {
          setView?.((view) => ({ ...view, pageData: { ...view.pageData, props: { ...props } } }))
        },
      },
      onRouteChange: (url) => setRouteUrl?.(url),
      onNavigationChange: (navigation) => setNavigation?.(navigation),
    })

  setActionRouter(createRouterFacade(router, currentUrl))

  function App() {
    const [view, updateView] = useState<View>({
      pageData: initialPageData,
      component: initialComponent,
      layouts: initialLayouts,
      key: 0,
    })
    const [routeUrl, updateRouteUrl] = useState(currentUrl())
    const [navigation, updateNavigation] = useState(idleNavigationState())
    setView = updateView
    setRouteUrl = updateRouteUrl
    setNavigation = updateNavigation

    useLayoutEffect(() => {
      commitInitialRender()
      appEl!.setAttribute('data-hydrated', 'true')
    }, [])
    useLayoutEffect(() => {
      onCommit?.()
      onCommit = null
    }, [view])

    const { pageData } = view
    // Stable fallbacks: useForm() compares the errors object by identity
    const params = pageData.params ?? EMPTY
    const Page = view.component
    let element = <Page key={view.key} {...pageData.props} />
    for (let i = view.layouts.length - 1; i >= 0; i--) {
      const Layout = view.layouts[i]
      element = <Layout>{element}</Layout>
    }

    return (
      <RouterContext.Provider value={createRouterFacade(router, () => routeUrl, () => params)}>
        <NavigationContext.Provider value={navigation}>
          <SharedContext.Provider value={pageData.shared ?? EMPTY}>
            <ParamsContext.Provider value={params}>
              <ErrorsContext.Provider value={pageData.errors ?? EMPTY}>{element}</ErrorsContext.Provider>
            </ParamsContext.Provider>
          </SharedContext.Provider>
        </NavigationContext.Provider>
      </RouterContext.Provider>
    )
  }

  hydrateRoot(appEl, <App />)
  start()
  return { router }
}
