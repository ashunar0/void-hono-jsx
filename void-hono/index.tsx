// Runtime that stands in for "@void/hono". Pages, layouts and islands import from it.
import { useCallback, useContext, useEffect, useMemo, useRef } from 'hono/jsx'
import type { JSX, PropsWithChildren } from 'hono/jsx'
import {
  handleLinkClick,
  linkActiveAttributes,
  linkPendingAttributes,
  linkPrefetchStrategies,
  observeLinkVisible,
  prefetchLink,
  resolveLink,
  idleNavigationState,
  ssrProxy,
  type BaseLinkProps,
} from 'void/pages-client'
import type { CloudContextVariables } from 'void'
import { NavigationContext, ParamsContext, RouterContext, SharedContext } from './context.ts'

export * from './context.ts'
export { Form, action, setActionRouter, useForm, useIslandForm } from './form.tsx'
export type { FormProps, IslandFormReturn } from './form.tsx'
export { isCallSiteActionError, isVoidActionError, type VoidActionError } from 'void/pages-client'
// Like Vue, Svelte and Solid: a deferred prop is `{ loading, value, error }`
export type { DeferredState as Deferred, InferProps } from 'void'

export const useRouter = () => useContext(RouterContext) ?? ssrProxy
export const useNavigation = () => useContext(NavigationContext) ?? idleNavigationState()
export const useParams = <T extends Record<string, string> = Record<string, string>>() =>
  useContext(ParamsContext) as T
export const useShared = <T = CloudContextVariables['shared']>() => useContext(SharedContext) as T

type AnchorProps = Omit<JSX.IntrinsicElements['a'], keyof BaseLinkProps>
export type LinkProps = PropsWithChildren<BaseLinkProps & AnchorProps>

/**
 * Navigates with the Void Router on regular pages. On island pages there is no
 * router and no hydration, so it is a plain <a>.
 */
export function Link({
  href,
  method = 'GET',
  data,
  preserveScroll = false,
  preserveState = false,
  replace = false,
  reloadDocument = false,
  viewTransition,
  prefetch,
  cacheFor,
  activeMatch,
  onNavigate,
  children,
  ...rest
}: LinkProps) {
  const router = useContext(RouterContext)
  const navigation = useContext(NavigationContext)
  const elementRef = useRef<HTMLElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const link = useMemo(
    () => resolveLink({ href, method, data, prefetch, reloadDocument }),
    [href, method, data, prefetch, reloadDocument],
  )
  const strategies = useMemo(
    () => linkPrefetchStrategies({ prefetch, reloadDocument }, link, router?._prefetchDefaultStrategy),
    [prefetch, reloadDocument, link, router],
  )
  const doPrefetch = useCallback(() => prefetchLink(router, link.href, cacheFor), [router, link, cacheFor])
  const clearHoverTimer = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
  }

  useEffect(() => {
    if (strategies.length === 0) return
    if (strategies.includes('mount')) doPrefetch()
    const stopObserving =
      strategies.includes('visible') && elementRef.current
        ? observeLinkVisible(elementRef.current, doPrefetch)
        : null
    return () => {
      clearHoverTimer()
      stopObserving?.()
    }
  }, [doPrefetch, strategies])

  const handlers: Record<string, (event: any) => void> = {
    onClick: (event: MouseEvent) =>
      handleLinkClick(event, router, link, {
        data,
        preserveScroll,
        preserveState,
        replace,
        reloadDocument,
        viewTransition,
        onNavigate,
      }),
  }
  if (strategies.includes('hover')) {
    handlers.onMouseEnter = () => {
      clearHoverTimer()
      hoverTimer.current = setTimeout(doPrefetch, router?._hoverDelay ?? 75)
    }
    handlers.onMouseLeave = clearHoverTimer
    handlers.onFocus = doPrefetch
    handlers.onTouchStart = doPrefetch
  }
  if (strategies.includes('click')) {
    handlers.onMouseDown = doPrefetch
    handlers.onTouchStart = doPrefetch
  }

  const pendingAttributes = linkPendingAttributes(router, navigation, link)
  // Hono JSX prints `ref` as an attribute when it renders to a string
  const refProps = typeof document === 'undefined' ? {} : { ref: elementRef }
  if (!link.isGet) {
    return (
      <button {...refProps} type="button" {...pendingAttributes} {...(rest as object)} {...handlers}>
        {children}
      </button>
    )
  }
  return (
    <a
      {...refProps}
      href={String(link.href)}
      {...linkActiveAttributes(router, link, activeMatch)}
      {...pendingAttributes}
      {...rest}
      {...handlers}
    >
      {children}
    </a>
  )
}
