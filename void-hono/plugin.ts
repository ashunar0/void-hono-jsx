// Hono JSX adapter for Void (prototype), based on the @void/react plugin.
// Regular pages are hydrated and use the Void Router; island pages and
// Markdown pages are static HTML with hydrated islands.
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Plugin, ResolvedConfig, UserConfig } from 'vite'
import {
  createPagesPlugin,
  generateComponentManifest,
  resolvePagesDir,
  resolvePrefetchConfig,
  scanPages,
  type PageScanResult,
  type PagesPluginOptions,
} from 'void/pages'
import {
  ISLANDS_CLIENT_ENTRY_ID,
  ISLANDS_RENDERER_ID,
  computePagesNeedingClientJS,
  createIslandManifest,
  editIslandSource,
  findIslandImports,
  generateIslandClientEntry,
  islandCssFiles,
  islandStylesPlugin,
  islandsBuildConfig,
  mdClientScriptIds,
  recordIslandStyles,
  recordedIslandStyles,
  watchPagesForRescan,
} from 'void/pages-islands-plugin'

export type VoidHonoOptions = Pick<PagesPluginOptions, 'viewTransitions' | 'prefetch'>

const PAGES_CLIENT_ENTRY_ID = 'virtual:void-pages-client'
const WORKER_ENVIRONMENT_NAME = 'void_worker'
const COMPONENT_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js']
const HONO_SERVER_DEPS = ['hono/jsx', 'hono/jsx/jsx-runtime', 'hono/jsx/jsx-dev-runtime', 'hono/html']
const HONO_CLIENT_DEPS = [
  ...HONO_SERVER_DEPS,
  'hono/jsx/dom',
  'hono/jsx/dom/client',
  'hono/jsx/dom/jsx-runtime',
  'hono/jsx/dom/jsx-dev-runtime',
]

// The server renders with hono/jsx. The browser only needs hono/jsx/dom.
const CLIENT_ALIASES: Record<string, string> = {
  'hono/jsx': 'hono/jsx/dom',
  'hono/jsx/jsx-runtime': 'hono/jsx/dom/jsx-runtime',
  'hono/jsx/jsx-dev-runtime': 'hono/jsx/dom/jsx-dev-runtime',
}

function clientRuntimePlugin(): Plugin {
  return {
    name: 'void-hono:client-runtime',
    enforce: 'pre',
    resolveId(id, importer, options) {
      const target = CLIENT_ALIASES[id]
      if (!target || this.environment.config.consumer !== 'client') return
      return this.resolve(target, importer, { ...options, skipSelf: true })
    },
  }
}

// Mounts an island in the browser. Called by initIslands from void/pages-client.
const HYDRATE_ISLAND = `
async function hydrateIsland(el, mod, props, frontmatter) {
  const { jsx, useLayoutEffect } = await import("hono/jsx/dom");
  const { hydrateRoot } = await import("hono/jsx/dom/client");
  const Component = mod.default || mod;
  let island = jsx(Component, props);
  if (Object.keys(frontmatter).length > 0) {
    const { FrontmatterContext } = await import("@void/hono");
    island = jsx(FrontmatterContext.Provider, { value: frontmatter }, island);
  }
  function HydratedIsland() {
    useLayoutEffect(() => {
      el.setAttribute("data-hydrated", "true");
    }, []);
    return island;
  }
  hydrateRoot(el, jsx(HydratedIsland, {}));
}`

function pagesPlugin(pagesDir: string, root: string, options: VoidHonoOptions): Plugin {
  return createPagesPlugin(pagesDir, {
    // @void/md detects the adapter by this name (the patch adds "hono")
    name: 'void-hono:pages',
    root,
    generateRenderer(scan) {
      return `
import { renderHonoPage } from "@void/hono/pages-server";

${generateComponentManifest(scan, pagesDir)}

export async function renderPage(pageObj, assetTags, requestUrl) {
  return renderHonoPage({ pageObj, assetTags, components, layoutTree, requestUrl });
}
`
    },
    generateClient(scan, staticPageData) {
      const { defaultStrategy, hoverDelay, cacheFor } = resolvePrefetchConfig(options.prefetch)
      return `
import { startHonoPages } from "@void/hono/pages-client";
import { parseCacheFor } from "void/pages-prefetch";

${generateComponentManifest(scan, pagesDir)}

const { router } = await startHonoPages({
  components,
  layoutTree,
  routeMeta,
  matchRoute,
  staticPageData: ${!!staticPageData?.enabled},
  staticPageDataFastPath: ${!!staticPageData?.fastPath},
  viewTransitions: ${!!options.viewTransitions},
  prefetchHoverDelay: ${hoverDelay},
  prefetchDefaultCacheFor: parseCacheFor(${JSON.stringify(cacheFor)}),
  prefetchDefaultStrategy: ${JSON.stringify(defaultStrategy)},
});
export { router };
`
    },
    async config({ isDev, scan }) {
      const config: UserConfig = {
        oxc: { jsx: { runtime: 'automatic', importSource: 'hono/jsx' } },
        resolve: { dedupe: ['hono'] },
      }
      if (isDev) {
        // Pre-bundle the deps up front. A reload in the middle of a request
        // leaves two Context instances, and useFrontmatter() returns nothing.
        // The adapter is not pre-bundled, so it uses the same instances as the pages
        config.optimizeDeps = {
          exclude: ['@void/hono'],
          include: [...HONO_CLIENT_DEPS, 'void/pages-client', 'void/pages-prefetch'],
        }
        config.environments = {
          [WORKER_ENVIRONMENT_NAME]: {
            optimizeDeps: { exclude: ['@void/hono'], include: HONO_SERVER_DEPS },
          },
        }
      } else if ((await scan())?.pages.some((page) => !page.island)) {
        config.environments = {
          client: {
            build: {
              manifest: true,
              rollupOptions: { input: { 'pages-client': PAGES_CLIENT_ENTRY_ID } },
            },
          },
        }
      }
      return config
    },
  })
}

function generateIslandRenderer(
  scan: PageScanResult,
  pagesDir: string,
  mdScriptIds: Set<string>,
  pagesNeedingClientJS: Set<string>,
  isDev: boolean,
): string {
  return `
import { renderHonoIslandPage } from "@void/hono/pages-server";

${generateComponentManifest(scan, pagesDir)}
const mdClientScriptIds = new Set(${JSON.stringify([...mdScriptIds])});
const pagesNeedingClientJS = new Set(${JSON.stringify([...pagesNeedingClientJS])});

export async function renderIslandPage(pageObj, assetTags) {
  return renderHonoIslandPage({
    pageObj,
    assetTags,
    components,
    layoutTree,
    mdClientScriptIds,
    pagesNeedingClientJS,
    isDev: ${isDev},
  });
}
`
}

function islandsPlugin(pagesDir: string, root: string): Plugin[] {
  let pageScan: PageScanResult | null = null
  let isDev = false
  let resolvedConfig: ResolvedConfig | null = null
  let cssFiles = new Set<string>()
  const islandManifest = createIslandManifest(root, COMPONENT_EXTENSIONS)

  return [
    {
      name: 'void-hono:islands',
      configResolved(config) {
        resolvedConfig = config
        isDev = config.command === 'serve'
      },
      configureServer(server) {
        watchPagesForRescan(server, pagesDir, root, (scan) => {
          pageScan = scan
        })
      },
      async buildStart() {
        if (!existsSync(pagesDir)) return
        pageScan = await scanPages(root, { pagesDir, environment: isDev ? 'dev' : 'prod' })
        islandManifest.registerPages(pageScan, pagesDir)
        cssFiles = islandCssFiles(pageScan, pagesDir, /\.(tsx|jsx)$/)
      },
      buildEnd() {
        recordIslandStyles(this, pageScan, pagesDir)
      },
      resolveId: {
        filter: { id: /^virtual:void-islands-(renderer|client)$/ },
        handler(source) {
          if (source === ISLANDS_RENDERER_ID || source === ISLANDS_CLIENT_ENTRY_ID) return '\0' + source
        },
      },
      load: {
        filter: { id: /^\0virtual:void-islands-(renderer|client)$/ },
        handler(id) {
          if (id === '\0' + ISLANDS_RENDERER_ID) {
            if (!pageScan) return "export function renderIslandPage() { throw new Error('No pages found'); }"
            return generateIslandRenderer(
              pageScan,
              pagesDir,
              mdClientScriptIds(resolvedConfig),
              computePagesNeedingClientJS(pageScan, pagesDir, resolvedConfig),
              isDev,
            )
          }
          if (id === '\0' + ISLANDS_CLIENT_ENTRY_ID) {
            if (!pageScan) return ''
            return generateIslandClientEntry({
              manifest: islandManifest,
              cssFiles,
              styles: recordedIslandStyles(pagesDir),
              needsRuntime:
                islandManifest.entries.size > 0 ||
                computePagesNeedingClientJS(pageScan, pagesDir, resolvedConfig).size > 0,
              isDev,
              hydrateIsland: HYDRATE_ISLAND,
            })
          }
        },
      },
      // Replace `import X from './X' with { island: 'load' }` in *.island.tsx
      // with a wrapper that renders X inside a <div data-island>
      transform: {
        filter: { id: /\.island\.(tsx|jsx)$/ },
        handler(code, id) {
          const importerDir = dirname(id)
          const edits: { start: number; end: number; text: string }[] = []
          const wrappers: string[] = []
          let index = 0
          for (const islandImport of findIslandImports(code, id)) {
            const name = islandImport.importName
            const rawName = `_raw_island_${index++}`
            const { islandId } = islandManifest.register(islandImport.specifier, importerDir, islandImport.hydrate)
            edits.push({
              start: islandImport.start,
              end: islandImport.end,
              text: `import ${rawName} from ${islandImport.specifierRaw}`,
            })
            wrappers.push(
              `var ${name} = function ${name}(props) { return _jsx_island("div", { "data-island": ${JSON.stringify(islandId)}, "data-props": JSON.stringify(props), "data-hydrate": ${JSON.stringify(islandImport.hydrate)} }, _jsx_island(${rawName}, props)); };`,
            )
          }
          if (wrappers.length === 0) return
          return editIslandSource(code, edits, {
            prepend: 'import { jsx as _jsx_island } from "hono/jsx";\n',
            append: '\n' + wrappers.join('\n'),
          })
        },
      },
      async config(_, env) {
        if (env.command !== 'serve') return islandsBuildConfig(root, pagesDir)
      },
    },
    islandStylesPlugin(pagesDir),
  ]
}

export function voidHono(options: VoidHonoOptions = {}): Plugin[] {
  const root = process.cwd()
  const pagesDir = resolvePagesDir(root)
  return [clientRuntimePlugin(), pagesPlugin(pagesDir, root, options), ...islandsPlugin(pagesDir, root)]
}
