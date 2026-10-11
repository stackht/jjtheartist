import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Bricolage_Grotesque, Caveat, Figtree, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
})

const sans = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
})

// Used sparingly for the engineer's details: the brush readout, hex codes, stack chips.
const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

// Her handwriting in the margins: notes, page numbers, the signature.
const hand = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["500", "700"],
})

export const metadata: Metadata = {
  title: "Janhavi Jadhav · Software & UI engineer who paints",
  description: "Janhavi Jadhav is a software and UI engineer who paints: interfaces built with precision, and watercolours full of light.",
}

export const viewport: Viewport = {
  themeColor: "#f4f3ef",
  // Declaring dark support stops phones and in-app browsers from force-darkening the page;
  // every colour is explicit in globals.css, so it stays on paper.
  colorScheme: "light dark",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Browser extensions often add attributes to <html> before React hydrates; ignore those.
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} ${hand.variable}`} suppressHydrationWarning>
      <body>
        {/* Decide before hydration whether the opening drop plays (once per session). */}
        <Script id="intro-gate" strategy="beforeInteractive">
          {"try{if(sessionStorage.getItem('jj-intro'))document.documentElement.dataset.intro='skip';else sessionStorage.setItem('jj-intro','1')}catch(e){document.documentElement.dataset.intro='skip'}"}
        </Script>
        {children}
      </body>
    </html>
  )
}
