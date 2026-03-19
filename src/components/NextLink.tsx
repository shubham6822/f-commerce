"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef } from "react";

// Global tracking — shared across all NextLink instances to avoid duplicate prefetches
const prefetchedRoutes = new Set<string>();
const prefetchedImages = new Set<string>();

// Track if we already navigated via mouseDown to prevent Link's click from duplicating
let didMouseDown = false;

export default function NextLink({
  children,
  href,
  prefetch = true,
  ...props
}: React.ComponentPropsWithoutRef<typeof Link> & { prefetch?: boolean }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (prefetch === false) return;

    const linkElement = linkRef.current;
    if (!linkElement) return;
    const hrefStr = String(href);

    let timeout: NodeJS.Timeout | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          // 300ms debounce — skip links that are just scrolled past quickly
          timeout = setTimeout(() => {
            if (!prefetchedRoutes.has(hrefStr)) {
              prefetchedRoutes.add(hrefStr);

              // Prefetch JS bundle + RSC payload for instant navigation
              router.prefetch(hrefStr);
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
            }
            observer.unobserve(entry.target);
          }, 300);
        } else if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
      },
      { rootMargin: "0px", threshold: 0.1 },
    );

    observer.observe(linkElement);

    return () => {
      observer.disconnect();
      if (timeout) clearTimeout(timeout);
    };
  }, [href, router, prefetch]);

  const hrefStr = String(href);

  return (
    <Link
      href={href}
      prefetch={false}
      ref={linkRef}
      onMouseEnter={() => {
        if (!prefetchedRoutes.has(hrefStr)) {
          prefetchedRoutes.add(hrefStr);
          router.prefetch(hrefStr);
          // Prefetch images on hover too
          const imagesAttr = linkRef.current?.getAttribute("data-images");
          if (imagesAttr) {
            try {
              const images: string[] = JSON.parse(imagesAttr);
              images.forEach((src) => prefetchImage(src));
            } catch {
              /* ignore */
            }
          }
        }
      }}
      onMouseDown={(e) => {
        // Navigate on mouseDown instead of click — saves ~100-150ms
        const url = new URL(hrefStr, window.location.href);
        if (
          url.origin === window.location.origin &&
          e.button === 0 &&
          !e.altKey &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.shiftKey
        ) {
          e.preventDefault();
          didMouseDown = true;
          router.push(hrefStr);
        }
      }}
      onClick={(e) => {
        // Prevent Link's default click handler from firing a duplicate router.push
        if (didMouseDown) {
          e.preventDefault();
          didMouseDown = false;
        }
      }}
      {...props}
    >
      {children}
    </Link>
  );
}

const PREFETCH_WIDTHS = [640, 64, 750];

function prefetchImage(rawSrc: string, quality: number = 75) {
  for (const width of PREFETCH_WIDTHS) {
    const optimizedUrl = `/_next/image?url=${encodeURIComponent(rawSrc)}&w=${width}&q=${quality}`;
    if (prefetchedImages.has(optimizedUrl)) continue;
    prefetchedImages.add(optimizedUrl);

    const img = new Image();
    img.decoding = "async";
    img.fetchPriority = "high";
    img.src = optimizedUrl;
  }
}
