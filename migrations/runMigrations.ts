import Database from 'better-sqlite3'
import fs from 'fs/promises'

export default async function runMigrations() {
  const db = new Database(process.env.SQLITE_FILE!)
  db.exec(`create table if not exists migrations (name varchar(255) primary key)`)

  const basePath = './migrations'
  const files = await fs.readdir(basePath)

  const migrations = files.filter((file) => /(\d\d)_(.*).sql/.test(file)).sort((a, b) => a.localeCompare(b))
  await Promise.all(migrations.map(async (migration) => {
    if (!db.prepare('select 1 from migrations where name = ?').get(migration)) {
      console.info(`Running migration ${migration}`)
      db.exec(await fs.readFile(`${basePath}/${migration}`, 'utf8'))
      db.exec(`insert into migrations (name) values ('${migration}')`)
    }
  }))

  db.close()
}
