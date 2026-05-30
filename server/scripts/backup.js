import { execSync } from 'child_process'
import { mkdirSync, readdirSync, statSync, rmSync } from 'fs'
import { dirname, resolve } from 'path'

const dbPath = process.env.DB_PATH || '/data/jewelval.db'
const backupDir = '/data/backups'
const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10)

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function backup() {
  ensureDir(backupDir)
  ensureDir(dirname(dbPath))
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const target = `${backupDir}/jewelval-${stamp}.db`
  // sqlite3 CLI backup is consistent and fast for SQLite
  execSync(`sqlite3 "${dbPath}" ".backup '${target}'"`, { stdio: 'inherit' })
  console.log(`[backup] created ${target}`)
}

function prune() {
  if (!retentionDays || retentionDays <= 0) return
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  for (const file of readdirSync(backupDir)) {
    const full = resolve(backupDir, file)
    const stat = statSync(full)
    if (stat.isFile() && stat.mtimeMs < cutoff) {
      rmSync(full)
      console.log(`[backup] pruned ${file}`)
    }
  }
}

try {
  backup()
  prune()
  console.log(`[backup] done`)
} catch (err) {
  console.error('[backup] failed:', err.message)
  process.exit(1)
}
