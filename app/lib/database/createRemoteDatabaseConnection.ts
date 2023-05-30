import mysql from 'mysql2/promise'

export default function createRemoteDatabaseConnection(): Promise<mysql.Connection> {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  })
}
