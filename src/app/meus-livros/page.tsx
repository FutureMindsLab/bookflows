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

interface GoogleBookIndustryIdentifier {
  type: string;
  identifier: string;
}

interface GoogleBookVolumeInfo {
  title: string;
  authors?: string[];
  publishedDate?: string;
  industryIdentifiers?: GoogleBookIndustryIdentifier[];
  imageLinks?: {
    thumbnail?: string;
  };
  description?: string;
}

interface GoogleBookItem {
  id: string;
  volumeInfo: GoogleBookVolumeInfo;
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
        const livrosCarregados = data.map(item => ({
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
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          throw new Error("Nenhuma sessão ativa encontrada")
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
  }, [carregarLivros, supabase])

  useEffect(() => {
    const buscarLivros = async () => {
      if (debouncedNovoLivroTitulo.length > 2) {
        try {
          const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(debouncedNovoLivroTitulo)}&maxResults=5`)
          const data = await response.json()
          if (data.items) {
            const sugestoesLivros = data.items.map((item: GoogleBookItem) => ({
              id: item.id,
              titulo: item.volumeInfo.title,
              autor: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Autor desconhecido',
              ano: item.volumeInfo.publishedDate ? parseInt(item.volumeInfo.publishedDate.substring(0, 4)) : 0,
              isbn: item.volumeInfo.industryIdentifiers?.find((id: GoogleBookIndustryIdentifier) => id.type === 'ISBN_13')?.identifier || '',
              amazonLink: '',
              audibleLink: '',
              thumbnail: item.volumeInfo.imageLinks?.thumbnail || '/placeholder.svg?height=200&width=150',
              descricao: item.volumeInfo.description || '',
              progresso: 0,
              anotacoes: []
            }))
            setSugestoes(sugestoesLivros)
          }
        } catch (error) {
          console.error('Erro ao buscar sugestões:', error)
        }
      } else {
        setSugestoes([])
      }
    }

    buscarLivros()
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
      const { data, error } = await supabase
        .from('books')
        .insert([
          {
            title: livro.titulo,
            author: livro.autor,
            year: livro.ano,
            isbn: livro.isbn,
            amazon_link: livro.amazonLink,
            audible_link: livro.audibleLink,
            thumbnail: livro.thumbnail,
            description: livro.descricao
          }
        ])
        .select()

      if (error) throw error

      if (data) {
        const newBookId = data[0].id
        const { error: userBookError } = await supabase
          .from('user_books')
          .insert([
            { user_id: user.id, book_id: newBookId, progress: 0 }
          ])

        if (userBookError) throw userBookError

        await carregarLivros(user.id)
      }

      setNovoLivroTitulo('')
      setSugestoes([])
    } catch (error) {
      console.error('Erro ao adicionar livro:', error)
      setErro('Ocorreu um erro ao adicionar o livro. Por favor, tente novamente.')
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

      setLivros(livros.map(livro => 
        livro.id === livroId ? { ...livro, progresso: novoProgresso } : livro
      ))
    } catch (error) {
      console.error('Erro ao atualizar progresso:', error)
      setErro('Ocorreu um erro ao atualizar o progresso. Por favor, tente novamente.')
    }
  }

  const adicionarAnotacao = async () => {
    if (!user || !livroSelecionado) return

    try {
      const { data, error } = await supabase
        .from('annotations')
        .insert([
          { 
            user_id: user.id,
            book_id: livroSelecionado.id,
            content: novaAnotacao
          }
        ])
        .select()

      if (error) throw error

      if (data) {
        const novaAnotacaoObj = {
          id: data[0].id,
          content: data[0].content,
          created_at: data[0].created_at,
          updated_at: data[0].updated_at
        }

        setLivros(livros.map(livro => 
          livro.id === livroSelecionado.id 
            ? { ...livro, anotacoes: [...livro.anotacoes, novaAnotacaoObj] }
            : livro
        ))

        setLivroSelecionado({
          ...livroSelecionado,
          anotacoes: [...livroSelecionado.anotacoes, novaAnotacaoObj]
        })

        setNovaAnotacao('')
      }
    } catch (error) {
      console.error('Erro ao adicionar anotação:', error)
      setErro('Ocorreu um erro ao adicionar a anotação. Por favor, tente novamente.')
    }
  }

  const excluirAnotacao = async (anotacaoId: string) => {
    if (!user || !livroSelecionado) return

    try {
      const { error } = await supabase
        .from('annotations')
        .delete()
        .eq('id', anotacaoId)

      if (error) throw error

      setLivros(livros.map(livro => 
        livro.id === livroSelecionado.id 
          ? { ...livro, anotacoes: livro.anotacoes.filter(a => a.id !== anotacaoId) }
          : livro
      ))

      setLivroSelecionado({
        ...livroSelecionado,
        anotacoes: livroSelecionado.anotacoes.filter(a => a.id !== anotacaoId)
      })
    } catch (error) {
      console.error('Erro ao excluir anotação:', error)
      setErro('Ocorreu um erro ao excluir a anotação. Por favor, tente novamente.')
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

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Adicionar Novo Livro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Digite o título do livro"
                value={novoLivroTitulo}
                onChange={(e) => setNovoLivroTitulo(e.target.value)}
              />
              {sugestoes.length > 0 && (
                <div className="space-y-2">
                  {sugestoes.map((sugestao) => (
                    <div key={sugestao.id} className="flex items-center justify-between bg-white p-2 rounded shadow">
                      <div className="flex items-center space-x-2">
                        <Image
                          src={sugestao.thumbnail}
                          alt={sugestao.titulo}
                          width={40}
                          height={60}
                          className="object-cover"
                        />
                        <div>
                          <p className="font-semibold">{sugestao.titulo}</p>
                          <p className="text-sm text-gray-500">{sugestao.autor}</p>
                        </div>
                      </div>
                      <Button onClick={() => adicionarLivro(sugestao)}>Adicionar</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {livros.map((livro) => (
            <Card key={livro.id} className="cursor-pointer hover:shadow-lg transition-shadow duration-200" onClick={() => abrirModal(livro)}>
              <CardContent className="p-4">
                <div className="relative w-full h-64 mb-4">
                  <Image
                    src={livro.thumbnail}
                    alt={livro.titulo}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <h3 className="text-lg font-semibold mb-2">{livro.titulo}</h3>
                <p className="text-sm text-gray-500 mb-2">{livro.autor}</p>
                <Progress value={livro.progresso} className="mb-2" />
                <p className="text-sm text-gray-500">{livro.progresso}% concluído</p>
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
            <div className="space-y-4">
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
                  <div className="mt-4">
                    <label htmlFor="progresso" className="block text-sm font-medium text-gray-700 mb-1">
                      Progresso:
                    </label>
                    <Input
                      id="progresso"
                      type="number"
                      min="0"
                      max="100"
                      value={livroSelecionado.progresso}
                      onChange={(e) => atualizarProgresso(livroSelecionado.id, Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-gray-800">Descrição:</h3>
                <p className="text-gray-600">{livroSelecionado.descricao}</p>
              </div>
              <div className="space-y-2">
                {livroSelecionado.amazonLink && (
                  <Button variant="outline" className="w-full" onClick={() => window.open(livroSelecionado.amazonLink, '_blank')}>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Ver na Amazon
                  </Button>
                )}
                {livroSelecionado.audibleLink && (
                  <Button variant="outline" className="w-full" onClick={() => window.open(livroSelecionado.audibleLink, '_blank')}>
                    <Headphones className="w-4 h-4 mr-2" />
                    Ver no Audible
                  </Button>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-gray-800">Suas Anotações:</h3>
                <div className="space-y-2 mb-4">
                  {livroSelecionado.anotacoes.map((anotacao) => (
                    <div key={anotacao.id} className="bg-gray-100 p-2 rounded flex justify-between items-start">
                      <div>
                        <p>{anotacao.content}</p>
                        <p className="text-xs text-gray-500">
                          Criada em: {new Date(anotacao.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => excluirAnotacao(anotacao.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <Textarea
                    value={novaAnotacao}
                    onChange={(e) => setNovaAnotacao(e.target.value)}
                    placeholder="Adicione uma nova anotação..."
                    className="flex-grow"
                  />
                  <Button onClick={adicionarAnotacao} disabled={!novaAnotacao.trim()}>
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => router.push('/dashboard')}>
              <Play className="w-4 h-4 mr-2" />
              Continuar Lendo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default withAuth(MeusLivros)