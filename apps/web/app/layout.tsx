import "./globals.css";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

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
