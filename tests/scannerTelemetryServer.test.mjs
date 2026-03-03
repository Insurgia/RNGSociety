import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { createTelemetryServer } from '../scripts/scanner-telemetry-server.mjs'

const postJson = async (port, body) => {
  const res = await fetch(`http://127.0.0.1:${port}/scanner-ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    status: res.status,
    json: await res.json(),
  }
}

test('scanner telemetry writes event payload and protects reserved keys', async (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rng-scanner-'))
  const telemetry = createTelemetryServer({ port: 0, outDir })

  await new Promise((resolve) => telemetry.server.listen(0, resolve))
  const port = telemetry.server.address().port

  t.after(async () => {
    await new Promise((resolve) => telemetry.server.close(resolve))
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  const response = await postJson(port, {
    kind: 'event',
    payload: {
      ts: 'bad',
      kind: 'bad',
      card: 'Pikachu',
      confidence: 96,
    },
  })

  assert.equal(response.status, 200)
  assert.equal(response.json.ok, true)

  const eventFile = path.join(outDir, 'scanner-events.jsonl')
  const lines = fs.readFileSync(eventFile, 'utf8').trim().split('\n')
  assert.equal(lines.length, 1)

  const row = JSON.parse(lines[0])
  assert.equal(row.kind, 'event')
  assert.equal(row.card, 'Pikachu')
  assert.equal(row.confidence, 96)
  assert.notEqual(row.ts, 'bad')
})

test('scanner telemetry health endpoint includes write stats', async (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rng-scanner-'))
  const telemetry = createTelemetryServer({ port: 0, outDir })

  await new Promise((resolve) => telemetry.server.listen(0, resolve))
  const port = telemetry.server.address().port

  t.after(async () => {
    await new Promise((resolve) => telemetry.server.close(resolve))
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  await postJson(port, {
    kind: 'feedback',
    payload: { note: 'great' },
  })

  const res = await fetch(`http://127.0.0.1:${port}/health`)
  const health = await res.json()

  assert.equal(res.status, 200)
  assert.equal(health.ok, true)
  assert.equal(health.writesOk, 1)
  assert.equal(health.writesFailed, 0)
  assert.equal(typeof health.lastWriteAt, 'string')
})

test('scanner telemetry rejects invalid json body', async (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rng-scanner-'))
  const telemetry = createTelemetryServer({ port: 0, outDir })

  await new Promise((resolve) => telemetry.server.listen(0, resolve))
  const port = telemetry.server.address().port

  t.after(async () => {
    await new Promise((resolve) => telemetry.server.close(resolve))
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  const res = await fetch(`http://127.0.0.1:${port}/scanner-ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{bad json',
  })

  const payload = await res.json()
  assert.equal(res.status, 400)
  assert.equal(payload.error, 'invalid_json')
})
test('scanner telemetry recovers after transient write failure', async (t) => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rng-scanner-'))
  const telemetry = createTelemetryServer({ port: 0, outDir })

  await new Promise((resolve) => telemetry.server.listen(0, resolve))
  const port = telemetry.server.address().port

  t.after(async () => {
    await new Promise((resolve) => telemetry.server.close(resolve))
    fs.promises.appendFile = originalAppendFile
    fs.rmSync(outDir, { recursive: true, force: true })
  })

  const originalAppendFile = fs.promises.appendFile
  let calls = 0
  fs.promises.appendFile = async (...args) => {
    calls += 1
    if (calls === 1) throw new Error('simulated_disk_error')
    return originalAppendFile(...args)
  }

  const first = await postJson(port, {
    kind: 'event',
    payload: { card: 'Charmander' },
  })
  assert.equal(first.status, 500)
  assert.equal(first.json.error, 'write_failed')

  const second = await postJson(port, {
    kind: 'event',
    payload: { card: 'Bulbasaur' },
  })
  assert.equal(second.status, 200)
  assert.equal(second.json.ok, true)

  const eventFile = path.join(outDir, 'scanner-events.jsonl')
  const lines = fs.readFileSync(eventFile, 'utf8').trim().split('\n')
  assert.equal(lines.length, 2)
})
