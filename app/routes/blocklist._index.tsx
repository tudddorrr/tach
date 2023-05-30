import type { ActionArgs, LoaderArgs} from '@remix-run/node'
import { json } from '@remix-run/node'
import createLocalDatabaseConnection from '~/lib/database/createLocalDatabaseConnection'

export async function loader(args: LoaderArgs) {
  const localDB = createLocalDatabaseConnection()
  const blocklist = await localDB.selectFrom('blocklist_items').selectAll().execute()
  await localDB.destroy()

  return json({ blocklist })
}

type ActionItem = {
  tableName: string
  columnName: string
}

export async function action({ request }: ActionArgs) {
  if (request.method === 'POST') {
    const localDB = createLocalDatabaseConnection()
    const body = await request.json()
    const items = body.items as ActionItem[]

    for (const item of items) {
      const { columnName, tableName } = item

      if (columnName === '*') {
        await localDB
          .deleteFrom('blocklist_items')
          .where('table_name', '=', tableName)
          .where('column_name', '=', columnName)
          .execute()
      }
  
      await localDB
        .insertInto('blocklist_items')
        .values({
          table_name: tableName,
          column_name: columnName
        })
        .onConflict((oc) => oc.doNothing())
        .execute()
    }

    await localDB.destroy()
    return json({})
  } else {
    return json({}, 405)
  }
}
