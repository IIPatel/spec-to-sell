import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spec-to-Sell | AI art direction with a proof trail",
  description: "Turn supplier facts and vendor photos into premium, cited product-listing visuals with GPT Image 2.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
