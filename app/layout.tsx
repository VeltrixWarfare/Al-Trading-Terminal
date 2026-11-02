import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AI Trading Terminal",
  description: "Private XAUUSD market analysis terminal",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
