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
    const checkUserAndLoadBooks = async () => {
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
        console.error('Error in checkUserAndLoadBooks:', error)
        setErro('Ocorreu um erro ao carregar seus dados. Por favor, tente novamente.')
      } finally {
        setCarregando(false)
      }
    }
  
    checkUserAndLoadBooks()
  }, [supabase, router, carregarLivros])

  useEffect(() => {
    const buscarLivros = async (query: string) => {
      try {
        // Primeiro, buscar na tabela books
        const { data: booksData, error: booksError } = await supabase
          .from('books')
          .select('*')
          .ilike('title', `%${query}%`)
          .limit(5)
  
        if (booksError) throw booksError
  
        if (booksData && booksData.length > 0) {
          setSugestoes(booksData.map(livro => ({
            id: livro.id,
            titulo: livro.title,
            autor: livro.author,
            ano: livro.year,
            isbn: livro.isbn,
            amazonLink: livro.amazon_link,
            audibleLink: livro.audible_link,
            thumbnail: livro.thumbnail || '/placeholder.svg?height=200&width=150',
            descricao: livro.description || '',
            progresso: 0,
            anotacoes: []
          })))
        } else {
          // Se não encontrar na tabela books, buscar na API do Google Books
          const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`)
          if (!response.ok) {
            throw new Error(`Erro na resposta da API: ${response.status} ${response.statusText}`)
          }
          const data = await response.json()
          const googleBooks = data.items.slice(0, 5).map((item: any) => ({
            id: item.id,
            titulo: item.volumeInfo.title,
            autor: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Autor desconhecido',
            ano: item.volumeInfo.publishedDate ? new Date(item.volumeInfo.publishedDate).getFullYear() : 'Ano desconhecido',
            isbn: item.volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier || 'ISBN desconhecido',
            amazonLink: `https://www.amazon.com/s?k=${encodeURIComponent(item.volumeInfo.title)}`,
            audibleLink: `https://www.audible.com/search?keywords=${encodeURIComponent(item.volumeInfo.title)}`,
            thumbnail: item.volumeInfo.imageLinks?.thumbnail || '/placeholder.svg?height=200&width=150',
            descricao: item.volumeInfo.description || 'Descrição não disponível',
            progresso: 0,
            anotacoes: []
          }))
          setSugestoes(googleBooks)
        }
      } catch (error) {
        console.error('Erro ao buscar livros:', error)
        setErro('Ocorreu um erro ao buscar livros. Por favor, tente novamente.')
      }
    }

    if (debouncedNovoLivroTitulo) {
      buscarLivros(debouncedNovoLivroTitulo)
    } else {
      setSugestoes([])
    }
  }, [debouncedNovoLivroTitulo, supabase])

  const abrirModal = async (livro: Livro) => {
    try {
      const { data: annotations, error } = await supabase
        .from('annotations')
        .select('*')
        .eq('book_id', livro.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const livroAtualizado = { ...livro, anotacoes: annotations || [] }
      setLivroSelecionado(livroAtualizado)
      setNovaAnotacao('')
      setModalAberto(true)
    } catch (error) {
      console.error('Erro ao carregar anotações:', error)
      setErro('Ocorreu um erro ao carregar as anotações. Por favor, tente novamente.')
    }
  }

  const fecharModal = async () => {
    if (livroSelecionado && novaAnotacao.trim() !== '') {
      await adicionarAnotacao(livroSelecionado.id, novaAnotacao)
    }
    setLivroSelecionado(null)
    setModalAberto(false)
    setNovoLivroTitulo('')
    setSugestoes([])
    if (user) {
      await carregarLivros(user.id)
    }
  }

  const adicionarLivro = async (livro: Livro) => {
    if (!user) {
      setErro('Você precisa estar logado para adicionar livros.')
      return
    }
  
    try {
      if (!user.isPremium) {
        const { count, error } = await supabase
          .from('user_books')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
  
        if (error) {
          console.error('Erro ao contar livros do usuário:', error)
          setErro('Ocorreu um erro ao verificar seus livros. Por favor, tente novamente.')
          return
        }
  
        if (count >= 2) {
          setErro('Você é um usuário gratuito e já tem 2 livros adicionados. Delete um dos livros ou faça o upgrade para premium.')
          return
        }
      }
  
      let bookId = livro.id
  
      // Verificar se o livro já existe na tabela books
      const { data: existingBook, error: existingBookError } = await supabase
        .from('books')
        .select('id')
        .eq('isbn', livro.isbn)
        .single()
  
      if (existingBookError && existingBookError.code !== 'PGRST116') {
        throw existingBookError
      }
  
      if (!existingBook) {
        // Se o livro não existe, inserir na tabela books
        const { data: newBook, error: newBookError } = await supabase
          .from('books')
          .insert({
            title: livro.titulo,
            author: livro.autor,
            year: livro.ano,
            isbn: livro.isbn,
            amazon_link: livro.amazonLink,
            audible_link: livro.audibleLink,
            thumbnail: livro.thumbnail,
            description: livro.descricao
          })
          .select()
          .single()
  
        if (newBookError) throw newBookError
        bookId = newBook.id
      } else {
        bookId = existingBook.id
      }
  
      // Adicionar o livro à tabela user_books
      const { error: userBookError } = await supabase
        .from('user_books')
        .insert({
          user_id: user.id,
          book_id: bookId,
          progress: 0
        })
  
      if (userBookError) throw userBookError
  
      await carregarLivros(user.id)
      setNovoLivroTitulo('')
      setSugestoes([])
    } catch (error) {
      console.error('Erro ao adicionar livro:', error)
      setErro('Ocorreu um erro ao adicionar o livro. Por favor, tente novamente.')
    }
  }

  const adicionarAnotacao = async (bookId: string, content: string) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('annotations')
        .insert({
          user_id: user.id,
          book_id: bookId,
          content: content
        })
        .select()

      if (error) throw error

      if (data) {
        const livrosAtualizados = livros.map(livro => 
          livro.id === bookId ? { ...livro, anotacoes: [data[0], ...livro.anotacoes] } : livro
        )
        setLivros(livrosAtualizados)
        
        if (livroSelecionado && livroSelecionado.id === bookId) {
          setLivroSelecionado({ ...livroSelecionado, anotacoes: [data[0], ...livroSelecionado.anotacoes] })
        }
        setNovaAnotacao('')
      }
    } catch (error) {
      console.error('Erro ao adicionar anotação:', error)
      setErro('Ocorreu um erro ao adicionar a anotação. Por favor, tente novamente.')
    }
  }

  const excluirLivro = async (id: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('user_books')
        .delete()
        .eq('user_id', user.id)
        .eq('book_id', id)

      if (error) throw error

      await carregarLivros(user.id)
    } catch (error) {
      console.error('Erro ao excluir livro:', error)
      setErro('Ocorreu um erro ao excluir o livro. Por favor, tente novamente.')
    }
  }

  const ouvirResumo = (livro: Livro) => {
    console.log(`Ouvindo resumo de ${livro.titulo}`)
    // Implementar lógica de texto para fala aqui
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
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-gray-800">Meus Livros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-6">
              <div className="relative w-64">
                <Input
                  placeholder="Buscar novo livro"
                  value={novoLivroTitulo}
                  onChange={(e) => setNovoLivroTitulo(e.target.value)}
                  className="w-full"
                  aria-label="Buscar novo livro"
                />
                <Button className="absolute right-0 top-0 h-full bg-purple-600 hover:bg-purple-700 text-white" aria-label="Buscar">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {sugestoes.length > 0 && (
              <div className="mb-6 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {sugestoes.map((livro) => (
                  <div
                    key={livro.id}
                    className="p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => adicionarLivro(livro)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Adicionar ${livro.titulo}`}
                  >
                    <p className="font-semibold">{livro.titulo}</p>
                    <p className="text-sm text-gray-600">{livro.autor}</p>
                  </div>
                ))}
              </div>
            )}

            {erro && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            {livros.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {livros.map(livro => (
                  <Card key={livro.id} className="relative hover:shadow-lg transition-shadow duration-200 cursor-pointer" onClick={() => abrirModal(livro)}>
                    <CardHeader>
                      <CardTitle>{livro.titulo}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-4">
                        <div className="relative w-20 h-30">
                          <Image 
                            src={livro.thumbnail} 
                            alt={livro.titulo} 
                            width={80}
                            height={120}
                            style={{ objectFit: 'cover' }}
                          />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-2">por {livro.autor}</p>
                          <Progress value={livro.progresso} className="w-full" />
                          <p className="text-sm text-gray-500 mt-2">{livro.progresso}% concluído</p>
                        </div>
                      </div>
                    </CardContent>
                    <Button
                      className="absolute bottom-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        excluirLivro(livro.id)
                      }}
                      aria-label={`Excluir ${livro.titulo}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-xl text-gray-600">Você ainda não adicionou nenhum livro.</p>
                <p className="text-gray-500 mt-2">Use a barra de busca acima para adicionar seu primeiro livro!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={modalAberto} onOpenChange={fecharModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{livroSelecionado?.titulo}</DialogTitle>
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
                <div>
                  <p className="text-sm text-gray-500">por {livroSelecionado.autor}</p>
                  <p className="text-sm text-gray-500">Ano: {livroSelecionado.ano}</p>
                  <p className="text-sm text-gray-500">ISBN: {livroSelecionado.isbn}</p>
                  <p className="text-sm text-gray-500 mt-2">Progresso: {livroSelecionado.progresso}%</p>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Descrição:</h3>
                <div className="max-h-40 overflow-y-auto">
                  <p>{livroSelecionado.descricao}</p>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Suas Anotações:</h3>
                <div className="max-h-40 overflow-y-auto">
                  {livroSelecionado.anotacoes.length > 0 ? (
                    livroSelecionado.anotacoes.map((anotacao) => (
                      <div key={anotacao.id} className="bg-gray-100 p-2 rounded mb-2">
                        <p>{anotacao.content}</p>
                        <p className="text-xs text-gray-500">
                          Criada em: {new Date(anotacao.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">Você ainda não fez nenhuma anotação para este livro.</p>
                  )}
                </div>
                <Textarea
                  value={novaAnotacao}
                  onChange={(e) => setNovaAnotacao(e.target.value)}
                  className="w-full h-32"
                  placeholder="Digite uma nova anotação aqui..."
                />
                <Button onClick={() => adicionarAnotacao(livroSelecionado.id, novaAnotacao)}>
                  Adicionar Anotação
                </Button>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => ouvirResumo(livroSelecionado)}>
                  <Play className="w-4 h-4 mr-2" />
                  Ouvir Resumo
                </Button>
                <Button className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => window.open(livroSelecionado.amazonLink, '_blank')}>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Comprar na Amazon
                </Button>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => window.open(livroSelecionado.audibleLink, '_blank')}>
                  <Headphones className="w-4 h-4 mr-2" />
                  Ouvir no Audible
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={fecharModal} className="bg-gray-500 hover:bg-gray-600 text-white">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default withAuth(MeusLivros);