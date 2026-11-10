import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JusticeConnect | Find trusted legal help in South Africa",
  description: "Connect with legal practitioners and law firms across all nine South African provinces.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-ZA"><body>{children}</body></html>;
}
