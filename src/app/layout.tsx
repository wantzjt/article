import type { Metadata } from "next";
import { Geist, Geist_Mono, Ramaraja } from "next/font/google";
import { brand } from "@/lib/brand";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ramaraja = Ramaraja({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ramaraja",
});

export const metadata: Metadata = {
  title: {
    default: brand.title,
    template: `%s · ${brand.productName}`,
  },
  description: brand.description,
  metadataBase: new URL(brand.siteUrl),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${ramaraja.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <div className="mx-auto flex min-h-full w-full max-w-[40rem] flex-1 flex-col px-4">
          <SiteHeader />
          <main className="flex-1 py-8 sm:py-10">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
