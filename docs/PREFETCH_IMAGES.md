# Prefetching Product Images — How To Guide

Currently, when a user clicks a product, images start downloading **after** navigation. This guide explains how to prefetch product page images **while the product is in the viewport** — so by the time the user clicks, images are already in the browser cache.

---

## Table of Contents

- [The Problem](#the-problem)
- [Approach 1: Data Attribute + `new Image()` (Simple)](#approach-1-data-attribute--new-image-simple)
- [Approach 2: API Route + linkedom (NextFaster Style)](#approach-2-api-route--linkedom-nextfaster-style)
- [Approach 3: Server Component Data Prop (No API)](#approach-3-server-component-data-prop-no-api)
- [Comparison](#comparison)

---

## The Problem

Current flow when user clicks a product:

```
mouseDown → router.push("/product-123")
         → JS bundle?      Already cached ✅
         → Static shell?    Already cached ✅
         → RSC data?        Already cached ✅ (with generateStaticParams)
         → Product images?  ❌ START DOWNLOADING NOW (slow)
```

Product detail pages have 4-5 images (gallery + thumbnails). These are the last bottleneck for a truly instant experience.

**Goal:** When a product card enters the viewport, prefetch its detail page images alongside the JS bundle — so images are in the browser's HTTP cache before the user clicks.

---

## Approach 1: Data Attribute + `new Image()` (Simple)

The simplest approach. Pass the product's image URLs as a data attribute on the `<NextLink>`, then prefetch them in the IntersectionObserver.

### Step 1: Pass image URLs to NextLink

In `ProductList.tsx`, pass image URLs via a `data-images` attribute:

```tsx
// src/components/products/ProductList.tsx

{
  products.map((product, index) => (
    <NextLink
      key={product.id}
      href={`/${product.id}`}
      data-images={JSON.stringify(product.image.slice(0, 5))} // first 5 images
    >
      <ProductCard product={product} index={index} />
    </NextLink>
  ));
}
```

### Step 2: Update NextLink to prefetch images

Add image prefetching inside the IntersectionObserver callback:

```tsx
// src/components/NextLink.tsx

// Add a global Set to track prefetched images (like prefetchedRoutes)
const prefetchedImages = new Set<string>();

function prefetchImage(src: string) {
  if (prefetchedImages.has(src)) return;
  prefetchedImages.add(src);

  const img = new Image();
  img.decoding = "async";
  img.fetchPriority = "low";
  img.src = src;
}
```

Inside the `useEffect` observer callback, after `router.prefetch()`:

```tsx
// After router.prefetch(hrefStr):
router.prefetch(hrefStr);

// Prefetch product images
const imagesAttr = linkElement.getAttribute("data-images");
if (imagesAttr) {
  try {
    const images: string[] = JSON.parse(imagesAttr);
    images.forEach((src) => prefetchImage(src));
  } catch {
    /* ignore parse errors */
  }
}
```

Also add image prefetching in the `onMouseEnter` handler (hover fallback):

```tsx
onMouseEnter={() => {
  if (!prefetchedRoutes.has(hrefStr)) {
    prefetchedRoutes.add(hrefStr);
    router.prefetch(hrefStr);
  }
  // Prefetch images on hover too
  const imagesAttr = linkRef.current?.getAttribute("data-images");
  if (imagesAttr) {
    try {
      const images: string[] = JSON.parse(imagesAttr);
      images.forEach((src) => prefetchImage(src));
    } catch { /* ignore */ }
  }
}}
```

### How it works

```
Product card enters viewport
  │
  ├── router.prefetch("/product-123")  → JS + RSC cached
  └── new Image().src = "image1.jpg"   → Image cached in HTTP cache
      new Image().src = "image2.jpg"   → Image cached in HTTP cache
      ...
  │
  ▼
User clicks product
  │
  ├── JS bundle?    → Already cached ✅
  ├── RSC data?     → Already cached ✅
  └── Images?       → Already in browser HTTP cache ✅ (instant render)
```

### Trade-offs

| Pro                   | Con                                                       |
| --------------------- | --------------------------------------------------------- |
| No API route needed   | Raw image URLs, not Next.js optimized `/_next/image` URLs |
| Simple implementation | `data-images` clutters the DOM                            |
| Works immediately     | Only prefetches images you already have URLs for          |

### Important: Next.js `<Image>` vs Raw URLs

The product card and detail page use `next/image`, which serves optimized images via `/_next/image?url=...&w=...&q=...`. Prefetching the **raw** image URL (e.g., `https://cdn.example.com/photo.jpg`) won't help because the browser will still need to fetch the **optimized** version.

**To make this work properly**, you need to prefetch the Next.js optimized URL:

```tsx
function prefetchImage(
  rawSrc: string,
  width: number = 640,
  quality: number = 75,
) {
  const optimizedUrl = `/_next/image?url=${encodeURIComponent(rawSrc)}&w=${width}&q=${quality}`;
  if (prefetchedImages.has(optimizedUrl)) return;
  prefetchedImages.add(optimizedUrl);

  const img = new Image();
  img.decoding = "async";
  img.fetchPriority = "low";
  img.src = optimizedUrl;
}
```

The `width` and `quality` must match what the product detail page's `<Image>` component requests. Check the `sizes` prop on the product page's `<Image>`:

- Product detail page uses: `sizes="(max-width: 640px) 100vw, 640px"` → prefetch width `640`
- If your `<Image>` doesn't set `sizes`, Next.js defaults to the device width

You can find the exact URL by inspecting the Network tab on a product page — look at the `/_next/image` request and note the `w` and `q` parameters.

---

## Approach 2: API Route + linkedom (NextFaster Style)

This is how the NextFaster project does it. Create an API route that fetches a page's HTML, parses it, and returns the image `srcset`/`src` attributes.

### Step 1: Install linkedom

```bash
pnpm add linkedom
```

### Step 2: Create the API route

```ts
// src/app/api/prefetch-images/[...rest]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { parseHTML } from "linkedom";

export const dynamic = "force-static";

function getHostname() {
  if (process.env.NODE_ENV === "development") {
    return "localhost:3000";
  }
  // For Vercel:
  // return process.env.VERCEL_PROJECT_PRODUCTION_URL;
  // For other hosts, set your domain:
  return process.env.SITE_URL || "localhost:3000";
}

type PrefetchImage = {
  srcset: string | null;
  sizes: string | null;
  src: string | null;
  alt: string | null;
  loading: string | null;
};

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ rest: string[] }> },
) {
  const schema = process.env.NODE_ENV === "development" ? "http" : "https";
  const host = getHostname();
  if (!host) {
    return new Response("Failed to get hostname", { status: 500 });
  }

  const { rest } = await params;
  const href = rest.join("/");
  if (!href) {
    return new Response("Missing url parameter", { status: 400 });
  }

  const url = `${schema}://${host}/${href}`;
  const response = await fetch(url);
  if (!response.ok) {
    return new Response("Failed to fetch", { status: response.status });
  }

  const body = await response.text();
  const { document } = parseHTML(body);

  // Extract all images inside <main>
  const images: PrefetchImage[] = Array.from(
    document.querySelectorAll("main img"),
  )
    .map((img) => ({
      srcset: img.getAttribute("srcset") || img.getAttribute("srcSet"),
      sizes: img.getAttribute("sizes"),
      src: img.getAttribute("src"),
      alt: img.getAttribute("alt"),
      loading: img.getAttribute("loading"),
    }))
    .filter((img) => img.src);

  return NextResponse.json(
    { images },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    },
  );
}
```

### Step 3: Add image prefetch logic to NextLink

```tsx
// src/components/NextLink.tsx — add these at module level

type PrefetchImage = {
  srcset: string;
  sizes: string;
  src: string;
  alt: string;
  loading: string;
};

const imageCache = new Map<string, PrefetchImage[]>();
const seenImages = new Set<string>();

async function fetchAndCacheImages(href: string) {
  if (imageCache.has(href)) return;
  // Skip home page, order pages, etc.
  if (!href.startsWith("/") || href === "/") return;

  try {
    const response = await fetch(`/api/prefetch-images${href}`, {
      priority: "low",
    });
    if (!response.ok) return;
    const { images } = await response.json();
    imageCache.set(href, images as PrefetchImage[]);
  } catch {
    /* silently fail — image prefetch is best-effort */
  }
}

function prefetchImage(image: PrefetchImage) {
  // Skip lazy-loaded images (below the fold)
  if (image.loading === "lazy") return;
  const key = image.srcset || image.src;
  if (!key || seenImages.has(key)) return;
  seenImages.add(key);

  const img = new Image();
  img.decoding = "async";
  img.fetchPriority = "low";
  if (image.srcset) img.srcset = image.srcset;
  if (image.sizes) img.sizes = image.sizes;
  img.src = image.src;
}
```

### Step 4: Call from IntersectionObserver

Inside the observer callback, after `router.prefetch()`:

```tsx
router.prefetch(hrefStr);

// Fire-and-forget image prefetch
void fetchAndCacheImages(hrefStr);
```

Inside `onMouseEnter`, apply cached images:

```tsx
onMouseEnter={() => {
  router.prefetch(hrefStr);

  // Apply cached images (fetched during viewport observation)
  const images = imageCache.get(hrefStr) || [];
  for (const image of images) {
    prefetchImage(image);
  }
}}
```

### How it works

```
Product card enters viewport
  │
  ├── router.prefetch("/product-123")         → JS + RSC cached
  └── fetch("/api/prefetch-images/product-123") → Returns image list
      └── Images stored in imageCache Map (not downloaded yet)
  │
  ▼
User hovers over product card
  │
  └── imageCache.get("/product-123") → found!
      ├── new Image().srcset = "/_next/image?..."  → Optimized image downloaded
      ├── new Image().srcset = "/_next/image?..."  → Optimized image downloaded
      └── ...
  │
  ▼
User clicks (mouseDown)
  │
  ├── JS bundle?    → Already cached ✅
  ├── RSC data?     → Already cached ✅
  └── Images?       → Already in browser cache ✅
```

### Why image download is on hover, not viewport

NextFaster fetches the image **list** on viewport (cheap JSON response), but downloads the actual image **pixels** on hover. This is intentional:

- **Viewport**: User might scroll past 50 products. Downloading all their images wastes bandwidth.
- **Hover**: User is likely about to click. Download images now (~200ms before click).
- Between hover and mouseDown, the browser typically has enough time to fetch the hero image.

### Trade-offs

| Pro                                              | Con                                               |
| ------------------------------------------------ | ------------------------------------------------- |
| Prefetches exact Next.js optimized images        | Requires `linkedom` dependency                    |
| Gets `srcset` so browser picks right resolution  | API route makes internal fetch to your own server |
| Matches NextFaster's production-proven pattern   | Extra API route to maintain                       |
| Image list cached, actual download only on hover | Doesn't work in development without extra setup   |

---

## Approach 3: Server Component Data Prop (No API)

Pass optimized image URLs directly from the server component, avoiding any API route or DOM parsing.

### Step 1: Create a helper to build optimized URLs

```ts
// src/lib/image-utils.ts

export function getOptimizedImageUrl(
  src: string,
  width: number = 640,
  quality: number = 75,
): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}
```

### Step 2: Pass image URLs from ProductList (server component)

```tsx
// src/components/products/ProductList.tsx
import { getOptimizedImageUrl } from "@/lib/image-utils";

// In the render:
{
  products.map((product, index) => {
    // Build the optimized URLs that the product detail page will use
    const prefetchUrls = product.image
      .slice(0, 3) // first 3 images only
      .map((src) => getOptimizedImageUrl(src, 640, 75));

    return (
      <NextLink
        key={product.id}
        href={`/${product.id}`}
        prefetchImages={prefetchUrls} // new prop
      >
        <ProductCard product={product} index={index} />
      </NextLink>
    );
  });
}
```

### Step 3: Accept and use `prefetchImages` prop in NextLink

```tsx
// src/components/NextLink.tsx

const prefetchedImages = new Set<string>();

function prefetchImage(src: string) {
  if (prefetchedImages.has(src)) return;
  prefetchedImages.add(src);

  const img = new Image();
  img.decoding = "async";
  img.fetchPriority = "low";
  img.src = src;
}

export default function NextLink({
  children,
  href,
  prefetch = true,
  prefetchImages: imageUrls, // new prop
  ...props
}: React.ComponentPropsWithoutRef<typeof Link> & {
  prefetch?: boolean;
  prefetchImages?: string[];
}) {
  // Inside the useEffect observer callback, after router.prefetch():
  // if (imageUrls?.length) {
  //   imageUrls.forEach(prefetchImage);
  // }
  // Inside onMouseEnter:
  // if (imageUrls?.length) {
  //   imageUrls.forEach(prefetchImage);
  // }
}
```

### How it works

```
Server renders ProductList
  │
  ├── Builds optimized image URLs: /_next/image?url=...&w=640&q=75
  └── Passes them as a prop to NextLink
  │
  ▼
Product card enters viewport
  │
  ├── router.prefetch("/product-123")           → JS + RSC cached
  └── new Image().src = "/_next/image?url=..."  → Optimized image downloaded
      new Image().src = "/_next/image?url=..."  → Optimized image downloaded
  │
  ▼
User clicks (mouseDown)
  │
  ├── JS?      → Cached ✅
  ├── RSC?     → Cached ✅
  └── Images?  → Cached ✅
```

### Trade-offs

| Pro                                                  | Con                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------- |
| No API route, no dependencies                        | Must manually match `width`/`quality` to product page's `<Image>`   |
| Server-computed URLs (no client JS for URL building) | If product page changes image sizes, must update here too           |
| Images download on viewport (most aggressive)        | More bandwidth — images download even for products user won't click |
| Type-safe prop                                       | Only works where you have image URLs in the parent                  |

### Important caveat

The `width` (640) and `quality` (75) in `getOptimizedImageUrl` must match the values that the product detail page's `<Image>` component resolves to. If they don't match, the browser will cache the wrong size and still need to fetch the correct one on the product page.

To find the exact values:

1. Open a product page in production
2. Open DevTools → Network → Img
3. Look at the `/_next/image` request URL
4. Note the `w` and `q` parameters

---

## Comparison

|                               | Approach 1: Data Attribute | Approach 2: API + linkedom | Approach 3: Server Prop           |
| ----------------------------- | -------------------------- | -------------------------- | --------------------------------- |
| **Complexity**                | Low                        | High                       | Medium                            |
| **Dependencies**              | None                       | `linkedom`                 | None                              |
| **API route needed**          | No                         | Yes                        | No                                |
| **Gets exact optimized URLs** | Must construct manually    | Yes (parses actual HTML)   | Must construct manually           |
| **When images download**      | Viewport (aggressive)      | Hover (conservative)       | Viewport (aggressive)             |
| **Bandwidth usage**           | Higher                     | Lower (hover-only)         | Higher                            |
| **NextFaster approach**       | No                         | Yes                        | No                                |
| **Maintenance**               | Low                        | Medium                     | Low (but fragile if sizes change) |

### Recommendation

| Scenario                                  | Best Approach                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Simple, few products                      | **Approach 1** (data attributes) — minimal code, works fine             |
| Production e-commerce, many products      | **Approach 2** (NextFaster style) — hover-only download saves bandwidth |
| Full control, server components available | **Approach 3** (server prop) — no extra deps, type-safe                 |

**Bandwidth note:** Approach 2 (NextFaster style) is the most bandwidth-efficient because it only downloads actual image pixels on **hover**, not for every product that scrolls into view. For a page with 20+ products visible, this saves significant data transfer.
