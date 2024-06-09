import type { ActionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import createLocalDatabaseConnection from '~/lib/database/createLocalDatabaseConnection'
import type { Connection, RowDataPacket } from 'mysql2/promise'
import type { BlocklistItem } from './blocklist_item.server'
import createRemoteDatabaseConnection from '~/lib/database/createRemoteDatabaseConnection'
import getQueryFromPrompt from '~/lib/openai/getQueryFromPrompt'
import type { ColumnType, Generated, Kysely } from 'kysely'
import type { Database } from '~/lib/types/Database'

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
  prompt_hidden: ColumnType<number, number | undefined, number>
}

type CreateTableSyntaxRow = RowDataPacket & {
  Table: string
  'Create Table'?: string
  'Create View'?: string
}

type QueryRow = RowDataPacket & {
  [key: string]: any
}

function stripExcessCharacters(createSyntax: string): string {
  return createSyntax
    .replace(/ ENGINE(.*)/, '')
    .replaceAll('  ', ' ')
    .replaceAll('\n', '')
    .replaceAll('`', '')
    .replaceAll(' NOT NULL', '')
    .replaceAll(' AUTO_INCREMENT', '')
    .replaceAll(' unsigned', '')
    .replace(/CREATE ALGORITHM=(.*) DEFINER=`(.*)` SQL SECURITY DEFINER VIEW `(.*)` AS (select|SELECT)/, '')
}

function createViewSyntax(tableName: string, createViewSyntax: string): string {
  const parsedSyntax = createViewSyntax
    .replace(/CREATE ALGORITHM=(.*) DEFINER=`(.*)` SQL SECURITY DEFINER VIEW `(.*)` AS (select|SELECT)/, '');

  return `CREATE VIEW \`${tableName}\` AS SELECT ${parsedSyntax}`
}

async function getPromptTables(connection: Connection, tables: string[], blocklist: BlocklistItem[]): Promise<string[]> {
  const tablesToSearch = tables.filter((table) => {
    return blocklist.every((item) => !(item.table_name === table && item.column_name === '*'))
  })

  const createTableSyntaxes = await Promise.all(tablesToSearch.map(async (tableName) => {
    try {
      const [createTableResults] = await connection.execute<CreateTableSyntaxRow[]>(`SHOW CREATE TABLE ${tableName}`)
      const row = createTableResults[0]

      return row['Create Table'] ?? createViewSyntax(tableName, row['Create View']!)
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

function handleError(error: Error, extra: { [key: string]: any } = {}) {
  return json({
    error: error.message,
    data: {
      json: [],
      csv: ''
    },
    query: '',
    ...extra
  }, 503)
}

async function createLocalAndRemoteDatabaseConnection(): Promise<{
  localDB: Kysely<Database>,
  remoteDB: Connection,
  cleanupDBs: () => void
}> {
  const localDB = createLocalDatabaseConnection()
  const remoteDB = await createRemoteDatabaseConnection()

  return {
    localDB: createLocalDatabaseConnection(),
    remoteDB: await createRemoteDatabaseConnection(),
    cleanupDBs: async () => {
      await localDB.destroy()
      await remoteDB.destroy()
    }
  }
}

export async function getQueryFromPromptAndExecute({ request }: ActionArgs) {
  const body = await request.formData()
  const prompt = body.get('prompt')
  const tables = body.getAll('tables')
  const checkCache = body.get('cache') === '1'

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

  let sql = ''

  const { localDB, remoteDB, cleanupDBs } = await createLocalAndRemoteDatabaseConnection()

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

  let useExistingLog = Boolean(existingLog)
  if (existingLog?.prompt_hidden === 1) {
    useExistingLog = false
  }

  let tokensUsed = 0

  if (useExistingLog) {
    sql = existingLog!.query
  } else {
    const blocklist = await localDB
      .selectFrom('blocklist_items')
      .selectAll()
      .where('table_name', 'in', tables as string[])
      .execute()

    const createTableSyntaxes = await getPromptTables(remoteDB, tables as string[], blocklist)
    const blocklistText = buildBlocklistText(blocklist)

    try {
      const res = await getQueryFromPrompt(createTableSyntaxes, prompt as string, blocklistText)
      sql = sanitiseSQL(res.sql ?? '')
      tokensUsed = res.tokensUsed
  
      if (!sql) {
        await cleanupDBs()
        return handleError(new Error('No response from OpenAI'))
      }
    } catch (err) {
      await cleanupDBs()
      return handleError(err as Error)
    }
  }

  try {
    const [rows, fields] = await remoteDB.execute<QueryRow[]>(sql)

    if (existingLog) {
      await localDB
        .updateTable('openai_logs')
        .set({ last_used_at: new Date().toISOString(), prompt_hidden: 0 })
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

    return handleError(new Error('Invalid query supplied by OpenAI'), { query: sql })
  } finally {
    await cleanupDBs()
  }
}

export async function getOpenAILogs() {
  const localDB = createLocalDatabaseConnection()

  const res = await localDB
    .selectFrom('openai_logs')
    .selectAll()
    .where('success', '=', 1)
    .where('prompt_hidden', '=', 0)
    .orderBy('last_used_at', 'desc')
    .execute()

  await localDB.destroy()

  return res
}

export async function hideLog({ request }: ActionArgs) {
  const body = await request.formData()
  const id = body.get('id') as string

  const localDB = createLocalDatabaseConnection()

  await localDB
    .updateTable('openai_logs')
    .set({ prompt_hidden: 1 })
    .where('id', '=', +id)
    .execute()

  await localDB.destroy();
}
