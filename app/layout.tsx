import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spec-to-Sell",
  description: "Evidence-grounded product infographics for PoD sellers",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
