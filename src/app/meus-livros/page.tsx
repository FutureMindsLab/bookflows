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
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { ShoppingCart, Headphones, Play, Search, AlertCircle, Trash2 } from 'lucide-react'
import { useDebounce } from 'use-debounce'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Annotation {
  id: string
  content: string
  created_at: string
  updated_at: string
  user_book_id: string
}

interface Livro {
  id: string
  title: string
  author: string
  year: number | null
  isbn: string | null
  amazon_link: string | null
  audible_link: string | null
  thumbnail: string
  description: string
  progress: number
  annotations: Annotation[]
}

interface User {
  id: string
  isPremium: boolean
}

const MeusLivros: React.FC = () => {
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

  const checkUserAndLoadBooks = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
  
      if (!session) {
        console.log('No session found, redirecting to login')
        router.push('/login')
        return
      }
  
      console.log('Session user ID:', session.user.id)
  
      let userData
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, auth_id, is_premium')
        .eq('auth_id', session.user.id)
        .single()
  
      if (userError) {
        console.error('Error fetching user data:', userError)
        setErro('Ocorreu um erro ao carregar seus dados. Por favor, tente novamente.')
        return
      }
  
      if (!data) {
        console.log('User not found in users table')
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({ auth_id: session.user.id, is_premium: false })
          .select()
          .single()
  
        if (createError) {
          console.error('Error creating new user:', createError)
          setErro('Não foi possível criar um novo usuário. Por favor, contate o suporte.')
          return
        }
  
        console.log('New user created:', newUser)
        userData = newUser
      } else {
        userData = data
      }
  
      console.log('User data:', userData)
  
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

  const carregarLivros = useCallback(async (userId: string) => {
    try {
      const { data: userBooksData, error: userBooksError } = await supabase
        .from('user_books')
        .select(`
          id,
          book_id,
          progress,
          annotations (id, content, created_at, updated_at, user_book_id)
        `)
        .eq('user_id', userId)
        .eq('status', true)
      
      if (userBooksError) throw userBooksError
  
      if (!userBooksData || userBooksData.length === 0) {
        setLivros([])
        return
      }
  
      const bookPromises = userBooksData.map(async (userBook) => {
        const { data: bookData, error: bookError } = await supabase
          .from('books')
          .select(`
            id,
            title,
            author,
            year,
            isbn,
            amazon_link,
            audible_link,
            thumbnail,
            description
          `)
          .eq('id', userBook.book_id)
          .single()
  
        if (bookError) throw bookError
  
        return {
          id: userBook.id,
          book_id: bookData.id,
          title: bookData.title,
          author: bookData.author,
          year: bookData.year,
          isbn: bookData.isbn,
          amazon_link: bookData.amazon_link,
          audible_link: bookData.audible_link,
          thumbnail: bookData.thumbnail || '/placeholder.svg?height=200&width=150',
          description: bookData.description || '',
          progress: userBook.progress,
          annotations: userBook.annotations || []
        }
      })
  
      const livrosCarregados = await Promise.all(bookPromises)
      setLivros(livrosCarregados)
    } catch (error) {
      console.error('Erro ao carregar livros:', error)
      setErro('Ocorreu um erro ao carregar seus livros. Por favor, tente novamente.')
    }
  }, [supabase])

  useEffect(() => {
    checkUserAndLoadBooks()
  }, [])

  useEffect(() => {
    const buscarLivros = async (query: string) => {
      try {
        const { data: booksData, error: booksError } = await supabase
          .from('books')
          .select('*')
          .ilike('title', `%${query}%`)
          .limit(5)

        if (booksError) throw booksError

        if (booksData && booksData.length > 0) {
          setSugestoes(booksData.map(livro => ({
            id: livro.id,
            title: livro.title,
            author: livro.author,
            year: livro.year,
            isbn: livro.isbn,
            amazon_link: livro.amazon_link,
            audible_link: livro.audible_link,
            thumbnail: livro.thumbnail || '/placeholder.svg?height=200&width=150',
            description: livro.description || '',
            progress: 0,
            annotations: []
          })))
        } else {
          const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}`)
          if (!response.ok) {
            throw new Error(`API response error: ${response.status} ${response.statusText}`)
          }
          const data = await response.json()
          const googleBooks = data.items.slice(0, 5).map((item: any) => ({
            id: item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown Author',
            year: item.volumeInfo.publishedDate ? new Date(item.volumeInfo.publishedDate).getFullYear() : null,
            isbn: item.volumeInfo.industryIdentifiers?.find((id: any) => id.type === 'ISBN_13')?.identifier || null,
            amazon_link: `https://www.amazon.com/s?k=${encodeURIComponent(item.volumeInfo.title)}`,
            audible_link: `https://www.audible.com/search?keywords=${encodeURIComponent(item.volumeInfo.title)}`,
            thumbnail: item.volumeInfo.imageLinks?.thumbnail || '/placeholder.svg?height=200&width=150',
            description: item.volumeInfo.description || '',
            progress: 0,
            annotations: []
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
        .eq('user_book_id', livro.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const livroAtualizado = { ...livro, annotations: annotations || [] }
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
      let userData
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, is_premium')
        .eq('id', user.id)
        .single()

      if (userError && userError.code === 'PGRST116') {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({ id: user.id, is_premium: false })
          .select()
          .single()

        if (createError) {
          console.error('Error creating new user:', createError)
          setErro('Ocorreu um erro ao criar seu perfil. Por favor, tente novamente.')
          return
        }

        userData = newUser
      } else if (userError) {
        console.error('Error fetching user data:', userError)
        setErro('Ocorreu um erro ao verificar seus dados. Por favor, tente novamente.')
        return
      } else {
        userData = data
      }

      if (!userData) {
        setErro('Usuário não encontrado. Por favor, faça login novamente.')
        return
      }

      if (!userData.is_premium) {
        const { count, error } = await supabase
          .from('user_books')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userData.id)
          .eq('status', true)

        if (error) {
          console.error('Erro ao contar livros do usuário:', error)
          setErro('Ocorreu um erro ao verificar seus livros. Por favor, tente novamente.')
          return
        }

        const bookCount = count ?? 0

        if (bookCount >= 2) {
          setErro('Você é um usuário gratuito e já tem 2 livros adicionados. Delete um dos livros ou faça o upgrade para premium.')
          return
        }
      }

      let bookId = livro.id
      const { data: existingBook, error: existingBookError } = await supabase
        .from('books')
        .select('id')
        .eq('title', livro.title)
        .eq('author', livro.author)
        .single()

      if (existingBookError && existingBookError.code !== 'PGRST116') {
        throw existingBookError
      }

      if (!existingBook) {
        const { data: newBook, error: insertBookError } = await supabase
          .from('books')
          .insert({
            title: livro.title,
            author: livro.author,
            year: livro.year,
            isbn: livro.isbn,
            amazon_link: livro.amazon_link,
            audible_link: livro.audible_link,
            thumbnail: livro.thumbnail,
            description: livro.description
          })
          .select()

        if (insertBookError) throw insertBookError
        bookId = newBook[0].id
      } else {
        bookId = existingBook.id
      }

      const { data: existingUserBook, error: existingUserBookError } = await supabase
        .from('user_books')
        .select('id, status')
        .eq('user_id', userData.id)
        .eq('book_id', bookId)
        .single()

      if (existingUserBookError && existingUserBookError.code !== 'PGRST116') {
        throw existingUserBookError
      }

      if (existingUserBook) {
        if (existingUserBook.status) {
          setErro('Este livro já está na sua lista.')
          return
        } else {
          const { error: updateError } = await supabase
            .from('user_books')
            .update({ status: true })
            .eq('id', existingUserBook.id)

          if (updateError) throw updateError
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_books')
          .insert({
            user_id: userData.id,
            book_id: bookId,
            progress: 0,
            status: true
          })

        if (insertError)

 throw insertError
      }

      await carregarLivros(userData.id)
      setNovoLivroTitulo('')
      setSugestoes([])
    } catch (error) {
      console.error('Erro ao adicionar livro:', error)
      setErro('Ocorreu um erro ao adicionar o livro. Por favor, tente novamente.')
    }
  }

  const adicionarAnotacao = async (userBookId: string, content: string) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('annotations')
        .insert({
          user_id: user.id,
          user_book_id: userBookId,
          content: content
        })
        .select()

      if (error) throw error

      if (data) {
        const livrosAtualizados = livros.map(livro => 
          livro.id === userBookId ? { ...livro, annotations: [data[0], ...livro.annotations] } : livro
        )
        setLivros(livrosAtualizados)
        
        if (livroSelecionado && livroSelecionado.id === userBookId) {
          setLivroSelecionado({ ...livroSelecionado, annotations: [data[0], ...livroSelecionado.annotations] })
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
        .update({ status: false })
        .eq('user_id', user.id)
        .eq('id', id)

      if (error) throw error

      await carregarLivros(user.id)
      setErro(null) // Clear any existing error messages
    } catch (error) {
      console.error('Erro ao excluir livro:', error)
      setErro('Ocorreu um erro ao excluir o livro. Por favor, tente novamente.')
    }
  }

  const ouvirResumo = (livro: Livro) => {
    console.log(`Ouvindo resumo de ${livro.title}`)
    // Implement text-to-speech logic here
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
              <div className="relative w-full">
                <Input
                  placeholder="Buscar novo livro"
                  value={novoLivroTitulo}
                  onChange={(e) => setNovoLivroTitulo(e.target.value)}
                  className="w-full pr-10"
                  aria-label="Buscar novo livro"
                />
                <Button className="absolute right-0 top-0 h-full bg-purple-600 hover:bg-purple-700 text-white" aria-label="Buscar">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {sugestoes.length > 0 && (
              <div className="mb-6 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
                {sugestoes.map((livro) => (
                  <div
                    key={livro.id}
                    className="p-4 hover:bg-gray-100 cursor-pointer flex items-center space-x-4"
                    onClick={() => adicionarLivro(livro)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Adicionar ${livro.title}`}
                  >
                    <Image 
                      src={livro.thumbnail} 
                      alt={livro.title}
                      width={60}
                      height={90}
                      className="object-cover"
                    />
                    <div>
                      <p className="font-semibold">{livro.title}</p>
                      <p className="text-sm text-gray-600">{livro.author}</p>
                    </div>
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
                      <CardTitle>{livro.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-4">
                        <div className="relative w-20 h-30">
                          <Image 
                            src={livro.thumbnail} 
                            alt={livro.title} 
                            width={80}
                            height={120}
                            style={{ objectFit: 'cover' }}
                          />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-2">por {livro.author}</p>
                        </div>
                      </div>
                    </CardContent>
                    <Button
                      className="absolute bottom-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        excluirLivro(livro.id)
                      }}
                      aria-label={`Excluir ${livro.title}`}
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
            <DialogTitle>{livroSelecionado?.title}</DialogTitle>
          </DialogHeader>
          {livroSelecionado && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="relative w-full sm:w-32 h-48">
                  <Image 
                    src={livroSelecionado.thumbnail} 
                    alt={livroSelecionado.title} 
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500">por {livroSelecionado.author}</p>
                  <p className="text-sm text-gray-500">Ano: {livroSelecionado.year}</p>
                  <p className="text-sm text-gray-500">ISBN: {livroSelecionado.isbn}</p>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Descrição:</h3>
                <div className="max-h-40 overflow-y-auto">
                  <p>{livroSelecionado.description}</p>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Suas Anotações:</h3>
                <div className="max-h-40 overflow-y-auto">
                  {livroSelecionado.annotations.length > 0 ? (
                    livroSelecionado.annotations.map((anotacao) => (
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
                <Button 
                  className="bg-yellow-500 hover:bg-yellow-600 text-white" 
                  onClick={() => {
                    if (livroSelecionado.amazon_link) {
                      window.open(livroSelecionado.amazon_link, '_blank')
                    }
                  }}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Comprar na Amazon
                </Button>
                <Button 
                  className="bg-orange-500 hover:bg-orange-600 text-white" 
                  onClick={() => {
                    if (livroSelecionado.audible_link) {
                      window.open(livroSelecionado.audible_link, '_blank')
                    }
                  }}
                >
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
  )
}

export default withAuth(MeusLivros)