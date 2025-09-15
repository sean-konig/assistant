import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/toaster"
import { Providers } from "./providers"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "Exec Assistant",
  description: "Executive Assistant Dashboard",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className="dark"
      suppressHydrationWarning
      style={{ colorScheme: "dark" }}
    >
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <Providers>
            <Suspense fallback={null}>
              <AppShell>{children}</AppShell>
              <Toaster />
            </Suspense>
          </Providers>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
