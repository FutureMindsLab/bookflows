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

const supabase = createClientComponentClient()

interface Book {
  id: string
  title: string
  author: string
  isbn: string | null
  year: number | null
  description: string | null
  thumbnail: string | null
  amazon_link: string | null
  audible_link: string | null
  progress: number
  
}

interface Annotation {
  id: number;
  content: string;
  created_at: string;
  book_id: number;
  book: { title: string }[];
}


interface Message {
  role: 'user' | 'assistant'
  content: string
}

function Dashboard() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null)
  const [recentAnnotations, setRecentAnnotations] = useState<Annotation[]>([])
  const [userBooks, setUserBooks] = useState<Book[]>([])
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Record<string, Message[]>>({})
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [dailyMessageCount, setDailyMessageCount] = useState(0)
  const [isLimitReached, setIsLimitReached] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [annotationModalOpen, setAnnotationModalOpen] = useState(false)
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)

  const fetchUserData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (userError) throw userError

        if (userData) {
          await Promise.all([
            fetchUserBooks(userData.id),
            fetchRecentAnnotations(userData.id),
            fetchDailyMessageCount(userData.id),
          ])
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUserData()
  }, [fetchUserData])

  const fetchUserBooks = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_books')
      .select(`
        id,
        progress,
        book:books (
          id,
          title,
          author,
          isbn,
          year,
          description,
          thumbnail,
          amazon_link,
          audible_link
        )
      `)
      .eq('user_id', userId)
      .eq('status', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user books:', error)
    } else {
      const formattedBooks: Book[] = data.map((item: any) => ({
        ...item.book,
        progress: item.progress
      }))
      setUserBooks(formattedBooks)
      if (formattedBooks.length > 0) {
        setCurrentBook(formattedBooks[0])
      }
    }
  }

  const fetchRecentAnnotations = async (userId: string) => {
    const { data, error } = await supabase
      .from('annotations')
      .select(`
        id,
        content,
        created_at,
        book_id,
        book:books (title)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('Error fetching recent annotations:', error)
    } else {
      setRecentAnnotations(data)
    }
  }

  const fetchDailyMessageCount = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('daily_message_count')
      .select('count')
      .eq('user_id', userId)
      .eq('date', today)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        setDailyMessageCount(0)
        setIsLimitReached(false)
      } else {
        console.error('Error fetching daily message count:', error)
      }
    } else {
      setDailyMessageCount(data?.count || 0)
      setIsLimitReached(data?.count >= 100)
    }
  }

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
    setAnnotationModalOpen(false)
    setSelectedAnnotation(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sendMessage = async () => {
    if (!selectedBookId || !message.trim() || isSending || isLimitReached) return

    setIsSending(true)
    const selectedBook = userBooks.find(book => book.id === selectedBookId)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: message }],
          bookTitle: selectedBook?.title,
          bookAuthor: selectedBook?.author
        })
      })

      if (!response.ok) throw new Error('Failed to send message')

      const { message: aiMessage } = await response.json()

      setConversations(prev => ({
        ...prev,
        [selectedBookId]: [
          ...(prev[selectedBookId] || []),
          { role: 'user', content: message },
          { role: 'assistant', content: aiMessage }
        ]
      }))

      setMessage('')
      await updateDailyMessageCount()
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsSending(false)
    }
  }

  const updateDailyMessageCount = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (userError) {
        console.error('Error fetching user data:', userError)
        return
      }

      if (userData) {
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
          .from('daily_message_count')
          .upsert(
            { user_id: userData.id, date: today, count: dailyMessageCount + 1 },
            { onConflict: 'user_id,date' }
          )

        if (error) {
          console.error('Error updating daily message count:', error)
        } else {
          setDailyMessageCount(prev => {
            const newCount = prev + 1
            setIsLimitReached(newCount >= 100)
            return newCount
          })
        }
      }
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
                      src={currentBook.thumbnail || '/placeholder.svg?height=200&width=150'}
                      alt={currentBook.title}
                      width={80}
                      height={120}
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{currentBook.title}</h3>
                    <p className="text-sm text-gray-500">por {currentBook.author}</p>
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
              {!selectedBookId && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Nenhum livro selecionado</AlertTitle>
                  <AlertDescription>
                    Por favor, selecione um livro para iniciar a conversa.
                  </AlertDescription>
                </Alert>
              )}
              <ScrollArea className="h-80 rounded-md border bg-gray-50">
                <div className="p-4">
                  {selectedBookId && conversations[selectedBookId]?.map((msg, index) => (
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
                    placeholder={selectedBookId ? "Pergunte-me qualquer coisa sobre o livro selecionado..." : "Selecione um livro para iniciar a conversa"}
                    className="flex-grow"
                    disabled={!selectedBookId || isLimitReached}
                  />
                  <Button 
                    className="bg-purple-600 hover:bg-purple-700 text-white" 
                    onClick={sendMessage}
                    disabled={isSending || !selectedBookId || isLimitReached}
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
                    src={currentBook.thumbnail || '/placeholder.svg?height=200&width=150'}
                    alt={currentBook.title}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
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
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => {
                        if (currentBook.amazon_link) {
                          window.open(currentBook.amazon_link, '_blank')
                        }
                      }}
                    >
                      Ver na Amazon
                    </Button>
                  )}
                  {currentBook.audible_link && (
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => {
                        if (currentBook.audible_link) {
                          window.open(currentBook.audible_link, '_blank')
                        }
                      }}
                    >
                      Ver no Audible
                    </Button>
                  )}
                </div>
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
        <DialogContent className="sm:max-w-[500px] w-full">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Detalhes da Anotação</DialogTitle>
          </DialogHeader>
          {selectedAnnotation && (
            <div className="space-y-4">
              <ScrollArea className="h-[200px] w-full rounded-md border">
                <div className="p-4">
                  <p className="text-gray-800 break-words whitespace-pre-wrap">{selectedAnnotation.content}</p>
                </div>
              </ScrollArea>
              <div className="text-sm text-gray-500 space-y-1">
                <p>
                  Criada em: {new Date(selectedAnnotation.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-end">
            <Button onClick={closeAnnotationModal} className="w-full sm:w-auto">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default withAuth(Dashboard)