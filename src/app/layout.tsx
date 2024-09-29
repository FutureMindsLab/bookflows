import React from 'react'
import './globals.css'
import { Analytics } from "@vercel/analytics/react"
import { SupabaseProvider } from '@/Components/supabaseProvider'

// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  )
}