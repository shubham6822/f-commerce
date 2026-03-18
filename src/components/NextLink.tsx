import Link from "next/link";
import React from "react";

export default function NextLink({
  children,
  href,
  pfetch = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof Link> & { pfetch?: boolean }) {
  console.log("Rendering NextLink for", href, "with pfetch =", pfetch);
  return (
    <Link href={href} prefetch={false} {...props}>
      {children}
    </Link>
  );
}
