import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import createLocalDatabaseConnection from '~/lib/database/createLocalDatabaseConnection'

export type LexiconColumn = {
  table_name: string
  column_name: string
  description: string | null
}

export async function getColumns({ params }: LoaderArgs) {
  const { tableName } = params

  const localDB = await createLocalDatabaseConnection()

  const res = await localDB
    .selectFrom('lexicon_columns')
    .selectAll()
    .where('table_name', '=', tableName!)
    .where(({ not, exists, selectFrom }) => not(exists(
      selectFrom('blocklist_items')
        .select('blocklist_items.column_name')
        .whereRef('blocklist_items.column_name', '=', 'lexicon_columns.column_name')
        .where('blocklist_items.table_name', '=', tableName!)
    )))
    .execute()

  await localDB.destroy()

  return res
}

export async function updateColumnDescription({ request, params }: ActionArgs) {
  const tableName = params.tableName!

  const body = await request.formData()
  const description = body.get('description') as string
  const columnName = body.get('columnName') as string

  const localDB = createLocalDatabaseConnection()
  await localDB
    .updateTable('lexicon_columns')
    .set({ description })
    .where('table_name', '=', tableName)
    .where('column_name', '=', columnName)
    .execute()

  await localDB.destroy()
}
