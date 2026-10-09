/**
 * tlogs — browser-side entry (exported as "./client"), bundled by scripts/build-client.mjs into the
 * self-contained lib/client.js in DSH's module convention:
 *
 *   window.__ModuleLoader__.load({ id: "dsh-tlogs", factory: (require) => { ... } })
 *
 * Constraints from dsh-client-modules: the entry bundle must be self-contained and must not require
 * sibling client*.js products; inside the factory only the platform seed table resolves (React is in
 * it), so every other dependency has to be bundled — hence the single require("react") and JSX
 * compiled to h(...) (see src/client/h.ts).
 *
 * Mount point: the `sidebar.footer.action` seat in the sidebar footer, rendered by SidebarRoot with
 * kind `list` and scope `root`, so the registration takes one whole list entry and the component lays
 * out in normal document flow (no position: fixed/absolute). Registration goes through
 * `ctx.slots.inject(name, cb)`: it waits for the seat declaration, drops the contribution when the
 * seat is collapsed and re-adds it when the seat comes back.
 */

import { installStyles } from './styles.js'
import { TlogsFooter } from './footer.js'
import { makeRpc, type Rpc } from './api.js'

/** Client-side services actually used; keeping the list minimal limits what the plugin can touch. */
export const inject = ['connection', 'slots']

export interface TlogsClientContext {
  connection?: unknown
  slots?: {
    inject?: (name: string, cb: () => unknown) => unknown
    register?: (options: Record<string, unknown>, component: unknown) => unknown
  }
  effect?: (fn: () => unknown, label?: string) => unknown
  get?: (name: string) => unknown
  [key: string]: unknown
}

export const FOOTER_SLOT = 'sidebar.footer.action'

/** Registration id; unique within the list seat. */
export const SLOT_ITEM_ID = 'tlogs'

export function apply(ctx: TlogsClientContext): void {
  // Styles follow the plugin lifecycle (same convention as ui-theme's installThemeStyles).
  const removeStyles = installStyles()
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => removeStyles(), 'tlogs: stylesheet')
  }

  const slots = ctx.slots
  if (typeof slots?.inject !== 'function' || typeof slots?.register !== 'function') {
    // Without slot support, exit quietly: the plugin should still load on a host
    // that has no ui-slots.
    return
  }

  const rpc: Rpc | undefined = makeRpc(ctx as Parameters<typeof makeRpc>[0])

  slots.inject(FOOTER_SLOT, () =>
    slots.register!(
      {
        name: FOOTER_SLOT,
        id: SLOT_ITEM_ID,
        // Business share: non-slot props injected into the component. Display
        // config arrives through the host's snapshot.display, since the client
        // cannot read the plugin's own cordis config.
        inject: () => ({ rpc }),
      },
      TlogsFooter,
    ),
  )
}
