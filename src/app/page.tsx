import { Suspense } from "react";
import ProductList from "@/components/products/ProductList";

export default function Home() {
  return (
    <>
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList />
      </Suspense>
    </>
  );
}

function ProductListSkeleton() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-stone-900 pb-4">
        <div className="h-2 w-20 animate-pulse bg-stone-200" />
        <div className="mt-2 h-9 w-36 animate-pulse bg-stone-100" />
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="outline-1 outline-stone-200">
            <div className="aspect-4/3 animate-pulse bg-stone-100" />
            <div className="space-y-2 p-3">
              <div className="h-2 w-14 animate-pulse bg-stone-200" />
              <div className="h-2.5 w-full animate-pulse bg-stone-100" />
              <div className="h-2.5 w-3/4 animate-pulse bg-stone-100" />
            </div>
            <div className="border-t border-stone-100 px-3 pt-3">
              <div className="h-2.5 w-16 animate-pulse bg-stone-200" />
              <div className="mt-2 h-7 w-full animate-pulse bg-stone-100" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
