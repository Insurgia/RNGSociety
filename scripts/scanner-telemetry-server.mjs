import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const PORT = Number(process.env.SCANNER_TELEMETRY_PORT || 8789)
const OUT_DIR = process.env.SCANNER_TELEMETRY_DIR || path.resolve('data/scans')

fs.mkdirSync(OUT_DIR, { recursive: true })

const allowOrigin = process.env.SCANNER_TELEMETRY_ALLOW_ORIGIN || '*'

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  if (req.method !== 'POST' || req.url !== '/scanner-ingest') {
    res.statusCode = 404
    return res.end('not found')
  }

  let body = ''
  for await (const chunk of req) body += chunk

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    res.statusCode = 400
    return res.end('invalid json')
  }

  const kind = parsed?.kind === 'feedback' ? 'feedback' : 'event'
  const payload = parsed?.payload || {}
  const ts = new Date().toISOString()

  const target = path.join(OUT_DIR, kind === 'feedback' ? 'scanner-feedback.jsonl' : 'scanner-events.jsonl')
  fs.appendFileSync(target, JSON.stringify({ ts, ...payload }) + '\n', 'utf8')

  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ ok: true, kind }))
})

server.listen(PORT, () => {
  console.log(`scanner telemetry server listening on http://localhost:${PORT}/scanner-ingest`)
  console.log(`writing jsonl to ${OUT_DIR}`)
})
