import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.SCANNER_TELEMETRY_PORT || 8789)
const OUT_DIR = process.env.SCANNER_TELEMETRY_DIR || path.resolve('data/scans')
const MAX_BODY_BYTES = Number(process.env.SCANNER_TELEMETRY_MAX_BODY_BYTES || 1024 * 1024) // 1MB

fs.mkdirSync(OUT_DIR, { recursive: true })

const allowOrigin = process.env.SCANNER_TELEMETRY_ALLOW_ORIGIN || '*'

const sendJson = (res, statusCode, payload) => {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const readJsonBody = (req) => new Promise((resolve, reject) => {
  let size = 0
  const chunks = []

  req.on('data', (chunk) => {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      reject(new Error('payload_too_large'))
      req.destroy()
      return
    }
    chunks.push(chunk)
  })

  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks).toString('utf8')
      resolve(JSON.parse(raw))
    } catch {
      reject(new Error('invalid_json'))
    }
  })

  req.on('error', () => reject(new Error('read_error')))
})

const sanitizePayload = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
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
    return sendJson(res, 200, { ok: true, status: 'up' })
  }

  if (req.method !== 'POST' || url.pathname !== '/scanner-ingest') {
    return sendJson(res, 404, { ok: false, error: 'not_found' })
  }

  let parsed
  try {
    parsed = await readJsonBody(req)
  } catch (err) {
    if (err.message === 'payload_too_large') return sendJson(res, 413, { ok: false, error: 'payload_too_large' })
    return sendJson(res, 400, { ok: false, error: 'invalid_json' })
  }

  const kind = parsed?.kind === 'feedback' ? 'feedback' : 'event'
  const payload = sanitizePayload(parsed?.payload)
  const ts = new Date().toISOString()

  const target = path.join(OUT_DIR, kind === 'feedback' ? 'scanner-feedback.jsonl' : 'scanner-events.jsonl')
  const line = JSON.stringify({ ts, kind, ...payload }).replace(/[\r\n]+/g, ' ') + '\n'

  try {
    await fs.promises.appendFile(target, line, 'utf8')
  } catch {
    return sendJson(res, 500, { ok: false, error: 'write_failed' })
  }

  return sendJson(res, 200, { ok: true, kind })
})

server.listen(PORT, () => {
  console.log(`scanner telemetry server listening on http://localhost:${PORT}/scanner-ingest`)
  console.log(`health endpoint available at http://localhost:${PORT}/health`)
  console.log(`writing jsonl to ${OUT_DIR}`)
})
