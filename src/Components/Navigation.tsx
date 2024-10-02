import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '../app/components/ui/button'
import Avatar from '../app/components/ui/avatar'
import { Menu, X, Book, BookOpen, Settings, LogOut, Sun, Moon } from 'lucide-react'
import DropdownMenu from '../app/components/ui/dropdown-menu'
import { useTheme } from 'next-themes'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const supabase = createClientComponentClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Erro ao sair:', error)
    } else {
      router.push('/login')
    }
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: <Book className="w-4 h-4 mr-2" /> },
    { name: 'Minha Biblioteca', href: '/meus-livros', icon: <BookOpen className="w-4 h-4 mr-2" /> },
  ]

  const userMenuItems = [
    { name: 'Configurações', href: '/settings', icon: <Settings className="w-4 h-4 mr-2" /> },
  ]

  return (
    <nav className="bg-gradient-to-r from-purple-700 to-purple-900 border-b border-purple-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/">
                <Image src="/images/logo_white.png" alt="Logo" width={150} height={75} />
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-purple-100 hover:text-white hover:border-purple-300 transition-colors duration-200"
                >
                  {item.icon}
                  {item.name === 'Dashboard' ? 'Dashboard' : item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-purple-100 hover:text-white hover:bg-purple-600 transition-colors duration-200"
            >
              {mounted && theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <span className="sr-only">Alternar tema</span>
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" className="relative rounded-full bg-purple-600 p-1 text-purple-100 hover:text-white hover:bg-purple-500 transition-colors duration-200">
                  <Avatar>
                    <Avatar.Image src="/images/placeholder-avatar.png" alt="Usuário" />
                    <Avatar.Fallback>U</Avatar.Fallback>
                  </Avatar>
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" className="w-56">
                <DropdownMenu.Label>Minha Conta</DropdownMenu.Label>
                <DropdownMenu.Separator />
                {userMenuItems.map((item) => (
                  <DropdownMenu.Item key={item.name} onSelect={() => router.push(item.href)}>
                    <span className="flex items-center">
                      {item.icon}
                      {item.name}
                    </span>
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator />
                <DropdownMenu.Item onSelect={handleLogout} className="text-red-600 dark:text-red-400">
                  <span className="flex items-center">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </span>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
            <Button
              variant="ghost"
              className="inline-flex items-center justify-center p-2 rounded-md text-purple-100 hover:text-white hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white transition-colors duration-200"
              onClick={() => setIsOpen(!isOpen)}
            >
              <span className="sr-only">Abrir menu principal</span>
              {isOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="sm:hidden bg-purple-800">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-purple-100 hover:text-white hover:bg-purple-700 hover:border-purple-300 transition-colors duration-200"
                onClick={() => setIsOpen(false)}
              >
                <span className="flex items-center">
                  {item.icon}
                  {item.name === 'Dashboard' ? 'Painel' : item.name}
                </span>
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-purple-700">
            <div className="flex items-center px-4">
              <div className="flex-shrink-0">
                <Avatar>
                  <Avatar.Image src="/placeholder-avatar.jpg" alt="Usuário" />
                  <Avatar.Fallback>U</Avatar.Fallback>
                </Avatar>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-white">Nome do Usuário</div>
                <div className="text-sm font-medium text-purple-300">usuario@exemplo.com</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="ml-auto text-purple-100 hover:text-white hover:bg-purple-600 transition-colors duration-200"
              >
                {mounted && theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                <span className="sr-only">Alternar tema</span>
              </Button>
            </div>
            <div className="mt-3 space-y-1">
              {userMenuItems.map((item) => (
                <Button
                  key={item.name}
                  variant="ghost"
                  className="block w-full text-left px-4 py-2 text-base font-medium text-purple-100 hover:text-white hover:bg-purple-700 transition-colors duration-200"
                  onClick={() => {
                    router.push(item.href)
                    setIsOpen(false)
                  }}
                >
                  <span className="flex items-center">
                    {item.icon}
                    {item.name}
                  </span>
                </Button>
              ))}
              <Button
                variant="ghost"
                className="block w-full text-left px-4 py-2 text-base font-medium text-red-400 hover:text-red-300 hover:bg-purple-700 transition-colors duration-200"
                onClick={handleLogout}
              >
                <span className="flex items-center">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navigation