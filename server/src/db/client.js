import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, isAbsolute } from 'node:path'
import { mkdirSync } from 'node:fs'
import * as schema from './schema.js'

const here = dirname(fileURLToPath(import.meta.url))

const dbPath = process.env.DB_PATH
  ? (isAbsolute(process.env.DB_PATH)
      ? process.env.DB_PATH
      : resolve(process.cwd(), process.env.DB_PATH))
  : resolve(here, '../../data/jewel_val.db')

mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('busy_timeout = 5000')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

export function verifyDatabaseConnection() {
  sqlite.prepare('SELECT 1 AS ok').get()
  return true
}

export function closeDatabaseConnection() {
  sqlite.close()
}

export { sqlite, dbPath }
