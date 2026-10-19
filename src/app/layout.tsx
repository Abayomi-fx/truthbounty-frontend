import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { ThemeInitScript } from "@/lib/theme-init";
import { NONCE_HEADER } from "@/lib/security/headers";
import { getApprovedOrigin } from "@/lib/metadata/canonical-url";
import {
  SITE_NAME,
  DEFAULT_DESCRIPTION,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_ALT,
} from "@/lib/metadata/route-metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Root layout metadata — Issue #620 (UI-FE-050)
 *
 * metadataBase is set here so that all relative OG image paths are resolved
 * to absolute URLs using the approved canonical origin.
 *
 * Per-route metadata is exported from each route segment's layout.tsx or
 * page.tsx Server Component wrapper, inheriting and overriding these defaults.
 *
 * PRIVACY: only approved static site information is present. No wallet,
 * session, claim-draft, evidence, or user-specific data is included.
 */
export const metadata: Metadata = {
  metadataBase: new URL(getApprovedOrigin()),
  title: {
    default: `${SITE_NAME} — Decentralized Claim Verification`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    images: [
      {
        url: OG_IMAGE_PATH,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const nonce = headerStore.get(NONCE_HEADER) ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <ThemeInitScript nonce={nonce} />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {/* Skip link for keyboard users */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-white text-black px-3 py-2 rounded"
        >
          Skip to content
        </a>

        <Providers>
          <main id="main" tabIndex={-1} role="main">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
