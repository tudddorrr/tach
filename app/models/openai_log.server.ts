import type { ActionArgs} from '@remix-run/node'
import { json } from '@remix-run/node'
import createLocalDatabaseConnection from '~/lib/database/createLocalDatabaseConnection'
import type { Connection, RowDataPacket } from 'mysql2/promise'
import type { BlocklistItem } from './blocklist_item.server'
import createRemoteDatabaseConnection from '~/lib/database/createRemoteDatabaseConnection'
import getQueryFromPrompt from '~/lib/openai/getQueryFromPrompt'
import type { ColumnType, Generated } from 'kysely'

export type OpenAILog = {
  id: Generated<number>,
  tables: string
  prompt: string
  query: string
  success: number
  cache_enabled: number
  tokens_used: number
  created_at: ColumnType<string, string, never>,
  last_used_at: ColumnType<string, string, string>
}

type CreateTableSyntaxRow = RowDataPacket & {
  Table: string
  'Create Table': string
}

type QueryRow = RowDataPacket & {
  [key: string]: any
}

function stripExcessCharacters(createTableSyntax: string): string {
  return createTableSyntax
    .replace(/ ENGINE(.*)/, '')
    .replaceAll('  ', ' ')
    .replaceAll('\n', '')
    .replaceAll('`', '')
    .replaceAll(' NOT NULL', '')
    .replaceAll(' AUTO_INCREMENT', '')
    .replaceAll(' unsigned', '')
}

async function getPromptTables(connection: Connection, tables: string[], blocklist: BlocklistItem[]): Promise<string[]> {
  const tablesToSearch = tables.filter((table) => {
    return blocklist.every((item) => !(item.table_name === table && item.column_name === '*'))
  })

  const createTableSyntaxes = await Promise.all(tablesToSearch.map(async (tableName) => {
    try {
      const [createTableResults] = await connection.execute<CreateTableSyntaxRow[]>(`SHOW CREATE TABLE ${tableName}`)
      return createTableResults[0]['Create Table']
    } catch (err) {
      return null
    }
  }))

  return (createTableSyntaxes.filter((syntax) => Boolean(syntax)) as string[]).map(stripExcessCharacters)
}

function buildBlocklistText(blocklist: BlocklistItem[]) {
  const parts = []
  const tables = new Set(blocklist.filter((item) => item.column_name !== '*').map((item) => item.table_name))
  for (const table of tables) {
    const columns = blocklist.filter((item) => item.table_name === table)
    parts.push(`${columns.map((item) => item.column_name).join(', ')} from the ${table} table`)
  }

  return parts.join(', ')
}

function sanitiseSQL(sql: string) {
  return sql.replaceAll('\n', ' ')
    .replaceAll(/( )\1{1,}/g, ' ') // replace groups of multiple spaces (2+) with a single one
}

export async function getQueryFromPromptAndExecute({ request }: ActionArgs) {
  const body = await request.formData()
  const prompt = body.get('prompt')
  const tables = body.getAll('tables')

  if (!prompt || tables.length === 0) {
    return json({
      error: 'Missing tables or prompt',
      data: {
        json: [],
        csv: ''
      },
      query: ''
    }, 503)
  }

  const cache = new URLSearchParams(request.url).get('cache')
  const checkCache = cache ? cache === '1' : true

  let sql = ''

  const localDB = createLocalDatabaseConnection()
  const remoteDB = await createRemoteDatabaseConnection()

  const existingLog = checkCache
    ? await localDB
      .selectFrom('openai_logs')
      .selectAll()
      .where('tables', '=', tables.join())
      .where('prompt', '=', prompt as string)
      .where('success', '=', 1)
      .orderBy('created_at', 'desc')
      .executeTakeFirst()
    : null

  let tokensUsed = 0

  if (existingLog) {
    sql = existingLog.query
  } else {
    const blocklist = await localDB
      .selectFrom('blocklist_items')
      .selectAll()
      .execute()

    const createTableSyntaxes = await getPromptTables(remoteDB, tables as string[], blocklist)
    const blocklistText = buildBlocklistText(blocklist)
    const res = await getQueryFromPrompt(createTableSyntaxes, prompt as string, blocklistText)
    sql = sanitiseSQL(res.sql ?? '')
    tokensUsed = res.tokensUsed
  
    if (!sql) {
      await localDB.destroy()
      await remoteDB.destroy()

      return json({
        error: 'No response from OpenAI',
        data: {
          json: [],
          csv: ''
        },
        query: ''
      }, 503)
    }
  }

  try {
    const [rows, fields] = await remoteDB.execute<QueryRow[]>(sql)

    if (existingLog) {
      await localDB
        .updateTable('openai_logs')
        .set({ last_used_at: new Date().toISOString() })
        .where('id', '=', existingLog.id)
        .execute()
    } else {
      await localDB
        .insertInto('openai_logs')
        .values({
          tables: tables.join(),
          prompt: prompt as string,
          query: sql,
          cache_enabled: checkCache ? 1 : 0,
          tokens_used: tokensUsed,
          success: 1,
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString()
        })
        .execute()
    }

    const header = fields.map((field) => field.name).join() + '\n'
    const body = rows.map((row) => Object.values(row).join()).join('\n')

    return json({
      error: '',
      data: {
        json: rows,
        csv: header + body
      },
      query: sql
    })
  } catch (err) {
    await localDB
      .insertInto('openai_logs')
      .values({
        tables: tables.join(),
        prompt: prompt as string,
        query: sql,
        cache_enabled: checkCache ? 1 : 0,
        tokens_used: tokensUsed,
        success: 0,
        created_at: new Date().toISOString(),
        last_used_at: new Date().toISOString()
      })
      .execute()

    return json({
      error: 'Invalid query supplied by OpenAI',
      data: {
        json: [],
        csv: ''
      },
      query: sql
    }, 503)
  } finally {
    await localDB.destroy()
    await remoteDB.destroy()
  }
}

export async function getOpenAILogs() {
  const localDB = createLocalDatabaseConnection()
  return await localDB
    .selectFrom('openai_logs')
    .selectAll()
    .where('success', '=', 1)
    .orderBy('last_used_at', 'desc')
    .execute()
}
