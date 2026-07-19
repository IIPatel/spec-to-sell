import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spec-to-Sell | Evidence-locked product listings",
  description: "Turn supplier facts and vendor photos into trustworthy, brand-consistent product-listing infographics.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
