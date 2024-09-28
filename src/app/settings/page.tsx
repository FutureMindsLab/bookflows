'use client'

import { withAuth } from '@/Components/withAuth'
import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navigation from '@/Components/Navigation'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { useSupabase } from '@/Components/supabaseProvider'

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  daily_digest_enabled: boolean;
  daily_digest_method: string;
}

function Settings() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [currentPlan] = useState('free')
  const [credits, setCredits] = useState(100)
  const router = useRouter()
  const supabase = useSupabase()

  const fetchUserProfile = useCallback(async () => {
    try {
      setLoading(true)
      setErrorMessage(null)

      console.log("Iniciando fetchUserProfile")

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error("Erro ao obter sessão:", sessionError)
        throw new Error('Erro ao obter a sessão: ' + sessionError.message)
      }

      if (!session || !session.user || !session.user.email) {
        console.error("Sessão ou email do usuário não encontrado")
        throw new Error('Sessão ou email do usuário não encontrado')
      }

      console.log("Sessão obtida com sucesso:", JSON.stringify(session, null, 2))

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, email, phone, daily_digest_enabled, daily_digest_method')
        .eq('email', session.user.email)
        .single()

      if (userError) {
        console.error("Erro ao buscar dados do usuário:", userError)
        throw new Error('Erro ao buscar dados do usuário: ' + userError.message)
      }

      if (!user) {
        console.error("Usuário não encontrado para o email:", session.user.email)
        throw new Error('Usuário não encontrado')
      }

      console.log("Dados do usuário obtidos com sucesso:", JSON.stringify(user, null, 2))

      const userProfile: UserProfile = {
        id: user.id as string,
        name: (user.name as string) || '',
        email: user.email as string,
        phone: (user.phone as string) || '',
        daily_digest_enabled: (user.daily_digest_enabled as boolean) || false,
        daily_digest_method: (user.daily_digest_method as string) || '',
      }

      setProfile(userProfile)
    } catch (error) {
      console.error('Erro ao buscar perfil do usuário:', error)
      setErrorMessage('Falha ao carregar o perfil do usuário. Por favor, tente novamente.')
      if (error instanceof Error) {
        console.error('Detalhes do erro:', error.message)
      }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchUserProfile()
  }, [fetchUserProfile])

  const handleSaveSettings = async () => {
    if (!profile) return

    try {
      setErrorMessage(null)
      setSuccessMessage(null)

      const updateData = {
        name: profile.name,
        phone: profile.phone,
        daily_digest_enabled: profile.daily_digest_enabled,
        daily_digest_method: profile.daily_digest_enabled ? profile.daily_digest_method : null,
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('email', profile.email)

      if (error) {
        throw error
      }

      setSuccessMessage('Perfil atualizado com sucesso!')
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error)
      setErrorMessage('Falha ao atualizar o perfil. Por favor, tente novamente.')
    }
  }

  const handleDailyDigestChange = (checked: boolean) => {
    setProfile(prev => {
      if (prev) {
        return {
          ...prev,
          daily_digest_enabled: checked,
          daily_digest_method: checked ? prev.daily_digest_method : '',
        }
      }
      return null
    })
  }

  const handleDeleteAccount = async () => {
    try {
      setErrorMessage(null)
      setSuccessMessage(null)

      if (!profile) {
        throw new Error('Perfil do usuário não encontrado')
      }

      const { error } = await supabase.auth.admin.deleteUser(profile.id)

      if (error) {
        throw error
      }

      setSuccessMessage('Conta excluída com sucesso. Redirecionando...')
      setTimeout(() => router.push('/'), 2000)
    } catch (error) {
      console.error('Erro ao excluir conta:', error)
      setErrorMessage('Falha ao excluir a conta. Por favor, tente novamente.')
    }
  }

  const handleBuyCredits = (amount: number) => {
    setCredits(credits + amount)
    setSuccessMessage(`${amount} créditos adicionados com sucesso!`)
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    setProfile(prev => prev ? { ...prev, phone: value } : null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-white">Carregando...</h1>
          <p className="text-white">Buscando suas configurações. Por favor, aguarde.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Configurações</h1>
        
        <div className="space-y-6 max-w-2xl mx-auto">
          {errorMessage && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Erro! </strong>
              <span className="block sm:inline">{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">Sucesso! </strong>
              <span className="block sm:inline">{successMessage}</span>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Perfil do Usuário</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={profile?.name || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, name: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile?.email || ''}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Número de Telefone (para WhatsApp)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profile?.phone || ''}
                    onChange={handlePhoneChange}
                    placeholder="11955560058"
                  />
                  <p className="text-sm text-gray-500">Digite apenas números: DDD + Número (ex: 11955550055)</p>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="digest-switch">Receber Daily Digest</Label>
                  <Switch
                    id="digest-switch"
                    checked={profile?.daily_digest_enabled || false}
                    onCheckedChange={handleDailyDigestChange}
                  />
                </div>
                {profile?.daily_digest_enabled && (
                  <div className="space-y-2">
                    <Label htmlFor="digest-method">Método de Recebimento</Label>
                    <Select 
                      value={profile?.daily_digest_method || ''} 
                      onValueChange={(value) => setProfile(prev => prev ? { ...prev, daily_digest_method: value } : null)}
                    >
                      <SelectTrigger id="digest-method">
                        <SelectValue placeholder="Selecione o método" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="both">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveSettings} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
            Salvar Todas as Alterações
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Plano da Conta e Créditos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">Seu plano atual: <span className="text-purple-600">{currentPlan === 'free' ? 'Gratuito' : 'Premium'}</span></p>
                  {currentPlan === 'free' ? (
                    <p className="text-sm text-gray-600">100 mensagens por dia para o BookFlows AI</p>
                  ) : (
                    <p className="text-sm text-gray-600">Mensagens ilimitadas (GPT-3.5) e até 5000 mensagens (GPT-4) por dia</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold">Seus créditos: <span className="text-purple-600">{credits}</span></p>
                </div>
                {currentPlan === 'free' && (
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                    Fazer Upgrade para Premium
                  </Button>
                )}
                <div className="space-y-2">
                  <p className="font-semibold">Comprar créditos adicionais:</p>
                  <div className="flex space-x-2">
                    <Button onClick={() => handleBuyCredits(100)} className="bg-purple-600 hover:bg-purple-700 text-white">
                      +100 créditos
                    </Button>
                    <Button onClick={() => handleBuyCredits(500)} className="bg-purple-600 hover:bg-purple-700 text-white">
                      +500 créditos
                    </Button>
                    <Button onClick={() => handleBuyCredits(1000)} className="bg-purple-600 hover:bg-purple-700 text-white">
                      +1000 créditos
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Excluir Conta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-red-600">Atenção: Esta ação é irreversível e todos os seus dados serão perdidos.</p>
                <Button onClick={handleDeleteAccount} variant="destructive" className="w-full bg-red-600 hover:bg-red-700 text-white">
                  Excluir Minha Conta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default withAuth(Settings)