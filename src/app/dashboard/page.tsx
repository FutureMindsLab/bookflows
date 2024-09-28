'use client'

import { withAuth } from '@/Components/withAuth'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Navigation from '@/Components/Navigation'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Progress } from '../components/ui/progress'
import { MessageCircle, Brain, BookOpen, User } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Textarea } from '../components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog'
import { ScrollArea } from '../components/ui/scroll-area'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { AlertCircle } from 'lucide-react'
import OpenAI from 'openai'

let openai: OpenAI | null = null;

if (typeof window !== 'undefined') {
  try {
    if (!process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
      console.error('NEXT_PUBLIC_OPENAI_API_KEY is not set in the environment');
    } else {
      openai = new OpenAI({
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        dangerouslyAllowBrowser: true
      });
      console.log('OpenAI client initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing OpenAI client:', error);
  }
}

interface Annotation {
  id: string
  content: string
  created_at: string
  updated_at: string
  book_id: string
}

interface Book {
  id: string
  title: string
  author: string
  year: number
  isbn: string
  amazon_link: string
  audible_link: string
  thumbnail: string
  description: string
  progress: number
  annotations: Annotation[]
}

interface Conversation {
  bookId: string
  messages: { role: 'user' | 'assistant', content: string }[]
}

interface User {
  id: string
  isPremium: boolean
}

function Dashboard() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null)
  const [userBooks, setUserBooks] = useState<Book[]>([])
  const [recentAnnotations, setRecentAnnotations] = useState<Annotation[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [annotationModalOpen, setAnnotationModalOpen] = useState(false)
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [conversations, setConversations] = useState<{ [key: string]: Conversation }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [dailyMessageCount, setDailyMessageCount] = useState(0)
  const [isLimitReached, setIsLimitReached] = useState(false)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)

  const supabase = createClientComponentClient()

  const fetchCurrentBook = useCallback(async (userId: string): Promise<Book | null> => {
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
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (error) {
        console.error('Erro ao buscar o livro atual:', error)
        return null
      }
      
      return data ? {
        id: data.books.id,
        title: data.books.title,
        author: data.books.author,
        year: data.books.year,
        isbn: data.books.isbn,
        amazon_link: data.books.amazon_link,
        audible_link: data.books.audible_link,
        thumbnail: data.books.thumbnail || '/placeholder.svg?height=200&width=150',
        description: data.books.description || '',
        progress: data.progress,
        annotations: []
      } : null
    } catch (error) {
      console.error('Error fetching current book:', error)
      return null
    }
  }, [supabase])

  const fetchRecentAnnotations = useCallback(async (userId: string): Promise<Annotation[]> => {
    try {
      const { data, error } = await supabase
        .from('annotations')
        .select('id, content, created_at, updated_at, book_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) {
        console.error('Erro ao buscar anotações recentes:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error fetching recent annotations:', error)
      return []
    }
  }, [supabase])

  const fetchUserBooks = useCallback(async (userId: string): Promise<Book[]> => {
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
          )
        `)
        .eq('user_id', userId)
      
      if (error) {
        console.error('Erro ao buscar livros do usuário:', error)
        return []
      }
      
      return data.map(item => ({
        id: item.books.id,
        title: item.books.title,
        author: item.books.author,
        year: item.books.year,
        isbn: item.books.isbn,
        amazon_link: item.books.amazon_link,
        audible_link: item.books.audible_link,
        thumbnail: item.books.thumbnail || '/placeholder.svg?height=200&width=150',
        description: item.books.description || '',
        progress: item.progress,
        annotations: []
      }))
    } catch (error) {
      console.error('Error fetching user books:', error)
      return []
    }
  }, [supabase])

  useEffect(() => {
    const fetchData = async (retryCount = 0) => {
      setIsLoading(true)
      setError(null)
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('Dados da sessão:', session)
        console.log('Erro da sessão:', sessionError)

        if (sessionError) throw sessionError

        if (!session) {
          if (retryCount < 3) {
            console.log(`Sessão não encontrada. Tentando novamente... (Tentativa ${retryCount + 1})`)
            setTimeout(() => fetchData(retryCount + 1), 1000)
            return
          }
          throw new Error("Nenhuma sessão ativa encontrada após as tentativas")
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

        const [currentBookData, annotationsData, userBooksData] = await Promise.all([
          fetchCurrentBook(userData.id),
          fetchRecentAnnotations(userData.id),
          fetchUserBooks(userData.id)
        ])

        console.log('Dados obtidos:', { currentBookData, annotationsData, userBooksData })

        setCurrentBook(currentBookData)
        setRecentAnnotations(annotationsData)
        setUserBooks(userBooksData)

        if (userBooksData && userBooksData.length > 0) {
          setSelectedBookId(userBooksData[0].id)
        }

        // Fetch daily message count
        const { data: messageCountData, error: messageCountError } = await supabase
          .from('user_daily_messages')
          .select('message_count')
          .eq('user_id', userData.id)
          .eq('date', new Date().toISOString().split('T')[0])
          .maybeSingle()

        if (messageCountError) {
          console.error('Error fetching daily message count:', messageCountError)
        } else {
          setDailyMessageCount(messageCountData?.message_count || 0)
          setIsLimitReached(messageCountData?.message_count >= 100)
        }

      } catch (err) {
        console.error('Erro ao buscar dados:', err)
        // We're not setting an error state here anymore
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [fetchCurrentBook, fetchRecentAnnotations, fetchUserBooks, supabase])

  const openModal = (book: Book) => {
    setCurrentBook(book)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
  }

  const openAnnotationModal = (annotation: Annotation) => {
    setSelectedAnnotation(annotation)
    setAnnotationModalOpen(true)
  }

  const closeAnnotationModal = () => {
    setSelectedAnnotation(null)
    setAnnotationModalOpen(false)
  }

  const updateDailyMessageCount = async () => {
    if (!user) return

    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase
      .from('user_daily_messages')
      .upsert(
        { user_id: user.id, date: today, message_count: dailyMessageCount + 1 },
        { onConflict: 'user_id,date' }
      )

    if (error) {
      console.error('Error updating daily message count:', error)
    } else {
      setDailyMessageCount(prevCount => {
        const newCount = prevCount + 1
        setIsLimitReached(newCount >= 100)
        return newCount
      })
    }
  }

  const sendMessage = async () => {
    if (message.trim() === '' || !selectedBookId || isLimitReached) return
    setIsSending(true)

    const newMessage = { role: 'user' as const, content: message }
    const updatedConversations = { ...conversations }
    
    if (!updatedConversations[selectedBookId]) {
      updatedConversations[selectedBookId] = { bookId: selectedBookId, messages: [] }
    }
    
    updatedConversations[selectedBookId].messages.push(newMessage)
    setConversations(updatedConversations)

    try {
      if (!openai) {
        throw new Error('OpenAI client is not initialized');
      }

      const selectedBook = userBooks.find(book => book.id === selectedBookId)
      const context = `Livro: ${selectedBook?.title} por ${selectedBook?.author}. Resumo: ${selectedBook?.description}`
      
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: `Você é um assistente especializado em literatura. Você pode responder perguntas sobre o livro atual apenas se o usuário selecionou o livro. Você não pode falar de nenhum outro tópico que não tenha relação com o livro em questão. Porém, talvez existam temas que são abordados no livro que você pode trazer uma visão aprofundada em tópicos relacionados. Se lembre que você é um especialista em literatura, logo você pode ajudar em coisas gerais, só não desvie para tópicos que não tenham relação direta ou indireta com o livro. Por exemplo, um livro sobre negócios você responder coisas sobre ficção ou aventura. Em alguns momentos você pode agir como o autor do livro, caso o usuário pergunte sobre isso, você também pode responder como um personagem do livro, caso o usuário pergunte sobre isso. O contexto do livro atual é: ${context}` },
          ...updatedConversations[selectedBookId].messages
        ],
      })

      const aiMessage = { role: 'assistant' as const, content: response.choices[0].message.content || "Desculpe, não consegui gerar uma resposta." }
      updatedConversations[selectedBookId].messages.push(aiMessage)
      setConversations({ ...updatedConversations })

      await updateDailyMessageCount()
    } catch (error) {
      console.error('Erro ao enviar mensagem para OpenAI:', error)
      const errorMessage = { role: 'assistant' as const, content: "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente." }
      updatedConversations[selectedBookId].messages.push(errorMessage)
      setConversations({ ...updatedConversations })
    } finally {
      setIsSending(false)
      setMessage('')
      if (messageInputRef.current) {
        messageInputRef.current.focus()
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (isLoading) {
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
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Sua Jornada de Leitura</h1>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {currentBook ? (
            <Card className="cursor-pointer hover:shadow-md transition-shadow duration-200" onClick={() => openModal(currentBook)}>
              <CardHeader>
                <CardTitle>Leitura Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="relative w-20 h-30">
                    <Image 
                      src={currentBook.thumbnail}
                      alt={currentBook.title}
                      width={80}
                      height={120}
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{currentBook.title}</h3>
                    <p className="text-sm text-gray-500">por {currentBook.author}</p>
                    <Progress value={currentBook.progress} className="mt-2" />
                    <p className="text-sm text-gray-500 mt-1">{currentBook.progress}% concluído</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Nenhum livro atual</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Você ainda não começou a ler nenhum livro. Que tal começar agora?</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Anotações Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {recentAnnotations.length > 0 ? (
                <ul className="space-y-2">
                  {recentAnnotations.map((annotation) => (
                    <li 
                      key={annotation.id} 
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 p-2 rounded"
                      onClick={() => openAnnotationModal(annotation)}
                    >
                      <MessageCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <span className="text-sm truncate">{annotation.content}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Você ainda não fez nenhuma anotação. Comece a anotar enquanto lê!</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo Diário</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">&ldquo;A verdadeira liderança é servir. Liderar é servir. Servir é liderar.&rdquo; - O Monge e o Executivo</p>
              <Button className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white">Obter Mais Insights</Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Converse com o BookFlows AI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select value={selectedBookId || undefined} onValueChange={setSelectedBookId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um livro" />
                </SelectTrigger>
                <SelectContent>
                  {userBooks && userBooks.length > 0 ? (
                    userBooks.map((book) => (
                      <SelectItem key={book.id} value={book.id}>{book.title}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-books" disabled>Nenhum livro disponível</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {userBooks.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Nenhum livro encontrado</AlertTitle>
                  <AlertDescription>
                    Você ainda não adicionou nenhum livro à sua coleção. Adicione um livro para começar a conversar sobre ele!
                  </AlertDescription>
                </Alert>
              )}
              <ScrollArea className="h-80 rounded-md border bg-gray-50">
                <div className="p-4">
                  {selectedBookId && conversations[selectedBookId]?.messages.map((msg, index) => (
                    <div key={index} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex items-start space-x-2 max-w-[70%] ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        <div className={`p-2 rounded-full ${msg.role === 'user' ? 'bg-purple-600' : 'bg-gray-300'}`}>
                          {msg.role === 'user' ? (
                            <User className="w-5 h-5 text-white" />
                          ) : (
                            <Brain className="w-5 h-5 text-purple-600" />
                          )}
                        </div>
                        <div className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-purple-100 text-purple-800' : 'bg-white text-gray-800'}`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="space-y-2">
                <div className="flex space-x-4">
                  <Textarea
                    ref={messageInputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte-me qualquer coisa sobre o livro selecionado..."
                    className="flex-grow"
                    disabled={isLimitReached || userBooks.length === 0}
                  />
                  <Button 
                    className="bg-purple-600 hover:bg-purple-700 text-white" 
                    onClick={sendMessage}
                    disabled={isSending || isLimitReached || userBooks.length === 0}
                  >
                    {isSending ? (
                      <span className="animate-pulse">Enviando...</span>
                    ) : (
                      <>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Enviar
                      </>
                    )}
                  </Button>
                </div>
                {dailyMessageCount > 0 && (
                  <p className={`text-sm ${dailyMessageCount >= 90 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                    {isLimitReached
                      ? "Você atingiu o limite diário de mensagens. Tente novamente amanhã."
                      : `Mensagens enviadas hoje: ${dailyMessageCount}/100`}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={modalOpen} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-800">{currentBook?.title}</DialogTitle>
            <DialogDescription className="text-gray-600">
              Autor: {currentBook?.author}<br />
              Ano: {currentBook?.year}<br />
              ISBN: {currentBook?.isbn}
            </DialogDescription>
          </DialogHeader>
          {currentBook && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="relative w-full sm:w-32 h-48">
                  <Image 
                    src={currentBook.thumbnail}
                    alt={currentBook.title}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div>
                  <Progress value={currentBook.progress} className="w-full" />
                  <p className="text-sm text-gray-500 mt-2">{currentBook.progress}% concluído</p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-gray-800">Descrição:</h3>
                <ScrollArea className="h-40">
                  <p className="text-gray-600">{currentBook.description}</p>
                </ScrollArea>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-gray-800">Links:</h3>
                <div className="space-y-2">
                  {currentBook.amazon_link && (
                    <Button variant="outline" className="w-full" onClick={() => window.open(currentBook.amazon_link, '_blank')}>
                      Ver na Amazon
                    </Button>
                  )}
                  {currentBook.audible_link && (
                    <Button variant="outline" className="w-full" onClick={() => window.open(currentBook.audible_link, '_blank')}>
                      Ver no Audible
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-gray-800">Suas Anotações:</h3>
                <ScrollArea className="h-40">
                  {currentBook.annotations.length > 0 ? (
                    currentBook.annotations.map((annotation, index) => (
                      <div key={index} className="bg-gray-100 p-2 rounded mb-2">
                        <p>{annotation.content}</p>
                        <p className="text-xs text-gray-500">
                          Criada em: {new Date(annotation.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p>Você ainda não fez nenhuma anotação para este livro.</p>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <BookOpen className="w-4 h-4 mr-2" />
              Continuar Lendo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={annotationModalOpen} onOpenChange={closeAnnotationModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Detalhes da Anotação</DialogTitle>
          </DialogHeader>
          {selectedAnnotation && (
            <div className="space-y-4">
              <p className="text-gray-800">{selectedAnnotation.content}</p>
              <p className="text-sm text-gray-500">
                Criada em: {new Date(selectedAnnotation.created_at).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">
                Livro: {userBooks.find(book => book.id === selectedAnnotation.book_id)?.title || 'Desconhecido'}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={closeAnnotationModal}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default withAuth(Dashboard)