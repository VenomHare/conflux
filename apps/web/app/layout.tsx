import "./globals.css";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import type { Metadata } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "Conflux",
    template: "%s | Conflux",
  },
  description: "A quieter place for your team’s work.",
  applicationName: "Conflux",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Conflux",
    title: "Conflux",
    description: "A quieter place for your team’s work.",
    images: ["/logo.png"],
  },
  twitter: {
    card: "summary",
    title: "Conflux",
    description: "A quieter place for your team’s work.",
    images: ["/logo.png"],
  },
};

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "Conflux",
                ...(siteUrl
                  ? {
                      url: siteUrl,
                      logo: new URL("/logo.png", siteUrl).toString(),
                    }
                  : {}),
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "Conflux",
                description: "A quieter place for your team’s work.",
                ...(siteUrl ? { url: siteUrl } : {}),
              },
            ]).replace(/</g, "\\u003c"),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var m=window.matchMedia("(prefers-color-scheme: dark)");var apply=function(){var t=localStorage.getItem("conflux:theme")||"system";document.documentElement.dataset.theme=t==="dark"||(t==="system"&&m.matches)?"dark":"light"};apply();m.addEventListener("change",apply)}catch(e){}})()',
          }}
        />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
