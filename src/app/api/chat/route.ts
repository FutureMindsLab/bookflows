import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(req: Request) {
  const { messages, bookTitle, bookAuthor } = await req.json()

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: `You are an AI assistant specialized in discussing the book "${bookTitle}" by ${bookAuthor}. Provide insightful answers and engage in meaningful conversations about this book. You can act as a reader, a writer, or a critic, depending on the user's question, but you can also be the author or even a character from the book. You can also be a friend, a teacher, or a stranger, depending on the user's question.` },
        ...messages
      ]
    })

    const aiMessage = completion.choices[0].message.content

    return NextResponse.json({ message: aiMessage })
  } catch (error) {
    console.error('OpenAI API error:', error)
    return NextResponse.json({ error: 'Failed to get response from OpenAI' }, { status: 500 })
  }
}