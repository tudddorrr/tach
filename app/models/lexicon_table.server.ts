import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import type { RowDataPacket } from 'mysql2'
import createLocalDatabaseConnection from '~/lib/database/createLocalDatabaseConnection'
import createRemoteDatabaseConnection from '~/lib/database/createRemoteDatabaseConnection'

export type LexiconTable = {
  table_name: string
  description: string | null
}

type ShowTableRow = RowDataPacket & {
  [key: string]: string
}

type ShowColumnRow = RowDataPacket & {
  Field: string
}

export async function scan() {
  const remoteDB = await createRemoteDatabaseConnection()
  const [rows] = await remoteDB.execute<ShowTableRow[]>('show tables')
  const tables = rows.map((row): string => row[Object.keys(row)[0]])

  const localDB = createLocalDatabaseConnection()

  for (const tableName of tables) {
    await localDB
      .insertInto('lexicon_tables')
      .values({
        table_name: tableName
      })
      .onConflict((oc) => oc.doNothing())
      .execute()

    const [rows] = await remoteDB.execute<ShowColumnRow[]>(`show columns from ${tableName}`)

    const columns = rows.map((row) => row.Field)
    for (const columnName of columns) {
      await localDB
        .insertInto('lexicon_columns')
        .values({
          table_name: tableName,
          column_name: columnName
        })
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }

  const res = await localDB.selectFrom('lexicon_tables').selectAll().execute()

  await remoteDB.destroy()
  await localDB.destroy()

  return res;
}

export async function getTables({ request }: LoaderArgs) {
  const localDB = createLocalDatabaseConnection()

  const res = await localDB
    .selectFrom('lexicon_tables')
    .selectAll()

    .where(({ not, exists, selectFrom }) => not(exists(
      selectFrom('blocklist_items')
        .select('blocklist_items.table_name')
        .whereRef('blocklist_items.table_name', '=', 'lexicon_tables.table_name')
        .where('blocklist_items.column_name', '=', '*')
    )))
    .execute()

  await localDB.destroy()

  return res
}

export async function updateTableDescription({ request }: ActionArgs) {
  const body = await request.formData()
  const tableName = body.get('tableName') as string
  const description = body.get('description') as string

  const localDB = createLocalDatabaseConnection()
  await localDB
    .updateTable('lexicon_tables')
    .set({ description })
    .where('table_name', '=', tableName)
    .execute()

  await localDB.destroy()
}
