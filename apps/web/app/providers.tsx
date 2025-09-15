"use client"

import type React from "react"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, useEffect } from "react"

// Mock service worker setup
async function enableMocking() {
  if (typeof window === "undefined") {
    return
  }

  const { worker } = await import("../mocks/browser")
  return worker.start()
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000, // 2 minutes
            refetchOnWindowFocus: false,
          },
        },
      }),
  )

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "1") {
      enableMocking()
    }
  }, [])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
