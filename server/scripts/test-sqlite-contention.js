import { isMainThread, parentPort, workerData, Worker } from 'node:worker_threads'
import { cpus } from 'node:os'
import { resolve, dirname } from 'node:path'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DB_PATH || resolve(scriptDir, '..', 'data', 'jewel_val.db')
const LEVELS = [10, 25, 50, 100]
const WRITES_PER_WORKER = Number(process.env.WRITE_TEST_WRITES_PER_WORKER || 200)

if (!isMainThread) {
  const db = new Database(workerData.dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')

  const insert = db.prepare('INSERT INTO contention_writes (worker_id, seq, created_at, payload) VALUES (?, ?, ?, ?)')
  const tx = db.transaction((workerId, seq, payload) => {
    insert.run(workerId, seq, new Date().toISOString(), payload)
  })

  const out = {
    workerId: workerData.workerId,
    attempted: workerData.writes,
    succeeded: 0,
    failed: 0,
    firstError: null,
    busyErrors: 0,
    lockErrors: 0,
  }

  try {
    for (let i = 0; i < workerData.writes; i += 1) {
      try {
        tx(workerData.workerId, i + 1, `payload-${workerData.workerId}-${i + 1}`)
        out.succeeded += 1
      } catch (error) {
        out.failed += 1
        const msg = String(error?.message || error)
        if (/SQLITE_BUSY/i.test(msg)) out.busyErrors += 1
        if (/database is locked/i.test(msg)) out.lockErrors += 1
        if (!out.firstError) out.firstError = msg
      }
    }
  } finally {
    db.close()
  }

  parentPort.postMessage(out)
} else {
  function inspectSqliteConfig(dbPath) {
    mkdirSync(dirname(dbPath), { recursive: true })
    const db = new Database(dbPath)
    const journalMode = db.prepare('PRAGMA journal_mode').get().journal_mode
    const busyTimeout = db.prepare('PRAGMA busy_timeout').get().timeout
    db.exec(`
      CREATE TABLE IF NOT EXISTS contention_writes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER NOT NULL,
        seq INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_contention_worker ON contention_writes(worker_id, seq);
    `)
    db.close()
    return { journalMode, busyTimeout }
  }

  async function runLevel(level) {
    const workers = []
    const started = Date.now()

    for (let i = 0; i < level; i += 1) {
      workers.push(new Promise((resolveWorker) => {
        const worker = new Worker(new URL(import.meta.url), {
          workerData: {
            dbPath: DB_PATH,
            writes: WRITES_PER_WORKER,
            workerId: i + 1,
          },
        })
        worker.on('message', resolveWorker)
        worker.on('error', (error) => {
          resolveWorker({
            workerId: i + 1,
            attempted: WRITES_PER_WORKER,
            succeeded: 0,
            failed: WRITES_PER_WORKER,
            firstError: String(error?.message || error),
            busyErrors: 0,
            lockErrors: 0,
          })
        })
      }))
    }

    const results = await Promise.all(workers)
    const elapsedMs = Date.now() - started
    const totals = results.reduce((acc, w) => {
      acc.attempted += w.attempted
      acc.succeeded += w.succeeded
      acc.failed += w.failed
      acc.busyErrors += w.busyErrors
      acc.lockErrors += w.lockErrors
      if (!acc.firstError && w.firstError) acc.firstError = w.firstError
      return acc
    }, { attempted: 0, succeeded: 0, failed: 0, busyErrors: 0, lockErrors: 0, firstError: null })

    return {
      concurrency: level,
      cpuCount: cpus().length,
      writesPerWorker: WRITES_PER_WORKER,
      elapsedMs,
      throughputWritesPerSec: Number((totals.succeeded / Math.max(elapsedMs / 1000, 0.001)).toFixed(2)),
      ...totals,
      contendedQuery: 'INSERT INTO contention_writes (worker_id, seq, created_at, payload) VALUES (?, ?, ?, ?)',
      transactionShape: 'sqlite.transaction -> single-row insert',
    }
  }

  async function main() {
    const config = inspectSqliteConfig(DB_PATH)
    console.log('SQLITE_CONFIG', JSON.stringify({ dbPath: DB_PATH, ...config }, null, 2))

    const report = []
    for (const level of LEVELS) {
      console.log(`\nRunning write contention level=${level} ...`)
      const levelReport = await runLevel(level)
      report.push(levelReport)
      console.log(JSON.stringify(levelReport, null, 2))
    }

    const firstFailure = report.find((r) => r.failed > 0)
    const stable = [...report].reverse().find((r) => r.failed === 0)

    console.log('\nSUMMARY')
    console.log(JSON.stringify({
      maxStableLevel: stable?.concurrency || null,
      maxStableThroughputWritesPerSec: stable?.throughputWritesPerSec || 0,
      firstFailurePoint: firstFailure?.concurrency || null,
      firstFailureError: firstFailure?.firstError || null,
      report,
    }, null, 2))
  }

  main().catch((error) => {
    console.error('SQLITE contention test failed', error)
    process.exit(1)
  })
}
