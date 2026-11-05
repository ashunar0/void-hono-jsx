// Contexts shared by the server renderer, the browser runtime and the hooks.
import { createContext } from 'hono/jsx'
import type { NavigationState, VoidRouter } from 'void/pages-client'

export const RouterContext = createContext<VoidRouter | null>(null)
export const NavigationContext = createContext<NavigationState | null>(null)
export const ParamsContext = createContext<Record<string, string>>({})
export const SharedContext = createContext<Record<string, unknown>>({})
export const ErrorsContext = createContext<Record<string, string>>({})
export const FrontmatterContext = createContext<Record<string, unknown>>({})
