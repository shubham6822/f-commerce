import NextLink from "./NextLink";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <NextLink
          href="/"
          className="text-lg font-light italic tracking-tight text-stone-900"
          style={{ fontFamily: "var(--font-display)" }}
        >
          F-Commerce
        </NextLink>
        <div className="flex items-center gap-4">
          <a
            href="/cart"
            className="relative text-stone-900 transition-colors duration-150 hover:text-stone-600"
            aria-label="Cart"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.837-7.17M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
              />
            </svg>
          </a>
          <a
            href="/login"
            className="border border-stone-900 px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-stone-900 transition-colors duration-150 hover:bg-stone-900 hover:text-white"
          >
            Login
          </a>
        </div>
      </div>
    </header>
  );
}
