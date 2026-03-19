# NextLink Component — Deep Dive

A custom `<Link>` wrapper that delivers **instant page navigations** by combining viewport-based prefetching, mouseDown navigation, and global deduplication. Inspired by the [NextFaster](https://github.com/ethanniser/NextFaster) project.

---

## Table of Contents

- [Why Not Just Use `<Link>`?](#why-not-just-use-link)
- [Architecture Overview](#architecture-overview)
- [How Each Piece Works](#how-each-piece-works)
  - [1. Global Prefetch Deduplication](#1-global-prefetch-deduplication)
  - [2. Viewport-Based Prefetching (IntersectionObserver)](#2-viewport-based-prefetching-intersectionobserver)
  - [3. Hover Fallback](#3-hover-fallback)
  - [4. mouseDown Navigation](#4-mousedown-navigation)
  - [5. Click Guard (Duplicate Prevention)](#5-click-guard-duplicate-prevention)
- [How It Integrates with PPR (Partial Prerendering)](#how-it-integrates-with-ppr-partial-prerendering)
- [Request Flow — What Happens on Click](#request-flow--what-happens-on-click)
- [Configuration & Props](#configuration--props)
- [Usage Example](#usage-example)

---

## Why Not Just Use `<Link>`?

Next.js's default `<Link>` component has its own prefetching, but it has limitations:

| Feature            | Default `<Link>`                       | `NextLink`                                |
| ------------------ | -------------------------------------- | ----------------------------------------- |
| Prefetch trigger   | Viewport entry (all links immediately) | Viewport entry **with 300ms debounce**    |
| Deduplication      | Per-component instance                 | **Global** across all instances           |
| Navigation trigger | `click` event                          | **`mouseDown`** event (~100-150ms faster) |
| Prefetch control   | `prefetch={true/false}`                | Same + controlled `router.prefetch()`     |

The default `<Link>` prefetches _every_ link that enters the viewport, even ones users scroll past in milliseconds. It also triggers navigation on `click`, which fires after `mouseDown` + `mouseUp` — wasting ~100-150ms.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Module-Level State                        │
│                                                              │
│  prefetchedRoutes = new Set<string>()  ← Global dedup Set   │
│  didMouseDown = false                  ← Navigation guard    │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    NextLink Component                         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  useEffect — IntersectionObserver                   │     │
│  │  • Watches link element enter viewport              │     │
│  │  • 300ms debounce before prefetching                │     │
│  │  • Calls router.prefetch(href)                      │     │
│  │  • Unobserves after prefetch                        │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  <Link prefetch={false}>                            │     │
│  │  • onMouseEnter → hover fallback prefetch           │     │
│  │  • onMouseDown  → immediate router.push()           │     │
│  │  • onClick      → prevent duplicate navigation      │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## How Each Piece Works

### 1. Global Prefetch Deduplication

```ts
const prefetchedRoutes = new Set<string>();
```

This `Set` lives **at module level**, outside the component. It is shared across every `<NextLink>` instance in the entire app. This means:

- If 20 product cards link to 20 different routes, each route is prefetched **only once**.
- If a user scrolls down, comes back up, and the same links re-enter the viewport, no duplicate prefetch fires.
- Even across different pages (since module state persists in the SPA client), already-prefetched routes are skipped.

**Why module-level instead of `useRef` or `useState`?**

- `useRef` / `useState` are per-component-instance — each `<NextLink>` would have its own tracking.
- Module-level state is a singleton shared across all instances for the lifetime of the client session.

---

### 2. Viewport-Based Prefetching (IntersectionObserver)

```ts
useEffect(() => {
  if (prefetch === false) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        timeout = setTimeout(() => {
          if (!prefetchedRoutes.has(hrefStr)) {
            prefetchedRoutes.add(hrefStr);
            router.prefetch(hrefStr); // ← downloads JS bundle + RSC payload
          }
          observer.unobserve(entry.target);
        }, 300);
      } else if (timeout) {
        clearTimeout(timeout);
      }
    },
    { rootMargin: "0px", threshold: 0.1 },
  );

  observer.observe(linkElement);
  return () => observer.disconnect();
}, [href, router, prefetch]);
```

**Step by step:**

1. An `IntersectionObserver` watches the link's DOM element.
2. When the element becomes **10% visible** (`threshold: 0.1`), a 300ms timer starts.
3. If the element is **still visible after 300ms**, we call `router.prefetch(href)`:
   - This tells Next.js to download the **JS bundle** (component code) and **RSC payload** (the static shell from PPR) for that route.
   - The browser caches these — so when the user clicks, there's nothing left to download.
4. If the element scrolls out of view before 300ms, the timer is cleared — **no wasted prefetch**.
5. After prefetching, we `unobserve` the element — it's done, no need to watch it anymore.

**Why 300ms debounce?**
Fast scrolling can cause dozens of links to flash through the viewport. Without debouncing, every single one would trigger a prefetch — wasting bandwidth and CPU. The 300ms delay ensures only links the user _actually pauses on_ get prefetched.

**Why `rootMargin: "0px"` and `threshold: 0.1`?**

- `rootMargin: "0px"` — no extra margin, prefetch starts exactly when the element enters the visible viewport.
- `threshold: 0.1` — fires when at least 10% of the element is visible. This catches partially-visible elements at the top/bottom of the screen.

---

### 3. Hover Fallback

```ts
onMouseEnter={() => {
  if (!prefetchedRoutes.has(hrefStr)) {
    prefetchedRoutes.add(hrefStr);
    router.prefetch(hrefStr);
  }
}}
```

If a link enters and leaves the viewport too quickly (before the 300ms debounce fires), the prefetch hasn't happened yet. When the user hovers over the link (showing intent to click), we prefetch immediately as a **fallback**.

This gives us two layers of defense:

1. **Viewport + debounce** — prefetch proactively for visible links
2. **Hover** — catch anything the viewport observer missed

The `prefetchedRoutes` check ensures we never double-prefetch.

---

### 4. mouseDown Navigation

```ts
onMouseDown={(e) => {
  const url = new URL(hrefStr, window.location.href);
  if (
    url.origin === window.location.origin &&
    e.button === 0 &&        // left click only
    !e.altKey &&              // no modifier keys
    !e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey
  ) {
    e.preventDefault();
    didMouseDown = true;
    router.push(hrefStr);
  }
}}
```

This is the biggest perceived performance win. Here's why:

**The browser click event timeline:**

```
mouseDown → [user holds ~80-120ms] → mouseUp → click
```

A normal `<Link>` navigates on `click`, which fires **after** `mouseUp`. By navigating on `mouseDown` instead, we skip the ~100-150ms delay between pressing and releasing the mouse button.

**Safety checks:**

- `url.origin === window.location.origin` — only for same-origin navigations (not external links)
- `e.button === 0` — left mouse button only
- No modifier keys (`ctrl`, `meta/cmd`, `alt`, `shift`) — these indicate "open in new tab" or other browser behaviors that we shouldn't override

**Why `e.preventDefault()`?**
Prevents the default anchor behavior so Next.js's client-side router handles the navigation instead of a full page load.

---

### 5. Click Guard (Duplicate Prevention)

```ts
let didMouseDown = false;

// In onMouseDown:
didMouseDown = true;
router.push(hrefStr);

// In onClick:
onClick={(e) => {
  if (didMouseDown) {
    e.preventDefault();
    didMouseDown = false;
  }
}}
```

**The problem:** When `mouseDown` fires `router.push()`, the browser still fires the `click` event afterwards. Next.js's `<Link>` handles `click` internally with its own navigation. This causes **two navigations** — duplicate RSC fetches, duplicate history entries.

**The solution:** A module-level `didMouseDown` flag.

1. `mouseDown` sets `didMouseDown = true` and calls `router.push()`.
2. When `click` fires, we check `didMouseDown` — if true, we `e.preventDefault()` to suppress Link's default click navigation.
3. Reset the flag immediately after.

**Why module-level instead of `useRef`?**
The `mouseDown` and `click` events fire on the same element synchronously. A module-level variable is simpler and avoids the overhead of a ref. Since only one element can be clicked at a time, there's no race condition.

---

## How It Integrates with PPR (Partial Prerendering)

This project uses **Partial Prerendering** via `cacheComponents: true` in `next.config.ts`. Here's how `NextLink` and PPR work together:

### What PPR Does

PPR splits each page into:

- **Static shell** — the layout, skeletons, and Suspense fallbacks. Pre-rendered at build time.
- **Dynamic holes** — content inside `<Suspense>` boundaries. Streamed at request time.

### The Prefetch + PPR Flow

```
1. Product card enters viewport
   │
   ▼
2. NextLink calls router.prefetch("/product-123")
   │
   ├── Downloads JS bundle (component code)
   └── Downloads static shell RSC payload (skeletons + layout)
       │
       ▼
3. Both are cached in the browser
   │
   ▼
4. User clicks (mouseDown) → router.push("/product-123")
   │
   ├── JS bundle?      → Already cached ✅ (no request)
   ├── Static shell?    → Already cached ✅ (no request)
   └── Dynamic content? → Single RSC fetch (streams product data)
       │
       ▼
5. User sees skeleton instantly, then product data streams in
```

**Result:** On click, the only network request is a single RSC fetch for the dynamic product data. Zero JS bundle downloads. Zero waiting for the page shell.

---

## Request Flow — What Happens on Click

### Before NextLink (default `<Link>`)

```
Click → Download JS chunks (2-3 requests)
      → Fetch RSC payload
      → Fetch images
      = 5-9 requests, visible loading delay
```

### After NextLink + PPR

```
mouseDown → Static shell rendered instantly (from prefetch cache)
          → 1 RSC fetch for dynamic product data (streams in)
          → Images load
          = 1 fetch request, instant skeleton, fast content
```

---

## Configuration & Props

```tsx
interface NextLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  prefetch?: boolean; // default: true
}
```

| Prop       | Type                  | Default    | Description                                                                          |
| ---------- | --------------------- | ---------- | ------------------------------------------------------------------------------------ |
| `href`     | `string \| UrlObject` | _required_ | The route to link to                                                                 |
| `prefetch` | `boolean`             | `true`     | Enable viewport-based prefetching. Set to `false` for links that are rarely clicked. |
| `children` | `ReactNode`           | _required_ | The link content                                                                     |
| `...props` | —                     | —          | All other props are forwarded to Next.js `<Link>`                                    |

**Note:** The underlying `<Link>` always has `prefetch={false}` set. This disables Next.js's built-in prefetching — `NextLink` handles all prefetching via `router.prefetch()` with its own deduplication and debouncing logic.

---

## Usage Example

```tsx
// In a server component (ProductList.tsx)
import NextLink from "@/components/NextLink";
import ProductCard from "@/components/products/ProductCard";

export default async function ProductList() {
  const products = await getProducts();

  return (
    <div className="grid grid-cols-4 gap-4">
      {products.map((product) => (
        <NextLink key={product.id} href={`/${product.id}`}>
          <ProductCard product={product} />
        </NextLink>
      ))}
    </div>
  );
}
```

Each `<NextLink>` will:

1. Watch its element in the viewport
2. After 300ms of visibility, prefetch the product page's JS + static shell
3. On hover (if not already prefetched), prefetch immediately
4. On mouseDown, navigate instantly via `router.push()`
5. On click, suppress duplicate navigation

---

## Key Design Decisions

| Decision                             | Why                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Module-level `Set` for dedup         | Singleton across all instances — prevents any duplicate prefetches globally |
| 300ms debounce                       | Prevents wasted prefetches during fast scrolling                            |
| `threshold: 0.1`                     | Catches links that are partially visible at screen edges                    |
| mouseDown over click                 | Saves ~100-150ms of perceived latency                                       |
| `prefetch={false}` on inner `<Link>` | Prevents Next.js default prefetching — we manage it ourselves               |
| Hover fallback                       | Catches links missed by the debounced observer                              |
| Module-level `didMouseDown` flag     | Simplest way to prevent duplicate navigation from mouseDown + click         |
