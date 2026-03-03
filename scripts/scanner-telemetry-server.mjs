import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_PORT = Number(process.env.SCANNER_TELEMETRY_PORT || 8789)
const DEFAULT_OUT_DIR = process.env.SCANNER_TELEMETRY_DIR || path.resolve('data/scans')
const DEFAULT_MAX_BODY_BYTES = Number(process.env.SCANNER_TELEMETRY_MAX_BODY_BYTES || 1024 * 1024) // 1MB
const DEFAULT_ALLOW_ORIGIN = process.env.SCANNER_TELEMETRY_ALLOW_ORIGIN || '*'

const RESERVED_KEYS = new Set(['ts', 'kind'])

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const createAppender = ({ outDir }) => {
  fs.mkdirSync(outDir, { recursive: true })

  const queue = []
  let flushing = false

  const flush = async () => {
    if (flushing || queue.length === 0) return
    flushing = true

    while (queue.length > 0) {
      const item = queue.shift()
      await fs.promises.appendFile(item.target, item.line, 'utf8')
    }

    flushing = false
  }

  const append = async (kind, line) => {
    const target = path.join(outDir, kind === 'feedback' ? 'scanner-feedback.jsonl' : 'scanner-events.jsonl')
    queue.push({ target, line })
    await flush()
  }

  return { append, getQueueSize: () => queue.length }
}

const readJsonBody = (req, { maxBodyBytes }) => new Promise((resolve, reject) => {
  let size = 0
  const chunks = []

  req.on('data', (chunk) => {
    size += chunk.length
    if (size > maxBodyBytes) {
      reject(new Error('payload_too_large'))
      req.destroy()
      return
    }
    chunks.push(chunk)
  })

  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks).toString('utf8').trim()
      if (!raw) {
        reject(new Error('invalid_json'))
        return
      }
      resolve(JSON.parse(raw))
    } catch {
      reject(new Error('invalid_json'))
    }
  })

  req.on('error', () => reject(new Error('read_error')))
})

const sanitizePayload = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const clean = {}
  for (const [key, val] of Object.entries(value)) {
    if (!RESERVED_KEYS.has(key)) clean[key] = val
  }
  return clean
}

export const createTelemetryServer = ({
  port = DEFAULT_PORT,
  outDir = DEFAULT_OUT_DIR,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
  allowOrigin = DEFAULT_ALLOW_ORIGIN,
} = {}) => {
  const appender = createAppender({ outDir })
  const stats = {
    writesOk: 0,
    writesFailed: 0,
    lastWriteAt: null,
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin)
    res.setHeader('Access-Control-Allow-Headers', 'content-type')
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,GET')

    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      return res.end()
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, {
        ok: true,
        status: 'up',
        queueDepth: appender.getQueueSize(),
        writesOk: stats.writesOk,
        writesFailed: stats.writesFailed,
        lastWriteAt: stats.lastWriteAt,
      })
    }

    if (req.method !== 'POST' || url.pathname !== '/scanner-ingest') {
      return sendJson(res, 404, { ok: false, error: 'not_found' })
    }

    let parsed
    try {
      parsed = await readJsonBody(req, { maxBodyBytes })
    } catch (err) {
      if (err.message === 'payload_too_large') return sendJson(res, 413, { ok: false, error: 'payload_too_large' })
      return sendJson(res, 400, { ok: false, error: 'invalid_json' })
    }

    const kind = parsed?.kind === 'feedback' ? 'feedback' : 'event'
    const payload = sanitizePayload(parsed?.payload)
    const ts = new Date().toISOString()

    const line = JSON.stringify({ ts, kind, ...payload }).replace(/[\r\n]+/g, ' ') + '\n'

    try {
      await appender.append(kind, line)
      stats.writesOk += 1
      stats.lastWriteAt = ts
    } catch {
      stats.writesFailed += 1
      return sendJson(res, 500, { ok: false, error: 'write_failed' })
    }

    return sendJson(res, 200, { ok: true, kind })
  })

  return {
    port,
    outDir,
    server,
    listen: (cb) => server.listen(port, cb),
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isMain) {
  const telemetry = createTelemetryServer()
  telemetry.listen(() => {
    console.log(`scanner telemetry server listening on http://localhost:${telemetry.port}/scanner-ingest`)
    console.log(`health endpoint available at http://localhost:${telemetry.port}/health`)
    console.log(`writing jsonl to ${telemetry.outDir}`)
  })
}