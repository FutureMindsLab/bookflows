'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '../app/components/ui/button'
import { LogOut } from 'lucide-react'
import { useState } from 'react'

export default function Navigation() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const supabase = createClientComponentClient()

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error signing out:', error)
        throw error
      }
      router.push('/login')
    } catch (error) {
      console.error('Failed to log out:', error)
      // Optionally, show an error message to the user
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <nav className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/dashboard" className="text-white">
          <Image src="/images/logo_white.png" alt="BookFlows" width={200} height={100} />
        </Link>
        <div className="space-x-4">
          <Link href="/dashboard" className="text-white hover:text-gray-200">
            Dashboard
          </Link>
          <Link href="/meus-livros" className="text-white hover:text-gray-200">
            Meus Livros
          </Link>
          <Link href="/settings" className="text-white hover:text-gray-200">
            Configurações
          </Link>
          <Button 
            onClick={handleLogout} 
            className="bg-purple-600 hover:bg-purple-700 text-white"
            disabled={isLoggingOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {isLoggingOut ? 'Saindo...' : 'Sair'}
          </Button>
        </div>
      </div>
    </nav>
  )
}