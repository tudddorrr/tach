import type { Database } from '~/lib/types/Database'
import { Kysely, SqliteDialect } from 'kysely'
import SQLiteDatabase from 'better-sqlite3'

export default function createLocalDatabaseConnection() {
  return new Kysely<Database>({
    dialect: new SqliteDialect({
      database: new SQLiteDatabase(process.env.SQLITE_FILE!)
    })
  })
}
