'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from './supabaseProvider'

export function withAuth<P extends object>(WrappedComponent: React.ComponentType<P>) {
  return function WithAuth(props: P) {
    const router = useRouter()
    const supabase = useSupabase()
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    useEffect(() => {
      const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setIsAuthenticated(true)
        } else {
          router.push('/login')
        }
      }

      checkUser()
    }, [router, supabase])

    if (!isAuthenticated) {
      return null // ou um componente de loading
    }

    return <WrappedComponent {...props} />
  }
}