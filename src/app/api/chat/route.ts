import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  const { messages, bookId }: { messages: OpenAI.Chat.ChatCompletionMessage[], bookId: string } = await req.json()

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `You are a helpful assistant that discusses books. The current book being discussed has the ID: ${bookId}.` },
        ...messages
      ],
    })

    return NextResponse.json({ response: completion.choices[0].message.content })
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      console.error(error.status, error.message)
      return NextResponse.json({ error: error.message }, { status: error.status })
    } else {
      console.error(`Error with OpenAI API request: ${error}`)
      return NextResponse.json({ error: 'An error occurred during your request.' }, { status: 500 })
    }
  }
}