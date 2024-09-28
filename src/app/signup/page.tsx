'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useSupabase } from '@/Components/supabaseProvider'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

interface AuthError {
  message: string;
}

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const router = useRouter()
  const supabase = useSupabase()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Sign up the user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Call the function to create the user in the public.users table
        const { data: userData, error: userError } = await supabase.rpc('create_new_user', {
          user_auth_id: data.user.id,
          user_email: email,
          user_name: name
        });

        if (userError) throw userError;

        console.log('New user created with ID:', userData);

        setSuccessMessage('Cadastro realizado com sucesso! Por favor, verifique seu e-mail para confirmar a conta. (Pode estar no Spam)');
        setTimeout(() => {
          router.push('/login');
        }, 3000); // Redirect after 3 seconds
      } else {
        throw new Error('Falha ao criar usuário');
      }
    } catch (error: unknown) {
      const authError = error as AuthError;
      console.error('Erro detalhado:', authError);
      
      if (authError.message.includes("User already registered")) {
        setErrorMessage("Este e-mail já está cadastrado. Por favor, use outro e-mail ou faça login.");
      } else if (authError.message.includes("Password should be at least 6 characters")) {
        setErrorMessage("A senha deve ter pelo menos 6 caracteres.");
      } else if (authError.message.includes("create_new_user")) {
        setErrorMessage("Erro ao criar o perfil do usuário. Por favor, tente novamente ou contate o suporte.");
      } else {
        setErrorMessage(`Erro ao criar conta: ${authError.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <Image src="/images/logo.png" alt="Logo" width={200} height={100} />
          </div>
          <CardTitle className="text-2xl font-bold text-center text-gray-800">Criar Conta</CardTitle>
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
          <form onSubmit={handleSignUp} className="space-y-4">
            <Input
              type="text"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md"
            />
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
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/login" className="text-purple-600 hover:text-purple-800">
              Já tem uma conta? Faça login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}