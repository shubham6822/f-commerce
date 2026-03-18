"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface ProductCardData {
  id: string;
  uniq_id: string;
  product_name: string;
  brand: string;
  image: string[];
  retail_price: number;
  discounted_price: number;
  is_FK_Advantage_product: boolean;
  product_rating: string;
}

interface ProductCardProps {
  product: ProductCardData;
  index: number;
}

export default function ProductCard({ product, index }: ProductCardProps) {
  const [imgError, setImgError] = useState(false);

  const primaryImage = product.image?.[0];
  const discount =
    product.retail_price > product.discounted_price
      ? Math.round(
          ((product.retail_price - product.discounted_price) /
            product.retail_price) *
            100,
        )
      : 0;

  return (
    <Card
      className="group/card flex h-full flex-col gap-0 overflow-hidden rounded-none border-0 bg-white shadow-none outline-1 outline-stone-200 transition-all duration-200 hover:outline-stone-900"
      key={index}
    >
      <div className="relative aspect-4/3 overflow-hidden bg-stone-50">
        {primaryImage && !imgError && (
          <Image
            src={primaryImage}
            alt={product.product_name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain p-3 transition-transform duration-500 group-hover/card:scale-[1.03]"
            onError={() => setImgError(true)}
            quality={75}
          />
        )}
        {discount > 0 && (
          <span className="absolute left-0 top-3 bg-stone-900 px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-white">
            -{discount}%
          </span>
        )}

        {product.is_FK_Advantage_product && (
          <span className="absolute right-0 top-3 bg-stone-900 px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-white">
            FK+
          </span>
        )}
      </div>

      <CardHeader className="gap-0.5 pb-1 pt-3">
        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400">
          {product.brand}
        </p>
        <CardTitle className="line-clamp-2 text-xs font-light leading-snug text-stone-800">
          {product.product_name}
        </CardTitle>
      </CardHeader>

      <CardContent className="pb-1">
        <StarRating rating={product.product_rating} />
      </CardContent>

      <CardFooter className="mt-auto flex flex-col gap-2 border-t border-stone-100 pt-3">
        <div className="flex w-full items-baseline gap-2">
          <span className="text-sm font-medium text-stone-900">
            ₹{(product.discounted_price ?? 0).toLocaleString("en-IN")}
          </span>
          {discount > 0 ? (
            <span className="text-xs text-stone-400 line-through">
              ₹{(product.retail_price ?? 0).toLocaleString("en-IN")}
            </span>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}

function StarRating({ rating }: { rating: string }) {
  const numRating = parseFloat(rating);
  if (isNaN(numRating)) return null;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className="h-2.5 w-2.5"
          viewBox="0 0 20 20"
          fill={star <= Math.round(numRating) ? "#111" : "none"}
          stroke="#111"
          strokeWidth="1.5"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-[10px] font-light tracking-wide text-stone-500">
        {numRating.toFixed(1)}
      </span>
    </div>
  );
}
