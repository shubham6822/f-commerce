# Prefetching the RSC Request — Is It Possible?

The last remaining network request when clicking a product is a **dynamic RSC (React Server Component) fetch**. This document explains what it is, why it exists, and every possible approach to eliminate or prefetch it.

---

## What Is the RSC Request?

When you click a product link, the Network tab shows one fetch like:

```
69ba42f4ed2bfd30420ab63b?_rsc=2wcm8
Content-Type: text/x-component
Cache-Control: private, no-cache, no-store
```

This is the **dynamic RSC payload** — the actual product data (name, price, images, specs, similar products) serialized in React's streaming format. It's the content that fills the "holes" in the PPR static shell.

---

## Why Does It Exist?

With PPR (Partial Prerendering), each page is split into two parts:

```
┌─────────────────────────────────────────┐
│   Static Shell (prefetched ✅)           │
│   ├── Layout, header, skeletons         │
│   └── Suspense fallbacks                │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  Dynamic Hole (NOT prefetched)  │   │
│   │  ├── Product data               │   │
│   │  ├── Similar products            │   │
│   │  └── Streamed on navigation     │   │
│   └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

`router.prefetch()` intentionally downloads **only the static shell + JS bundles**. It does NOT prefetch dynamic data because:

1. **Freshness** — Dynamic data could become stale between prefetch and click
2. **Personalization** — Dynamic content might be user-specific (auth, cart, etc.)
3. **Server load** — Prefetching dynamic data for every visible link would multiply server requests (most links are never clicked)

---

## Can We Prefetch It Like JS Bundles?

**Short answer: Not with `router.prefetch()` alone.** The public API doesn't support prefetching dynamic RSC data. But there are several workarounds, each with trade-offs.

---

## Approach 1: `generateStaticParams` (Recommended)

**How it works:** Pre-generate all product pages at build time. The entire RSC payload becomes static, so `router.prefetch()` downloads everything — including product data.

**What to do:**

Add `generateStaticParams` to the product page:

```tsx
// src/app/[productId]/page.tsx

import { getAllProductIds } from "@/actions/Product";

export async function generateStaticParams() {
  const ids = await getAllProductIds(); // returns ["id1", "id2", ...]
  return ids.map((id) => ({ productId: id }));
}
```

Add the data function:

```ts
// src/actions/Product.ts

export async function getAllProductIds(): Promise<string[]> {
  "use cache";
  cacheLife("days");
  cacheTag("products");
  await connectToDatabase();
  const products = await Product.find({}, { _id: 1 }).lean();
  return products.map((p) => String(p._id));
}
```

**What changes:**

| Before                               | After                               |
| ------------------------------------ | ----------------------------------- |
| `◐ /[productId]` (Partial Prerender) | `● /[productId]` (SSG with ISR)     |
| Prefetch = static shell only         | Prefetch = full page (shell + data) |
| 1 RSC fetch on click                 | **0 fetches on click**              |

**Trade-offs:**

| Pro                             | Con                                                |
| ------------------------------- | -------------------------------------------------- |
| Zero network requests on click  | Build time increases (generates page per product)  |
| Fully instant navigation        | New products need revalidation to appear           |
| Works with existing `use cache` | `generateStaticParams` must return ALL product IDs |

**Revalidation:** Since data functions already use `cacheLife("days")` and `cacheTag("products")`, pages auto-revalidate. For new products, you can call `revalidateTag("products")` from an admin action, or use a `revalidate` export:

```tsx
// src/app/[productId]/page.tsx
export const revalidate = 86400; // revalidate every 24 hours
```

**When a user visits a product NOT in `generateStaticParams`:** Next.js will SSR it on-demand and cache it for future visits (`dynamicParams` defaults to `true`). The first visitor gets the RSC fetch, but subsequent visitors (and prefetches) get the cached version.

---

## Approach 2: `staleTimes` Configuration

**How it works:** The Next.js Router Cache controls how long client-side cached RSC responses live. By default, dynamic pages have a cache lifetime of **0 seconds** — meaning every navigation re-fetches. Setting `staleTimes.dynamic` tells the router to reuse cached RSC responses.

**What to do:**

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    staleTimes: {
      dynamic: 30, // cache dynamic RSC responses for 30 seconds
      static: 300, // cache static RSC responses for 5 minutes (default)
    },
  },
};
```

**What this does:**

- After the **first** navigation to a product page, the RSC response is cached client-side for 30 seconds
- If the user navigates back and clicks the same product again within 30s, **no RSC fetch** happens
- Does **NOT** help for the very first click — the RSC fetch still happens once

**Trade-offs:**

| Pro                           | Con                                              |
| ----------------------------- | ------------------------------------------------ |
| Zero config in page files     | Only helps repeat visits within the stale window |
| No build time impact          | First click still has the RSC fetch              |
| Easy to tune (change seconds) | Stale data risk if product changes within window |

**Important:** This does NOT make `router.prefetch()` fetch dynamic data. It only caches the RSC response AFTER it's been fetched once.

---

## Approach 3: Remove Dynamic Holes (Full `use cache` Page)

**How it works:** If the page itself has no Suspense boundaries with async children, PPR treats the entire page as static. The prefetch then includes everything.

**What to do:**

Make the page component itself cached:

```tsx
// src/app/[productId]/page.tsx

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  "use cache";
  cacheLife("days");
  cacheTag("products");

  const { productId } = await params;
  const product = await getProductById(productId);
  if (!product) notFound();
  const similar = await getSimilarProducts(productId);

  return (
    <main className="min-h-screen bg-white">
      {/* render product directly — no Suspense */}
      <ProductContent product={product} />
      <SimilarProducts products={similar} />
    </main>
  );
}
```

**What changes:**

- No Suspense boundaries = no dynamic holes = no streaming
- The entire page output is cached and served as static
- `router.prefetch()` gets the full RSC payload

**Trade-offs:**

| Pro                       | Con                                                     |
| ------------------------- | ------------------------------------------------------- |
| Zero RSC fetches on click | Lose streaming (no instant skeleton)                    |
| Full page prefetched      | Page is all-or-nothing — user waits for everything      |
| Simple code (no Suspense) | If data is slow, user sees nothing until it's all ready |

**Not recommended** unless data fetching is extremely fast (<50ms). You lose the progressive loading UX that PPR provides.

---

## Approach 4: Client-Side Data Prefetching

**How it works:** Instead of relying on RSC streaming for product data, fetch it client-side using `fetch()` or a data library. Prefetch data when products enter the viewport.

**What to do:**

1. Create an API route that returns product data:

```ts
// src/app/api/products/[id]/route.ts
import { getProductById } from "@/actions/Product";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(product, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
```

2. Prefetch the data in NextLink's IntersectionObserver:

```ts
// Inside the observer callback, alongside router.prefetch():
fetch(`/api/products/${productId}`, { priority: "low" });
```

3. Use a client component on the product page that reads from the browser's HTTP cache.

**Trade-offs:**

| Pro                                | Con                                  |
| ---------------------------------- | ------------------------------------ |
| Data is warm in browser HTTP cache | Duplicates data fetching (RSC + API) |
| Works with existing PPR setup      | Adds API route maintenance           |
| Fine-grained control               | Complex architecture                 |

**Not recommended** — this fights against React Server Components instead of working with them.

---

## Approach 5: Service Worker Cache

**How it works:** A service worker intercepts RSC navigation requests and serves cached responses. You can proactively warm the cache by making RSC-format requests in the background.

**What to do:**

1. Register a service worker
2. In the service worker, intercept requests matching `?_rsc=`
3. When NextLink's observer fires, also trigger a background RSC fetch that the service worker caches
4. On actual navigation, the service worker serves from cache

**Trade-offs:**

| Pro                          | Con                                             |
| ---------------------------- | ----------------------------------------------- |
| Truly zero requests on click | Very complex to implement correctly             |
| Works with existing PPR      | RSC format is internal/undocumented — can break |
| No server changes needed     | Service worker adds startup latency             |

**Not recommended** — relying on Next.js internal RSC request format is fragile and will break across versions.

---

## Recommendation

| Approach                      | First Click      | Repeat Click     | Complexity | Recommended?         |
| ----------------------------- | ---------------- | ---------------- | ---------- | -------------------- |
| **1. `generateStaticParams`** | ✅ No RSC fetch  | ✅ No RSC fetch  | Low        | **Yes**              |
| **2. `staleTimes`**           | ❌ RSC fetch     | ✅ Cached        | Very Low   | For repeat visits    |
| **3. Full `use cache` page**  | ✅ No RSC fetch  | ✅ No RSC fetch  | Low        | Only if data is fast |
| **4. Client-side prefetch**   | ✅ Data in cache | ✅ Data in cache | High       | No                   |
| **5. Service Worker**         | ✅ From SW cache | ✅ From SW cache | Very High  | No                   |

### Best path forward:

**Combine Approach 1 + Approach 2:**

1. Use `generateStaticParams` to pre-generate product pages → eliminates RSC fetch on first click
2. Add `staleTimes.dynamic: 30` as a safety net → caches any dynamically rendered pages (e.g., new products not yet in `generateStaticParams`)

This gives you **truly zero network requests** on click for all products (first visit and repeat), while keeping the code simple and maintainable.

---

## Current State vs Target

```
CURRENT (PPR + prefetch):
  mouseDown → 0 JS downloads
            → 0 static shell requests
            → 1 RSC fetch (dynamic product data)  ← this one
            → images load
  Total: 1 fetch + images

TARGET (generateStaticParams + prefetch):
  mouseDown → 0 JS downloads
            → 0 RSC requests (everything was static + prefetched)
            → images load
  Total: 0 fetches + images only
```
