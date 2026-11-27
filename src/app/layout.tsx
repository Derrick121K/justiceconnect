import type { Metadata } from "next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "JusticeConnect | Find trusted legal help in South Africa",
  description: "Connect with legal practitioners and law firms across all nine South African provinces.",
  applicationName: "JusticeConnect and JCStudio",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "JCStudio" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-ZA"><body><PwaRegister />{children}</body></html>;
}
