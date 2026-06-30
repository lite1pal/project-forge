import type { Metadata } from "next";
import "@/app/globals.css";

import { getProductMetadata } from "@/app/product-module";

export const metadata: Metadata = getProductMetadata();

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
