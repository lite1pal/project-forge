import type { Metadata } from "next";
import "@/app/globals.css";

import { getAuditTrailMetadata } from "@/app/audit-product-chrome";

export const metadata: Metadata = getAuditTrailMetadata();

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
