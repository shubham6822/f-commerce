"use client";

import Image from "next/image";
import { useState } from "react";

interface ProductImageGalleryProps {
  images: string[];
  name: string;
}

export default function ProductImageGallery({
  images,
  name,
}: ProductImageGalleryProps) {
  const [selected, setSelected] = useState(0);
  const [errored, setErrored] = useState<Record<number, boolean>>({});

  const validImages = images.filter((_, i) => !errored[i]);
  const safeIndex = errored[selected]
    ? images.findIndex((_, i) => !errored[i])
    : selected;
  const current = images[safeIndex] ?? "";

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse sm:gap-4">
      {/* Main image */}
      <div className="relative aspect-square w-full overflow-hidden bg-stone-50 sm:flex-1">
        {current ? (
          <Image
            src={current}
            alt={name}
            fill
            priority
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 55vw"
            className="object-contain p-6 transition-opacity duration-300"
            quality={90}
            onError={() =>
              setErrored((prev) => ({ ...prev, [safeIndex]: true }))
            }
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-200">
            <svg
              className="h-20 w-20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={0.75}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {validImages.length > 1 && (
        <div className="flex flex-row gap-2 overflow-x-auto sm:w-16 sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto">
          {images.map(
            (img, i) =>
              !errored[i] && (
                <button
                  key={i}
                  onClick={() => setSelected(i)}
                  className={`relative h-14 w-14 shrink-0 overflow-hidden bg-stone-50 transition-all duration-150 sm:h-14 sm:w-full ${
                    safeIndex === i
                      ? "ring-1 ring-stone-900"
                      : "ring-1 ring-transparent hover:ring-stone-300"
                  }`}
                >
                  <Image
                    src={img}
                    alt={`${name} view ${i + 1}`}
                    fill
                    sizes="56px"
                    className="object-contain p-1.5"
                    quality={50}
                    onError={() =>
                      setErrored((prev) => ({ ...prev, [i]: true }))
                    }
                  />
                </button>
              ),
          )}
        </div>
      )}
    </div>
  );
}
