import { NextResponse } from 'next/server'
import { Configuration, OpenAIApi } from 'openai'

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
})
const openai = new OpenAIApi(configuration)

export async function POST(req: Request) {
  if (!configuration.apiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  const { messages, bookId } = await req.json()

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `You are a helpful assistant that discusses books. The current book being discussed has the ID: ${bookId}.` },
        ...messages
      ],
    })

    return NextResponse.json({ response: completion.data.choices[0].message?.content })
  } catch (error: any) {
    if (error.response) {
      console.error(error.response.status, error.response.data)
      return NextResponse.json({ error: error.response.data }, { status: error.response.status })
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`)
      return NextResponse.json({ error: 'An error occurred during your request.' }, { status: 500 })
    }
  }
}