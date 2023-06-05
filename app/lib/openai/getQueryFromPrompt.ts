import { Configuration, OpenAIApi } from 'openai'

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }))

type QueryResponse = {
  sql?: string
  tokensUsed: number
}

type OpenAIApiError = Error & {
  response?: {
    status: number
    data: {
      error: {
        message: string
        type: string
        param?: string
        code?: string
      }
    }
  }
}

export default async function getQueryFromPrompt(createTableSyntaxes: string[], prompt: string, blocklistText: string): Promise<QueryResponse> {
  const systemContent = `
    You are a tool for translation natural language questions about company data into SQL queries that only select data and never modify it.
    Only return the query and nothing else.
    ${blocklistText ? 'The generated query must never contain references to any of the following columns: ' + blocklistText : ''}
  `

  const userContent = `
    Using these MySQL tables: ${createTableSyntaxes.join(',\n')}
    ${prompt}
  `

  try {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent }
      ]
    })

    return {
      sql: completion.data.choices[0].message?.content,
      tokensUsed: completion.data.usage?.total_tokens ?? 0
    }
  } catch (_err) {
    const error = _err as OpenAIApiError
    if (error.response) {
      console.error({
        status: error.response.status,
        error: error.response.data.error
      })
    } else {
      console.error(error.message)
    }
    throw error
  }
}
