'use client'

import React, { createContext, useContext, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SupabaseClient } from '@supabase/supabase-js'

// Define the type for your Supabase schema
type Database = {
  public: {
    Tables: {
      // Add your table definitions here
      users: {
        Row: {
          id: string
          name: string
          email: string
          // Add other columns as needed
        }
        Insert: {
          id?: string
          name: string
          email: string
          // Add other columns as needed
        }
        Update: {
          id?: string
          name?: string
          email?: string
          // Add other columns as needed
        }
      }
      // Add other tables as needed
    }
  }
}

// Create a typed Supabase client
const supabase = createClientComponentClient<Database>()

// Create a context with the correct type
const SupabaseContext = createContext<SupabaseClient<Database> | undefined>(undefined)

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [supabaseClient] = useState(() => supabase)

  return (
    <SupabaseContext.Provider value={supabaseClient}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider')
  }
  return context
}