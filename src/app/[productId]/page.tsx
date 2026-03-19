import {
  getAllProductIds,
  getProductById,
  getSimilarProducts,
} from "@/actions/Product";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import NextLink from "@/components/NextLink";
import ProductCard, {
  type ProductCardData,
} from "@/components/products/ProductCard";
import ProductImageGallery from "@/components/products/ProductImageGallery";

// export async function generateStaticParams() {
//   const ids = await getAllProductIds(); // returns ["id1", "id2", ...]
//   return ids.map((id) => ({ productId: id }));
// }

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  return (
    <main className="min-h-screen bg-white">
      <Suspense fallback={<ProductDetailSkeleton />}>
        <ProductContent params={params} />
      </Suspense>

      <Suspense fallback={<SimilarProductsSkeleton />}>
        <SimilarProducts params={params} />
      </Suspense>
    </main>
  );
}

async function ProductContent({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const product = await getProductById(productId);
  if (!product) notFound();

  const discount =
    product.retail_price > product.discounted_price
      ? Math.round(
          ((product.retail_price - product.discounted_price) /
            product.retail_price) *
            100,
        )
      : 0;

  const specs = parseSpecs(product.product_specifications ?? "");
  const categoryTree: string[] = Array.isArray(product.product_category_tree)
    ? (product.product_category_tree as string[])
    : [];

  return (
    <>
      {/* Breadcrumb */}
      <div className="border-b border-stone-100">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-stone-400">
            <NextLink href="/">
              <span className="cursor-pointer transition-colors hover:text-stone-900">
                Home
              </span>
            </NextLink>
            {product.brand && (
              <>
                <span>›</span>
                <span className="max-w-xs truncate text-stone-600">
                  {product.brand}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_460px]">
          <ProductImageGallery
            images={(product.image as string[]) ?? []}
            name={product.product_name as string}
          />

          {/* Product Info */}
          <div className="lg:sticky lg:top-24 lg:self-start lg:overflow-y-auto lg:max-h-[calc(100vh-7rem)]">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-stone-400">
                {product.brand}
              </p>
              {product.is_FK_Advantage_product && (
                <span className="bg-stone-900 px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-white">
                  FK Advantage+
                </span>
              )}
            </div>

            <h1
              className="mt-2 font-display text-3xl font-light italic leading-snug tracking-tight text-stone-900 lg:text-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {product.product_name}
            </h1>

            {product.product_rating && (
              <div className="mt-3 flex items-center gap-3">
                <StarRating rating={product.product_rating as string} />
                {product.overall_rating && (
                  <span className="text-[10px] font-light text-stone-400">
                    {product.overall_rating} overall
                  </span>
                )}
              </div>
            )}

            <div className="mt-5 border-t border-stone-100 pt-5">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-light text-stone-900">
                  ₹
                  {((product.discounted_price as number) ?? 0).toLocaleString(
                    "en-IN",
                  )}
                </span>
                {discount > 0 && (
                  <>
                    <span className="text-sm font-light text-stone-400 line-through">
                      ₹
                      {((product.retail_price as number) ?? 0).toLocaleString(
                        "en-IN",
                      )}
                    </span>
                    <span className="bg-stone-900 px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-white">
                      −{discount}%
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-[10px] font-light text-stone-400">
                Inclusive of all taxes
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button className="w-full bg-stone-900 py-3.5 text-[11px] font-medium uppercase tracking-widest text-white transition-colors duration-200 hover:bg-stone-700">
                Add to Cart
              </button>
              <button className="w-full border border-stone-200 py-3.5 text-[11px] font-medium uppercase tracking-widest text-stone-900 transition-colors duration-200 hover:border-stone-900">
                Wishlist
              </button>
            </div>

            {categoryTree.length > 0 && (
              <div className="mt-6 border-t border-stone-100 pt-5">
                <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400">
                  Category
                </p>
                <p className="mt-1.5 text-xs font-light leading-relaxed text-stone-600">
                  {categoryTree.join(" › ")}
                </p>
              </div>
            )}

            {product.description && (
              <div className="mt-6 border-t border-stone-100 pt-5">
                <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400">
                  Description
                </p>
                <p className="mt-2 text-xs font-light leading-relaxed text-stone-600">
                  {product.description as string}
                </p>
              </div>
            )}

            {specs && specs.length > 0 && (
              <div className="mt-6 border-t border-stone-100 pt-5 pb-6">
                <p className="mb-3 text-[9px] font-medium uppercase tracking-[0.2em] text-stone-400">
                  Specifications
                </p>
                <div className="divide-y divide-stone-100">
                  {specs.map((spec, i) => (
                    <div key={i} className="flex gap-4 py-2.5">
                      <span className="w-2/5 shrink-0 text-[11px] font-medium text-stone-500">
                        {spec.key}
                      </span>
                      <span className="text-[11px] font-light leading-relaxed text-stone-800">
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

async function SimilarProducts({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const rawSimilar = await getSimilarProducts(productId, 4);

  const similar: ProductCardData[] = (
    rawSimilar as Array<Record<string, unknown>>
  ).map((p) => ({
    id: String(p._id),
    uniq_id: p.uniq_id as string,
    product_name: p.product_name as string,
    brand: p.brand as string,
    image: p.image as string[],
    retail_price: (p.retail_price as number) ?? 0,
    discounted_price: (p.discounted_price as number) ?? 0,
    is_FK_Advantage_product: p.is_FK_Advantage_product as boolean,
    product_rating: p.product_rating as string,
  }));

  if (!similar.length) return null;

  return (
    <section className="border-t border-stone-100 bg-stone-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between border-b border-stone-900 pb-4">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-stone-400">
              Handpicked for You
            </p>
            <h2
              className="mt-0.5 font-display text-3xl font-light italic tracking-tight text-stone-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              You May Also Like
            </h2>
          </div>
          <NextLink href="/">
            <span className="cursor-pointer text-[10px] font-medium uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900">
              View All
            </span>
          </NextLink>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {similar.map((p, index) => (
            <NextLink href={`/${p.id}`} key={p.id} prefetch={true}>
              <ProductCard product={p} index={index} />
            </NextLink>
          ))}
        </div>
      </div>
    </section>
  );
}

type SpecEntry = { key: string; value: string };

function parseSpecs(raw: string): SpecEntry[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.product_specification)) {
      return parsed.product_specification as SpecEntry[];
    }
  } catch {
    /* non-JSON specs — ignore */
  }
  return null;
}

function StarRating({ rating }: { rating: string }) {
  const num = parseFloat(rating);
  if (isNaN(num)) return null;
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className="h-3 w-3"
          viewBox="0 0 20 20"
          fill={star <= Math.round(num) ? "#111" : "none"}
          stroke="#111"
          strokeWidth="1.5"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-[11px] font-light tracking-wide text-stone-500">
        {num.toFixed(1)}
      </span>
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_460px]">
        <div className="flex gap-4">
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-16 w-16 animate-pulse rounded bg-stone-100"
              />
            ))}
          </div>
          <div className="aspect-square w-full animate-pulse rounded bg-stone-100" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-3 w-24 animate-pulse rounded bg-stone-200" />
          <div className="h-8 w-3/4 animate-pulse rounded bg-stone-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-stone-200" />
          <div className="mt-4 h-10 w-32 animate-pulse rounded bg-stone-200" />
          <div className="mt-6 space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-stone-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-stone-100" />
            <div className="h-3 w-4/6 animate-pulse rounded bg-stone-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SimilarProductsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="aspect-4/3 animate-pulse rounded bg-stone-100"
          />
        ))}
      </div>
    </div>
  );
}
