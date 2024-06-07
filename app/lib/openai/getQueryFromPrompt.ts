import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type QueryResponse = {
  sql: string | null
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
    These MySQL create table or create view syntaxes are available to use: ${createTableSyntaxes.join(',\n')}
    Only return the query and nothing else.
    ${blocklistText ? 'The generated query must never contain references to any of the following columns: ' + blocklistText : ''}
  `

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: prompt }
      ]
    })

    return {
      sql: completion.choices[0].message?.content,
      tokensUsed: completion.usage?.total_tokens ?? 0
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
