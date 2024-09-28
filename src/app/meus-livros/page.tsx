'use client'

import { withAuth } from '@/Components/withAuth'
import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import Navigation from '@/Components/Navigation'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Textarea } from '../components/ui/textarea'
import { Progress } from '../components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { ShoppingCart, Headphones, Play, Search, AlertCircle, Trash2 } from 'lucide-react'
import { useDebounce } from 'use-debounce'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Annotation {
  id: string
  content: string
  created_at: string
  updated_at: string
}

interface Livro {
  id: string
  titulo: string
  autor: string
  ano: number
  isbn: string
  amazonLink: string
  audibleLink: string
  thumbnail: string
  descricao: string
  progresso: number
  anotacoes: Annotation[]
}

interface User {
  id: string
  isPremium: boolean
}

interface UserBookData {
  id: string
  progress: number
  books: {
    id: string
    title: string
    author: string
    year: number
    isbn: string
    amazon_link: string
    audible_link: string
    thumbnail: string | null
    description: string | null
  }
  annotations: Annotation[]
}

const MeusLivros = () => {
  const [livros, setLivros] = useState<Livro[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [livroSelecionado, setLivroSelecionado] = useState<Livro | null>(null)
  const [novoLivroTitulo, setNovoLivroTitulo] = useState('')
  const [debouncedNovoLivroTitulo] = useDebounce(novoLivroTitulo, 300)
  const [sugestoes, setSugestoes] = useState<Livro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [novaAnotacao, setNovaAnotacao] = useState('')
  const router = useRouter()
  const supabase = createClientComponentClient()

  const carregarLivros = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_books')
        .select(`
          id,
          progress,
          books (
            id,
            title,
            author,
            year,
            isbn,
            amazon_link,
            audible_link,
            thumbnail,
            description
          ),
          annotations (
            id,
            content,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
      
      if (error) throw error

      if (data) {
        const livrosCarregados = (data as UserBookData[]).map(item => ({
          id: item.books.id,
          titulo: item.books.title,
          autor: item.books.author,
          ano: item.books.year,
          isbn: item.books.isbn,
          amazonLink: item.books.amazon_link,
          audibleLink: item.books.audible_link,
          thumbnail: item.books.thumbnail || '/placeholder.svg?height=200&width=150',
          descricao: item.books.description || '',
          progresso: item.progress,
          anotacoes: item.annotations || []
        }))
        setLivros(livrosCarregados)
      }
    } catch (error) {
      console.error('Erro ao carregar livros:', error)
      setErro('Ocorreu um erro ao carregar seus livros. Por favor, tente novamente.')
    }
  }, [supabase])

  useEffect(() => {
    const fetchData = async () => {
      setCarregando(true)
      setErro(null)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (!session) {
          router.push('/login')
          return
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, is_premium')
          .eq('auth_id', session.user.id)
          .single()

        if (userError) throw userError

        setUser({
          id: userData.id,
          isPremium: userData.is_premium
        })

        await carregarLivros(userData.id)
      } catch (error) {
        console.error('Erro ao buscar dados:', error)
        setErro('Ocorreu um erro ao carregar seus dados. Por favor, tente novamente.')
      } finally {
        setCarregando(false)
      }
    }

    fetchData()
  }, [carregarLivros, router, supabase])

  useEffect(() => {
    const buscarSugestoes = async () => {
      if (debouncedNovoLivroTitulo.length < 3) {
        setSugestoes([])
        return
      }

      try {
        const response = await fetch(`/api/buscar-livros?titulo=${encodeURIComponent(debouncedNovoLivroTitulo)}`)
        const data = await response.json()
        setSugestoes(data)
      } catch (error) {
        console.error('Erro ao buscar sugestões:', error)
      }
    }

    buscarSugestoes()
  }, [debouncedNovoLivroTitulo])

  const abrirModal = (livro: Livro) => {
    setLivroSelecionado(livro)
    setModalAberto(true)
  }

  const fecharModal = () => {
    setLivroSelecionado(null)
    setModalAberto(false)
  }

  const adicionarLivro = async (livro: Livro) => {
    if (!user) return
  
    try {
      const { error } = await supabase
        .from('user_books')
        .insert({
          user_id: user.id,
          book_id: livro.id,
          progress: 0
        })
  
      if (error) throw error
  
      await carregarLivros(user.id)
      setNovoLivroTitulo('')
      setSugestoes([])
    } catch (error) {
      console.error('Erro ao adicionar livro:', error)
      setErro('Ocorreu um erro ao adicionar o livro. Por favor, tente novamente.')
    }
  }

  const removerLivro = async (livroId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_books')
        .delete()
        .eq('user_id', user.id)
        .eq('book_id', livroId)

      if (error) throw error

      await carregarLivros(user.id)
    } catch (error) {
      console.error('Erro ao remover livro:', error)
      setErro('Ocorreu um erro ao remover o livro. Por favor, tente novamente.')
    }
  }

  const atualizarProgresso = async (livroId: string, novoProgresso: number) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_books')
        .update({ progress: novoProgresso })
        .eq('user_id', user.id)
        .eq('book_id', livroId)

      if (error) throw error

      await carregarLivros(user.id)
    } catch (error) {
      console.error('Erro ao atualizar progresso:', error)
      setErro('Ocorreu um erro ao atualizar o progresso. Por favor, tente novamente.')
    }
  }

  const adicionarAnotacao = async () => {
    if (!user || !livroSelecionado) return

    try {
      const { error } = await supabase
        .from('annotations')
        .insert({
          user_id: user.id,
          book_id: livroSelecionado.id,
          content: novaAnotacao
        })

      if (error) throw error

      await carregarLivros(user.id)
      setNovaAnotacao('')
    } catch (error) {
      console.error('Erro ao adicionar anotação:', error)
      setErro('Ocorreu um erro ao adicionar a anotação. Por favor, tente novamente.')
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-white">Carregando...</h1>
          <p className="text-white">Buscando seus livros. Por favor, aguarde.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Meus Livros</h1>
        
        {erro && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        )}

        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">Adicionar Novo Livro</h2>
          <div className="flex space-x-4">
            <Input
              type="text"
              placeholder="Digite o título do livro"
              value={novoLivroTitulo}
              onChange={(e) => setNovoLivroTitulo(e.target.value)}
              className="flex-grow"
            />
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>
          {sugestoes.length > 0 && (
            <ul className="mt-4 space-y-2">
              {sugestoes.map((sugestao) => (
                <li key={sugestao.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
                  <div className="flex items-center space-x-4">
                    <Image
                      src={sugestao.thumbnail}
                      alt={sugestao.titulo}
                      width={50}
                      height={75}
                      className="object-cover"
                    />
                    <div>
                      <h3 className="font-semibold">{sugestao.titulo}</h3>
                      <p className="text-sm text-gray-500">{sugestao.autor}</p>
                    </div>
                  </div>
                  <Button onClick={() => adicionarLivro(sugestao)} className="bg-green-500 hover:bg-green-600 text-white">
                    Adicionar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {livros.map((livro) => (
            <Card key={livro.id} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span className="text-xl font-bold truncate">{livro.titulo}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => removerLivro(livro.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative w-32 h-48">
                    <Image
                      src={livro.thumbnail}
                      alt={livro.titulo}
                      fill
                      style={{ objectFit: 'cover' }}
                      className="rounded-md"
                    />
                  </div>
                  <p className="text-sm text-gray-500">{livro.autor}</p>
                  <Progress value={livro.progresso} className="w-full" />
                  <p className="text-sm text-gray-500">{livro.progresso}% concluído</p>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => abrirModal(livro)}>
                      <Play className="w-4 h-4 mr-2" />
                      Ler
                    </Button>
                    {livro.amazonLink && (
                      <Button variant="outline" size="sm" onClick={() => window.open(livro.amazonLink, '_blank')}>
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Amazon
                      </Button>
                    )}
                    {livro.audibleLink && (
                      <Button variant="outline" size="sm" onClick={() => window.open(livro.audibleLink, '_blank')}>
                        <Headphones className="w-4 h-4 mr-2" />
                        Audible
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Dialog open={modalAberto} onOpenChange={fecharModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-800">{livroSelecionado?.titulo}</DialogTitle>
          </DialogHeader>
          {livroSelecionado && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="relative w-full sm:w-32 h-48">
                  <Image 
                    src={livroSelecionado.thumbnail}
                    alt={livroSelecionado.titulo}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div className="flex-grow">
                  <p className="text-gray-600">Autor: {livroSelecionado.autor}</p>
                  <p className="text-gray-600">Ano: {livroSelecionado.ano}</p>
                  <p className="text-gray-600">ISBN: {livroSelecionado.isbn}</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-gray-800">Descrição:</h3>
                <p className="text-gray-600">{livroSelecionado.descricao}</p>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-gray-800">Progresso:</h3>
                <div className="flex items-center space-x-4">
                  <Progress value={livroSelecionado.progresso} className="flex-grow" />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={livroSelecionado.progresso}
                    onChange={(e) => atualizarProgresso(livroSelecionado.id, parseInt(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-gray-600">%</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-gray-800">Anotações:</h3>
                <div className="space-y-2">
                  {livroSelecionado.anotacoes.map((anotacao, index) => (
                    <div key={index} className="bg-gray-100 p-2 rounded">
                      <p>{anotacao.content}</p>
                      <p className="text-xs text-gray-500">
                        Criada em: {new Date(anotacao.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  <Textarea
                    placeholder="Adicione uma nova anotação..."
                    value={novaAnotacao}
                    onChange={(e) => setNovaAnotacao(e.target.value)}
                  />
                  <Button onClick={adicionarAnotacao} className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                    Adicionar Anotação
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={fecharModal}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default withAuth(MeusLivros)