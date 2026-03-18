import Link from "next/link";
import React from "react";

export default function NextLink({
  children,
  href,
  ...props
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link href={href} prefetch={false} {...props}>
      {children}
    </Link>
  );
}
