import { getProduct } from "@/actions/Product";
import ProductCard, { type ProductCardData } from "./ProductCard";
import NextLink from "../NextLink";

export default async function ProductList() {
  const rawProducts = await getProduct();

  const products: ProductCardData[] = rawProducts
    .filter((p: ProductCardData) => p.image?.length > 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any) => ({
      id: String(p._id),
      uniq_id: p.uniq_id,
      product_name: p.product_name,
      brand: p.brand,
      image: p.image,
      retail_price: p.retail_price ?? 0,
      discounted_price: p.discounted_price ?? 0,
      is_FK_Advantage_product: p.is_FK_Advantage_product,
      product_rating: p.product_rating,
    }));

  if (!products.length) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-stone-400">
        <svg
          className="h-12 w-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-sm font-medium">No products found</p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-end justify-between border-b border-stone-900 pb-4">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.25em] text-stone-400">
            Curated Selection
          </p>
          <h2
            className="mt-0.5 font-display text-4xl font-light italic tracking-tight text-stone-900"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Products
          </h2>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-widest text-stone-400">
          {products.length} items
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product, index) => (
          <NextLink
            href={`/${product.id}`}
            key={product.id ?? product.uniq_id}
            data-images={JSON.stringify(product.image)}
          >
            <ProductCard
              key={product.id ?? product.uniq_id}
              product={product}
              index={index}
            />
          </NextLink>
        ))}
      </div>
    </section>
  );
}
