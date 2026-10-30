import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import {
  Baloo_Tamma_2,
  Caveat,
  Noto_Sans_Devanagari,
  Noto_Sans_Kannada,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { FeedbackButton } from "@/components/parampara/FeedbackButton";
import { OfflineBanner } from "@/components/parampara/OfflineBanner";
import { ServiceWorker } from "@/components/parampara/ServiceWorker";
import { Providers } from "@/components/parampara/Providers";
import { messages } from "@/lib/i18n/messages";
import { pickMessages } from "@/lib/i18n/areas";
import { LANG_BOOT_SCRIPT } from "@/lib/i18n";
import { colors } from "@/lib/tokens";
import "./globals.css";

const baloo = Baloo_Tamma_2({
  subsets: ["kannada", "latin"],
  variable: "--font-baloo",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const notoKannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  variable: "--font-noto-kannada",
  display: "swap",
});

// Hindi answers (BUILD M3.4): only downloaded when Devanagari text is on the page.
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap",
  preload: false,
});

// One emotional English word per screen at most (DESIGN §3); not worth a preload.
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Parampara · ಪರಂಪರೆ",
    template: "%s · Parampara",
  },
  description:
    "The classroom wisdom of Karnataka's master teachers, in their own voice, for every young teacher. One lamp lights another.",
  applicationName: "Parampara",
  // Installable on Android and iOS home screens (D3, D52); the manifest is app/manifest.ts.
  appleWebApp: { capable: true, title: "ಪರಂಪರೆ", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: colors.cream,
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="kn"
      data-lang="kn"
      suppressHydrationWarning
      className={`${baloo.variable} ${jakarta.variable} ${notoKannada.variable} ${notoDevanagari.variable} ${caveat.variable}`}
    >
      <head>
        {/* Sets the language before first paint so English readers never see a Kannada flash. */}
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOT_SCRIPT }} />
      </head>
      <body>
        {/* The first Tab stop: past the header, straight to the page (every <main> is #main). */}
        <a
          href="#main"
          className="sr-only rounded-button bg-ink font-display font-bold text-white focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:inline-flex focus:min-h-12 focus:items-center focus:gap-2 focus:px-5 focus:py-3"
        >
          <span data-lang-mode="kn" lang="kn">
            {messages.kn["app.skip"]}
          </span>
          <span data-lang-mode="en" lang="en">
            {messages.en["app.skip"]}
          </span>
        </a>
        <Providers strings={pickMessages(["core"])}>
          {children}
          <OfflineBanner />
          <ServiceWorker />
          {/* Reads the route (usePathname), so it waits behind Suspense (Cache Components). */}
          <Suspense fallback={null}>
            <FeedbackButton />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
