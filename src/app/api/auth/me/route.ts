// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      console.log('Sessão não encontrada na rota GET /api/auth/me')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    console.log('Sessão encontrada para o usuário:', session.user.id)

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error) {
      console.error('Erro ao buscar dados do usuário:', error)
      return NextResponse.json({ error: 'Erro ao buscar dados do usuário' }, { status: 500 })
    }

    if (!user) {
      console.log('Usuário não encontrado na tabela users para o ID:', session.user.id)
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    console.log('Dados do usuário recuperados com sucesso')
    return NextResponse.json(user)
  } catch (error) {
    console.error('Erro na rota GET /api/auth/me:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

