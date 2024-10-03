'use client'

import { withAuth } from '@/Components/withAuth'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Navigation from '@/Components/Navigation'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { MessageCircle, Brain, BookOpen, User, Copy, RotateCcw, Settings, LogOut, PenSquare, Send, ChevronDown, Info, MessageSquare } from 'lucide-react'
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
  id: number
  content: string
  created_at: string
  book_id: number
  book: { title: string }[]
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  bookId: string
  createdAt: Date
}

function Dashboard() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null)
  const [recentAnnotations, setRecentAnnotations] = useState<Annotation[]>([])
  const [userBooks, setUserBooks] = useState<Book[]>([])
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
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
        setSelectedBookId(formattedBooks[0].id)
        startNewConversation(formattedBooks[0].id)
      } else {
        setCurrentBook(null)
        setSelectedBookId(null)
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

  const startNewConversation = (bookId: string) => {
    const book = userBooks.find(book => book.id === bookId)
    if (!book) return

    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: `Conversa sobre ${book.title}`,
      messages: [],
      bookId: bookId,
      createdAt: new Date()
    }
    setConversations(prev => [newConversation, ...prev])
    setCurrentConversation(newConversation)
    setMessage('')
  }

  const selectConversation = (conversation: Conversation) => {
    setCurrentConversation(conversation)
    setSelectedBookId(conversation.bookId)
    setMessage('')
  }

  const sendMessage = async () => {
    if (!message.trim() || isSending || isLimitReached || !currentConversation || !selectedBookId) return

    setIsSending(true)

    try {
      const newUserMessage: Message = { role: 'user', content: message }
      const updatedConversation = {
        ...currentConversation,
        messages: [...currentConversation.messages, newUserMessage]
      }

      setCurrentConversation(updatedConversation)
      setConversations(prev => prev.map(conv => conv.id === updatedConversation.id ? updatedConversation : conv))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedConversation.messages,
          bookTitle: userBooks.find(book => book.id === selectedBookId)?.title
        })
      })

      if (!response.ok) throw new Error('Failed to send message')

      const { message: aiMessage } = await response.json()

      const newAiMessage: Message = { role: 'assistant', content: aiMessage }
      const finalConversation = {
        ...updatedConversation,
        messages: [...updatedConversation.messages, newAiMessage]
      }

      setCurrentConversation(finalConversation)
      setConversations(prev => prev.map(conv => conv.id === finalConversation.id ? finalConversation : conv))

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

  const formatAIResponse = (content: string) => {
    const paragraphs = content.split('\n\n')
    return paragraphs.map((paragraph, index) => {
      const formattedParagraph = paragraph.replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      return <p key={index} dangerouslySetInnerHTML={{ __html: formattedParagraph }} className="mb-4" />
    })
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
    <div className="min-h-screen bg-white">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Sua Jornada de Leitura</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow duration-200" onClick={() => currentBook && openModal(currentBook)}>
            <CardHeader>
              <CardTitle className="flex items-center">
                Leitura Atual
                <Info className="w-4 h-4 ml-2 text-gray-400" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentBook ? (
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
              ) : (
                <p>Você ainda não começou a ler nenhum livro. Que tal começar agora?</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                Anotações Recentes
                <Info className="w-4 h-4 ml-2 text-gray-400" />
              </CardTitle>
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
                      <MessageCircle className="w-4 h-4 text-[#16d2a4] flex-shrink-0" />
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
              <CardTitle className="flex items-center">
                Resumo Diário
                <Info className="w-4 h-4 ml-2 text-gray-400" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">&ldquo;A verdadeira liderança é servir. Liderar é servir. Servir é liderar.&rdquo; - O Monge e o Executivo</p>
              <Button className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white">Obter Mais Insights</Button>
            </CardContent>
          </Card>
        </div>

        {/* Chat Section */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-[#16d2a4] p-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Bookflows AI</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white text-[#16d2a4] hover:bg-gray-100" 
              onClick={() => selectedBookId && startNewConversation(selectedBookId)}
              disabled={!selectedBookId}
            >
              <PenSquare className="w-4 h-4 mr-2" />
              Nova conversa
            </Button>
          </div>
          <div className="flex h-[calc(100vh-400px)]">
            {/* Chat History Sidebar */}
            <div className="w-64 bg-gray-100 border-r border-gray-200 p-4 overflow-y-auto">
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-4">Histórico</h3>
              {conversations.map((conversation) => (
                <div 
                  key={conversation.id} 
                  className={`mb-2 p-2 rounded-lg cursor-pointer transition-colors duration-200 ${
                    currentConversation?.id === conversation.id 
                      ? 'bg-[#16d2a4] text-white' 
                      : 'hover:bg-gray-200'
                  }`}
                  onClick={() => selectConversation(conversation)}
                >
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm font-medium truncate">{conversation.title}</span>
                  </div>
                  <div className="text-xs mt-1 text-gray-500">
                    {conversation.createdAt.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col">
              <div className="bg-white p-2 border-b border-gray-200">
                <Select 
                  value={selectedBookId || ''} 
                  onValueChange={(value) => {
                    setSelectedBookId(value)
                    startNewConversation(value)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o livro que você quer conversar" />
                  </SelectTrigger>
                  <SelectContent>
                    {userBooks.map((book) => (
                      <SelectItem key={book.id} value={book.id}>{book.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {currentConversation?.messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'bg-white' : 'bg-gray-50'}`}>
                      <div className="max-w-3xl mx-auto w-full flex space-x-4 px-4 py-6">
                        <div className={`p-2 rounded-sm ${msg.role === 'user' ? 'bg-purple-600' : 'bg-[#16d2a4]'}`}>
                          {msg.role === 'user' ? (
                            <User className="w-6 h-6 text-white" />
                          ) : (
                            <Brain className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div className="flex-grow">
                          {msg.role === 'assistant' ? formatAIResponse(msg.content) : <p>{msg.content}</p>}
                        </div>
                        {msg.role === 'assistant' && (
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600">
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-600">
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="border-t border-gray-200 p-4">
                <div className="relative">
                  <Textarea
                    ref={messageInputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Envie uma mensagem..."
                    className="w-full pr-12 resize-none"
                    rows={1}
                    disabled={isLimitReached || !selectedBookId}
                  />
                  <Button 
                    className="absolute right-2 bottom-2 bg-[#16d2a4] hover:bg-[#14b08a] text-white" 
                    size="sm"
                    onClick={sendMessage}
                    disabled={isSending || isLimitReached || !selectedBookId}
                  >
                    {isSending ? (
                      <span className="animate-pulse">Enviando...</span>
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {!selectedBookId && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Atenção</AlertTitle>
                    <AlertDescription>
                      Selecione um livro para começar a conversar.
                    </AlertDescription>
                  </Alert>
                )}
                {dailyMessageCount > 0 && (
                  <p className={`text-xs mt-2 ${dailyMessageCount >= 90 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                    {isLimitReached
                      ? "Você atingiu o limite diário de mensagens. Tente novamente amanhã."
                      : `Mensagens enviadas hoje: ${dailyMessageCount}/100`}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
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
            <Button className="bg-[#16d2a4] hover:bg-[#14b08a] text-white">
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
            <Button onClick={closeAnnotationModal} className="bg-[#16d2a4] hover:bg-[#14b08a] text-white">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default withAuth(Dashboard)