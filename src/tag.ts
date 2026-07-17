/* OkOvia Tag — the Google-Analytics-style drop-in loader
   (docs/product/okovia-tag-plan.md, phase 1).

   Install (the entire frontend integration):

     <script async src="https://okovia.com/js/okovia.js"
             data-key="vik_pub_XXXXXXXX"></script>

   On load it auto-initializes from data-* attributes, mints/restores
   anonymous and session ids, tracks a page_view per navigation
   (SPA-aware) with the feature inferred from the route, and exposes a
   gtag-style command queue:

     okovia("track", "document_summarized", { feature: "docs" });

   The queue works even before the script finishes loading — the
   snippet's `async` never loses events. Only client events are sent
   (public keys cannot submit usage/cost); project and workspace are
   derived server-side from the key. */

import { VikingClient } from "./client.js";
import {
  ANONYMOUS_ID_KEY,
  OPERATION_ID_HEADER,
  SESSION_ID_KEY,
  createOperationId,
  featureFromPath,
  getOrCreateId,
  parseCorrelatePaths,
  resolveTagConfig,
  shouldCorrelate,
} from "./tag-core.js";
import type { JsonValue, TrackProperties } from "./types.js";

type Command = [string, ...unknown[]];

interface OkoviaGlobal {
  (...args: unknown[]): void;
  q?: Command[];
}

declare global {
  interface Window {
    okovia?: OkoviaGlobal;
  }
}

(function initOkoviaTag() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const script = document.currentScript as HTMLScriptElement | null;
  const config = resolveTagConfig(script?.dataset);
  if (!config) {
    // No data-key: stay inert rather than throwing in the host page.
    console.warn("[okovia] missing data-key on the okovia.js script tag; tag disabled.");
    return;
  }

  const client = new VikingClient({
    publicKey: config.publicKey,
    endpoint: config.endpoint,
  });

  const anonymousId = getOrCreateId(safeStorage(() => window.localStorage), ANONYMOUS_ID_KEY);
  const sessionId = getOrCreateId(safeStorage(() => window.sessionStorage), SESSION_ID_KEY);

  function track(eventName: string, properties: Record<string, JsonValue | undefined> = {}): void {
    const merged: TrackProperties = {
      operationId:
        typeof properties.operationId === "string" && properties.operationId
          ? properties.operationId
          : createOperationId(),
      feature: typeof properties.feature === "string" ? properties.feature : featureFromPath(window.location.pathname),
      channel: "web",
      sessionId,
      anonymousId,
      ...properties,
    } as TrackProperties;
    client.track(eventName, merged);
  }

  function trackPageView(): void {
    track("page_view", {
      page_path: window.location.pathname,
      page_title: document.title || undefined,
      referrer: document.referrer || undefined,
    });
  }

  // gtag-style command queue: replay anything queued before load, then
  // process live calls synchronously.
  function handleCommand(...args: unknown[]): void {
    const [command, ...rest] = args as Command;
    if (command === "track") {
      const [eventName, properties] = rest as [string, Record<string, JsonValue | undefined>?];
      if (typeof eventName === "string" && eventName) {
        track(eventName, properties ?? {});
      }
      return;
    }
    if (command === "flush") {
      void client.flush();
    }
  }

  const queued = window.okovia?.q ?? [];
  const live: OkoviaGlobal = (...args: unknown[]) => handleCommand(...args);
  window.okovia = live;
  for (const command of queued) {
    handleCommand(...command);
  }

  // Page views: initial load + SPA navigations (history API + back/forward).
  trackPageView();
  const patchHistory = (method: "pushState" | "replaceState") => {
    const original = window.history[method].bind(window.history);
    window.history[method] = function patched(...args: Parameters<History["pushState"]>) {
      const result = original(...args);
      trackPageView();
      return result;
    };
  };
  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", trackPageView);

  // Phase 2 (opt-in): automatic browser->backend correlation. When the
  // snippet declares data-correlate="/api/ai,/chat", same-origin fetches
  // matching those path prefixes get an X-Okovia-Operation-Id header and
  // a client event carrying the product context, so backend usage
  // recorded under the same id joins into one operation.
  const correlatePaths = parseCorrelatePaths(script?.dataset.correlate);
  if (correlatePaths.length > 0 && typeof window.fetch === "function") {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!shouldCorrelate(url, window.location.origin, correlatePaths)) {
        return originalFetch(input, init);
      }

      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      );
      if (headers.has(OPERATION_ID_HEADER)) {
        return originalFetch(input, init);
      }

      const operationId = createOperationId();
      headers.set(OPERATION_ID_HEADER, operationId);
      track("operation_context", {
        operationId,
        request_path: new URL(url, window.location.origin).pathname,
      });
      return originalFetch(input, { ...init, headers });
    };
  }

  // Don't lose the tail of the session: flush when the page hides.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void client.flush();
    }
  });
})();

function safeStorage(getter: () => Storage): Storage | undefined {
  try {
    return getter();
  } catch {
    return undefined;
  }
}
