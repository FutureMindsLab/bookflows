'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useSupabase } from '@/Components/supabaseProvider'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'

interface AuthError {
  message: string;
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const router = useRouter()
  const supabase = useSupabase()

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (data.session) {
        console.log('User already logged in, redirecting to dashboard')
        router.push('/dashboard')
      }
      if (error) {
        console.error('Error checking session:', error)
      }
    }
    checkSession()
  }, [supabase.auth, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      console.log('Attempting login with email:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      console.log('Login successful:', data)
      setSuccessMessage('Login bem-sucedido! Redirecionando...')
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (error: unknown) {
      console.error('Login error:', error)
      const authError = error as AuthError
      let errorMsg = 'Erro ao fazer login'
      
      switch (authError.message) {
        case 'Email not confirmed':
          errorMsg = 'Email não confirmado. Por favor, verifique sua caixa de entrada e confirme seu email.'
          break
        case 'Invalid login credentials':
          errorMsg = 'Credenciais de login inválidas. Por favor, verifique seu email e senha.'
          break
        default:
          errorMsg = `Erro ao fazer login: ${authError.message}`
      }
      
      setErrorMessage(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsResettingPassword(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSuccessMessage('Um link para redefinir sua senha foi enviado para o seu email.')
      setIsResetPasswordModalOpen(false)
    } catch (error: unknown) {
      const authError = error as AuthError
      setErrorMessage(`Erro ao enviar o email de redefinição de senha: ${authError.message}`)
    } finally {
      setIsResettingPassword(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Image src="/images/logo.png" alt="Logo" width={200} height={100} />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-gray-800">Login</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <strong className="font-bold">Erro! </strong>
              <span className="block sm:inline">{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
              <strong className="font-bold">Sucesso! </strong>
              <span className="block sm:inline">{successMessage}</span>
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md"
            />
            <Input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md"
            />
            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            <Link href="/signup" className="text-purple-600 hover:text-purple-800 block">
              Não tem uma conta? Cadastre-se
            </Link>
            <button
              onClick={() => setIsResetPasswordModalOpen(true)}
              className="text-purple-600 hover:text-purple-800"
            >
              Esqueceu sua senha?
            </button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isResetPasswordModalOpen} onOpenChange={setIsResetPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Digite seu email para receber um link de redefinição de senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <Input
              type="email"
              placeholder="E-mail"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md"
            />
            <DialogFooter>
              <Button 
                type="submit" 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
                disabled={isResettingPassword}
              >
                {isResettingPassword ? 'Enviando...' : 'Enviar Link de Redefinição'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}