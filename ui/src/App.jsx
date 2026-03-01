import React, { useEffect, useMemo, useState } from 'react'

const BUILD_STAMP = 'BUILD 2026-02-28 11:01 PM | 0af52146'

const currency = (n) => `$${Number(n || 0).toFixed(2)}`
const pct = (n) => `${Number(n || 0).toFixed(1)}%`
const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100
const ceilQuarter = (n) => Math.ceil(Number(n || 0) * 4) / 4
const DB_KEY = 'rng_scanner_db_v1'

const LAB_SEED_TOOLS = [
  { id: 'singles-core', name: 'Singles Calculator', status: 'stable', category: 'Core', summary: 'Production calculator for single-card pricing.', tags: ['calculator', 'core'], testTarget: 'singles' },
  { id: 'purchase-core', name: 'Purchase Calculator', status: 'stable', category: 'Core', summary: 'Production lot-buying calculator.', tags: ['calculator', 'core'], testTarget: 'purchase' },
  { id: 'bags-core', name: 'Bag Builder', status: 'stable', category: 'Core', summary: 'Production bag tracking tool.', tags: ['core', 'workflow'], testTarget: 'bags' },
  { id: 'scanner-core', name: 'Scanner Core', status: 'wip', category: 'Scanner', summary: 'OCR + AI + image matching scanner stack.', tags: ['ocr', 'matching', 'scanner', 'ai'], testTarget: 'scanner' },
  { id: 'scanner-lab', name: 'Scanner Lab', status: 'wip', category: 'Scanner', summary: 'Experimental scanner tuning and edge-case QA.', tags: ['scanner', 'experiments'], testTarget: 'scanner' },
]

function Card({ title, description, children }) {
  return <section className="card"><div className="card-head"><h2>{title}</h2>{description ? <p>{description}</p> : null}</div>{children}</section>
}

function SinglesTab() {
  const [cardCost, setCardCost] = useState('')
  const [freebieCost, setFreebieCost] = useState('')
  const [shipFee, setShipFee] = useState('5')
  const [cardsPerOrder, setCardsPerOrder] = useState('5')
  const [commissionPct, setCommissionPct] = useState('8')
  const [processingPct, setProcessingPct] = useState('2.9')
  const [processingFixed, setProcessingFixed] = useState('0.30')
  const [bufferPct, setBufferPct] = useState('15')

  const calc = useMemo(() => {
    const card = Number(cardCost)
    if (!Number.isFinite(card)) return null
    const freebie = Math.max(0, Number(freebieCost) || 0)
    const ship = Math.max(0, Number(shipFee) || 0)
    const cards = Math.max(1, Math.floor(Number(cardsPerOrder) || 1))
    const commission = Math.min(100, Math.max(0, Number(commissionPct) || 0))
    const processing = Math.min(100, Math.max(0, Number(processingPct) || 0))
    const fixed = Math.max(0, Number(processingFixed) || 0)
    const perCardShip = round2(ship / cards)
    const hardCost = round2(card + freebie + perCardShip)
    const denominator = 1 - (commission + processing) / 100
    const breakEven = denominator > 0 ? (hardCost + fixed) / denominator : hardCost
    const recommended = ceilQuarter(breakEven * (1 + Math.max(0, Number(bufferPct) || 0) / 100))
    const commissionFee = recommended * (commission / 100)
    const processingFee = recommended * (processing / 100) + fixed
    const totalFees = commissionFee + processingFee
    const netEarnings = recommended - totalFees
    const profit = netEarnings - hardCost
    return { perCardShip, hardCost, breakEven: round2(breakEven), recommended: round2(recommended), commission, processing, fixed, commissionFee: round2(commissionFee), processingFee: round2(processingFee), totalFees: round2(totalFees), netEarnings: round2(netEarnings), profit: round2(profit) }
  }, [cardCost, freebieCost, shipFee, cardsPerOrder, commissionPct, processingPct, processingFixed, bufferPct])

  return <Card title="Singles Calculator" description="Pricing + fee-aware profitability for live selling.">
    <div className="grid three">
      <label>Card cost<input value={cardCost} onChange={(e) => setCardCost(e.target.value)} /></label>
      <label>Freebie cost<input value={freebieCost} onChange={(e) => setFreebieCost(e.target.value)} /></label>
      <label>Order shipping<input value={shipFee} onChange={(e) => setShipFee(e.target.value)} /></label>
      <label>Cards per order<input value={cardsPerOrder} onChange={(e) => setCardsPerOrder(e.target.value)} /></label>
      <label>Commission %<input value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} /></label>
      <label>Processing %<input value={processingPct} onChange={(e) => setProcessingPct(e.target.value)} /></label>
      <label>Processing fixed<input value={processingFixed} onChange={(e) => setProcessingFixed(e.target.value)} /></label>
      <label>Buffer %<input value={bufferPct} onChange={(e) => setBufferPct(e.target.value)} /></label>
    </div>
    {calc ? <><div className="kpi"><div className="pill"><span>Break even</span><strong>{currency(calc.breakEven)}</strong></div><div className="pill"><span>Recommended</span><strong>{currency(calc.recommended)}</strong></div><div className={`pill ${calc.profit >= 0 ? 'good' : 'bad'}`}><span>Profit</span><strong>{currency(calc.profit)}</strong></div></div>
      <div className="table-like" style={{ marginTop: 12 }}><div><span>Per-card shipping</span><strong>{currency(calc.perCardShip)}</strong></div><div><span>Hard cost</span><strong>{currency(calc.hardCost)}</strong></div><div><span>Commission ({pct(calc.commission)})</span><strong>-{currency(calc.commissionFee)}</strong></div><div><span>Processing ({pct(calc.processing)} + {currency(calc.fixed)})</span><strong>-{currency(calc.processingFee)}</strong></div><div><span>Total fees</span><strong>-{currency(calc.totalFees)}</strong></div><div><span>Net earnings</span><strong>{currency(calc.netEarnings)}</strong></div></div></>
      : <p className="muted">Enter a card cost to calculate.</p>}
  </Card>
}

function parseBulkPaste(text) {
  return String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split('-').map((x) => x.trim())
    if (parts.length >= 3) return { cardName: parts[0], qty: Number.parseInt(parts[1].replace(/[^0-9]/g, ''), 10) || 1, marketValue: Number(parts[2].replace(/[^0-9.]/g, '')) || 0 }
    return { cardName: line, qty: 1, marketValue: Number(line.match(/\$?([0-9]+(?:\.[0-9]+)?)/)?.[1] || 0) }
  })
}

function PurchaseTab() {
  const [platformFee, setPlatformFee] = useState('12')
  const [processingFee, setProcessingFee] = useState('3')
  const [underperform, setUnderperform] = useState('15')
  const [targetProfit, setTargetProfit] = useState('25')
  const [bulk, setBulk] = useState('Pikachu - 2 - 8.50\nCharizard - 1 - 120')
  const rows = useMemo(() => parseBulkPaste(bulk), [bulk])

  const summary = useMemo(() => {
    const pf = Number(platformFee) / 100
    const pr = Number(processingFee) / 100
    const under = Number(underperform) / 100
    const target = Number(targetProfit) / 100
    const totals = rows.reduce((acc, r) => {
      const market = Number(r.marketValue) || 0
      const qty = Number(r.qty) || 1
      const multiplier = market <= 3 ? 0.9 : market <= 6 ? 0.85 : market <= 12 ? 0.8 : market <= 25 ? 0.75 : market <= 45 ? 0.7 : market <= 75 ? 0.67 : 0.62
      const riskAdjusted = (market * multiplier) * (1 - (pf + pr)) * (1 - under)
      acc.market += market * qty
      acc.risk += riskAdjusted * qty
      return acc
    }, { market: 0, risk: 0 })
    return { totals, recommendedOffer: totals.risk * (1 - target) }
  }, [rows, platformFee, processingFee, underperform, targetProfit])

  return <Card title="Purchase Calculator" description="Bulk lot offer planning with fee + risk adjustment.">
    <div className="grid four"><label>Platform fee %<input value={platformFee} onChange={(e) => setPlatformFee(e.target.value)} /></label><label>Processing fee %<input value={processingFee} onChange={(e) => setProcessingFee(e.target.value)} /></label><label>Underperform %<input value={underperform} onChange={(e) => setUnderperform(e.target.value)} /></label><label>Target profit %<input value={targetProfit} onChange={(e) => setTargetProfit(e.target.value)} /></label></div>
    <label style={{ marginTop: 12 }}>Bulk paste (name - qty - market value)<textarea rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)} /></label>
    <div className="kpi"><div className="pill"><span>Total market</span><strong>{currency(summary.totals.market)}</strong></div><div className="pill"><span>Risk-adjusted net</span><strong>{currency(summary.totals.risk)}</strong></div><div className="pill good"><span>Recommended max offer</span><strong>{currency(summary.recommendedOffer)}</strong></div></div>
  </Card>
}

function BagBuilderTab() {
  const [username, setUsername] = useState('')
  const [platform, setPlatform] = useState('whatnot')
  const [itemName, setItemName] = useState('')
  const [qty, setQty] = useState('1')
  const [salePrice, setSalePrice] = useState('0')
  const [bags, setBags] = useState(() => { try { return JSON.parse(localStorage.getItem('rng-bags-v1') || '[]') } catch { return [] } })
  const [activeId, setActiveId] = useState(null)
  useEffect(() => { localStorage.setItem('rng-bags-v1', JSON.stringify(bags)) }, [bags])

  const activeBag = bags.find((b) => b.id === activeId) || null
  const createBag = () => { if (!username.trim()) return; const id = crypto.randomUUID(); setBags((prev) => [{ id, bagId: `BAG-${String(prev.length + 1).padStart(5, '0')}`, username: username.trim(), platform, status: 'OPEN', items: [] }, ...prev]); setActiveId(id) }
  const addItem = () => {
    if (!activeBag || !itemName.trim()) return
    const item = { id: crypto.randomUUID(), name: itemName.trim(), qty: Math.max(1, Number(qty) || 1), salePrice: Math.max(0, Number(salePrice) || 0) }
    setBags((prev) => prev.map((b) => b.id === activeBag.id ? { ...b, items: [...b.items, item] } : b))
    setItemName(''); setQty('1'); setSalePrice('0')
  }
  const totals = useMemo(() => activeBag ? activeBag.items.reduce((acc, i) => ({ items: acc.items + i.qty, value: acc.value + i.qty * i.salePrice }), { items: 0, value: 0 }) : { items: 0, value: 0 }, [activeBag])

  return <Card title="Bag Builder" description="Customer bag tracking."><div className="grid three"><label>Customer username<input value={username} onChange={(e) => setUsername(e.target.value)} /></label><label>Platform<input value={platform} onChange={(e) => setPlatform(e.target.value)} /></label><label style={{ alignSelf: 'end' }}><button className="btn" onClick={createBag}>Create bag</button></label></div>
    <div className="split" style={{ marginTop: 12 }}><div className="panel"><h3>Active bags</h3>{bags.length === 0 ? <p className="muted">No bags yet.</p> : bags.map((b) => <button key={b.id} className={`list-row ${b.id === activeId ? 'active' : ''}`} onClick={() => setActiveId(b.id)}><span>{b.bagId}</span><small>{b.username} � {b.items.length} items</small></button>)}</div>
      <div className="panel"><h3>{activeBag ? `${activeBag.bagId} � ${activeBag.username}` : 'Select a bag'}</h3>{activeBag ? <><div className="grid three"><label>Item<input value={itemName} onChange={(e) => setItemName(e.target.value)} /></label><label>Qty<input value={qty} onChange={(e) => setQty(e.target.value)} /></label><label>Sale price<input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></label></div><button className="btn" style={{ marginTop: 10 }} onClick={addItem}>Add item</button><div className="kpi" style={{ marginTop: 12 }}><div className="pill"><span>Total qty</span><strong>{totals.items}</strong></div><div className="pill"><span>Total value</span><strong>{currency(totals.value)}</strong></div></div></> : <p className="muted">Create/select a bag to manage items.</p>}</div></div>
  </Card>
}

function hammingDistance(a, b) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d }
function confidenceFromDistance(distance, bits = 64) { return Math.round(Math.max(0, 1 - distance / bits) * 100) }
async function fileToBitmap(file) { return createImageBitmap(file) }
function fileToDataUrl(file) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file) }) }
function bitmapToCanvas(bitmap) { const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height; c.getContext('2d', { willReadFrequently: true }).drawImage(bitmap, 0, 0); return c }
function averageHashFromCanvas(canvas, size = 8) {
  const c = document.createElement('canvas'); c.width = size; c.height = size
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(canvas, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)
  const gray = []; for (let i = 0; i < data.length; i += 4) gray.push((data[i] + data[i + 1] + data[i + 2]) / 3)
  const avg = gray.reduce((a, b) => a + b, 0) / gray.length
  return gray.map((g) => (g >= avg ? '1' : '0')).join('')
}
function detectCardCropRect(canvas) {
  const w = canvas.width, h = canvas.height, ratio = 0.715
  let cw = Math.floor(w * 0.78), ch = Math.floor(cw / ratio)
  if (ch > h * 0.9) { ch = Math.floor(h * 0.9); cw = Math.floor(ch * ratio) }
  return { x: Math.floor((w - cw) / 2), y: Math.floor((h - ch) / 2), w: cw, h: ch }
}
function computeHashes(bitmap) {
  const full = bitmapToCanvas(bitmap)
  const r = detectCardCropRect(full)
  const crop = document.createElement('canvas'); crop.width = r.w; crop.height = r.h
  crop.getContext('2d', { willReadFrequently: true }).drawImage(full, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
  const inner = document.createElement('canvas'); inner.width = Math.floor(crop.width * 0.82); inner.height = Math.floor(crop.height * 0.82)
  const ix = Math.floor((crop.width - inner.width) / 2), iy = Math.floor((crop.height - inner.height) / 2)
  inner.getContext('2d', { willReadFrequently: true }).drawImage(crop, ix, iy, inner.width, inner.height, 0, 0, inner.width, inner.height)
  return { fullHash: averageHashFromCanvas(full), cropHash: averageHashFromCanvas(crop), innerHash: averageHashFromCanvas(inner) }
}
function blendedDistance(q, r) {
  const d1 = hammingDistance(q.fullHash, r.fullHash || r.hash || q.fullHash)
  const d2 = hammingDistance(q.cropHash, r.cropHash || r.hash || q.cropHash)
  const d3 = hammingDistance(q.innerHash, r.innerHash || r.hash || q.innerHash)
  return Math.round(d1 * 0.2 + d2 * 0.5 + d3 * 0.3)
}
function safeJsonParse(text) {
  try { return JSON.parse(text) } catch {
    const match = String(text || '').match(/\{[\s\S]*\}/)
    if (!match) return null
    try { return JSON.parse(match[0]) } catch { return null }
  }
}

function ScannerTab({ coreMode = false }) {
  const devMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1'
  const [referenceDb, setReferenceDb] = useState(() => { try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]') } catch { return [] } })
  const [dbStatus, setDbStatus] = useState('Ready.')
  const [matchStatus, setMatchStatus] = useState('')
  const [results, setResults] = useState([])
  const [ocrText, setOcrText] = useState('')
  const [ocrStatus, setOcrStatus] = useState('')
  const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem('rng_ai_key') || '')
  const [aiPrimaryModel, setAiPrimaryModel] = useState(() => localStorage.getItem('rng_ai_model_primary') || 'openai/gpt-4o-mini')
  const [aiFallbackModel, setAiFallbackModel] = useState(() => localStorage.getItem('rng_ai_model_fallback') || 'openai/gpt-4o')
  const [aiThreshold, setAiThreshold] = useState(() => Number(localStorage.getItem('rng_ai_threshold') || 85))
  const [languageMode, setLanguageMode] = useState(() => localStorage.getItem('rng_lang_mode') || 'auto')
  const [dailyBudgetCap, setDailyBudgetCap] = useState(() => Number(localStorage.getItem('rng_daily_budget_cap') || 2))
  const [aiStatus, setAiStatus] = useState('')
  const [aiResult, setAiResult] = useState(null)
  const [scanHistory, setScanHistory] = useState([])
  const [scanCache, setScanCache] = useState({})
  const [correction, setCorrection] = useState('')
  const [telemetryDir, setTelemetryDir] = useState(null)
  const [telemetryWebhook, setTelemetryWebhook] = useState(() => localStorage.getItem('rng_telemetry_webhook') || '/api/telemetry/ingest')
  const [telemetryStatus, setTelemetryStatus] = useState('Telemetry not connected')
  const [storeImages, setStoreImages] = useState(() => localStorage.getItem('rng_store_images') === '1')
  const [pricingMode, setPricingMode] = useState(() => localStorage.getItem('rng_pricing_mode') || 'none')
  const [rapidApiKey, setRapidApiKey] = useState(() => localStorage.getItem('rng_rapidapi_key') || '')
  const [pricingCurrency, setPricingCurrency] = useState(() => localStorage.getItem('rng_pricing_currency') || 'EUR')
  const [scrapeStatus, setScrapeStatus] = useState('')
  const [scrapeData, setScrapeData] = useState(null)
  const [tcgScrapeData, setTcgScrapeData] = useState(null)
  const [liveScanOn, setLiveScanOn] = useState(false)
  const [liveSpeed, setLiveSpeed] = useState('2x')
  const [liveItems, setLiveItems] = useState([])
  const [runningTotal, setRunningTotal] = useState(0)

  useEffect(() => { localStorage.setItem(DB_KEY, JSON.stringify(referenceDb)) }, [referenceDb])
  useEffect(() => { localStorage.setItem('rng_ai_key', aiApiKey) }, [aiApiKey])
  useEffect(() => { localStorage.setItem('rng_ai_model_primary', aiPrimaryModel) }, [aiPrimaryModel])
  useEffect(() => { localStorage.setItem('rng_ai_model_fallback', aiFallbackModel) }, [aiFallbackModel])
  useEffect(() => { localStorage.setItem('rng_ai_threshold', String(aiThreshold)) }, [aiThreshold])
  useEffect(() => { localStorage.setItem('rng_lang_mode', languageMode) }, [languageMode])
  useEffect(() => { localStorage.setItem('rng_daily_budget_cap', String(dailyBudgetCap)) }, [dailyBudgetCap])
  useEffect(() => { localStorage.setItem('rng_telemetry_webhook', telemetryWebhook) }, [telemetryWebhook])
  useEffect(() => { localStorage.setItem('rng_store_images', storeImages ? '1' : '0') }, [storeImages])
  useEffect(() => { localStorage.setItem('rng_pricing_mode', pricingMode) }, [pricingMode])
  useEffect(() => { localStorage.setItem('rng_rapidapi_key', rapidApiKey) }, [rapidApiKey])
  useEffect(() => { localStorage.setItem('rng_pricing_currency', pricingCurrency) }, [pricingCurrency])

  // Safety net: if scan is verified but pricing is missing, fetch it in-band.
  useEffect(() => {
    if (!aiResult) return
    if (!aiResult.set_number_verified) return
    if (aiResult?.pricing?.primary || aiResult?.pricing?.reason === 'cardmarket_error') return
    runCardmarketPrimary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiResult?.scanHash])


  const videoRef = React.useRef(null)
  const streamRef = React.useRef(null)
  const loopRef = React.useRef(null)
  const seenHashesRef = React.useRef(new Set())
  const seenCardKeysRef = React.useRef(new Map())
  const liveBusyRef = React.useRef(false)

  const captureLiveFrame = async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth || !v.videoHeight) return null
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    const blob = await new Promise((resolve) => c.toBlob((b) => resolve(b), 'image/jpeg', 0.86))
    if (!blob) return null
    return new File([blob], `live-${Date.now()}.jpg`, { type: 'image/jpeg' })
  }

  const startLiveScan = async () => {
    setAiStatus('Live auto-scan is disabled in this build.')
    return
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setAiStatus('Camera API unavailable in this browser.')
        return
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setLiveScanOn(true)
      setAiStatus('Live scan started.')

      const ms = liveSpeed === '1x' ? 1400 : liveSpeed === '3x' ? 500 : 900
      loopRef.current = setInterval(async () => {
        try {
          if (!videoRef.current) return
          if (liveBusyRef.current) return
          liveBusyRef.current = true
          const file = await captureLiveFrame()
          if (!file) return
          const h = await hashFile(file)
          if (seenHashesRef.current.has(h)) return
          seenHashesRef.current.add(h)
          await runAiIdentify(file)
        } finally {
          liveBusyRef.current = false
        }
      }, ms)
    } catch (e) {
      setAiStatus(`Live scan failed to start: ${e?.message || 'unknown error'}`)
    }
  }

  const stopLiveScan = () => {
    setAiStatus('Live auto-scan is disabled in this build.')

    setLiveScanOn(false)
    if (loopRef.current) clearInterval(loopRef.current)
    loopRef.current = null
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop()
      streamRef.current = null
    }
    setAiStatus('Live scan stopped.')
  }

  useEffect(() => {
    return () => {
      if (loopRef.current) clearInterval(loopRef.current)
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop()
      }
    }
  }, [])

  useEffect(() => {
    if (!aiResult?.scanHash || !aiResult?.pricing?.primary?.value) return
    const name = String(aiResult.card_name_english || aiResult.card_name || 'Unknown').toLowerCase().trim()
    const num = String(aiResult.card_number || '-').toLowerCase().trim()
    const setn = String(aiResult.set_name_english || aiResult.set_name || '-').toLowerCase().trim()
    const key = `${name}|${num}|${setn}`
    const now = Date.now()
    const last = Number(seenCardKeysRef.current.get(key) || 0)
    if (now - last < 15000) return
    seenCardKeysRef.current.set(key, now)

    const item = {
      scanHash: aiResult.scanHash,
      name: aiResult.card_name_english || aiResult.card_name || 'Unknown',
      number: aiResult.card_number || '-',
      set: aiResult.set_name_english || aiResult.set_name || '-',
      price: Number(aiResult.pricing.primary.value || 0),
      currency: aiResult.pricing.primary.currency || 'USD',
    }
    setLiveItems((prev) => [item, ...prev].slice(0, 200))
    setRunningTotal((prev) => Number((prev + item.price).toFixed(2)))
  }, [aiResult])

  const todayKey = new Date().toISOString().slice(0, 10)
  const spentToday = useMemo(() => scanHistory.filter((h) => String(h.ts || '').startsWith(todayKey)).reduce((a, b) => a + Number(b.estimatedCost || 0), 0), [scanHistory, todayKey])

  const appendJsonl = async (name, payload) => {
    if (!telemetryDir) return false
    const fileHandle = await telemetryDir.getFileHandle(name, { create: true })
    const file = await fileHandle.getFile()
    const existing = await file.text()
    const w = await fileHandle.createWritable()
    await w.write(existing + JSON.stringify(payload) + '\n')
    await w.close()
    return true
  }

  const postWebhook = async (kind, payload) => {
    if (!telemetryWebhook) return false
    const res = await fetch(telemetryWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, payload }),
    })
    if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`)
    return true
  }

  const validateTelemetryWebhook = async () => {
    if (!telemetryWebhook) {
      setTelemetryStatus('Webhook empty.')
      window.alert('Telemetry webhook is empty.')
      return
    }
    setTelemetryStatus('Validating webhook with real POST...')
    try {
      await postWebhook('event', {
        ts: new Date().toISOString(),
        hash: 'validate-' + Date.now(),
        model: 'telemetry-validator',
        confidence: 100,
        estimatedCost: 0,
        note: 'connectivity test',
      })
      setTelemetryStatus('Webhook reachable (POST succeeded).')
      window.alert('Telemetry webhook test succeeded.')
    } catch (err) {
      const msg = String(err?.message || err || 'unknown error')
      setTelemetryStatus(`Webhook failed: ${msg}`)
      window.alert(`Telemetry webhook test failed: ${msg}`)
    }
  }

  const emitTelemetry = async (kind, payload, fileName) => {
    try {
      if (telemetryDir) {
        await appendJsonl(fileName, payload)
        return 'filesystem'
      }
      if (telemetryWebhook) {
        await postWebhook(kind, payload)
        return 'webhook'
      }
      return 'none'
    } catch (err) {
      setTelemetryStatus(`Telemetry sync failed: ${err?.message || 'unknown error'}`)
      return 'error'
    }
  }

  const connectTelemetryFolder = async () => {
    try {
      if (!window.showDirectoryPicker) {
        setTelemetryStatus('Browser does not support filesystem writing (need Chromium desktop).')
        return
      }
      const dir = await window.showDirectoryPicker()
      setTelemetryDir(dir)
      setTelemetryStatus('Telemetry connected to selected folder.')

      // Load existing events to restore today spend + history context
      try {
        const evHandle = await dir.getFileHandle('scanner-events.jsonl', { create: true })
        const evFile = await evHandle.getFile()
        const lines = (await evFile.text()).split(/\n+/).filter(Boolean)
        const parsed = lines.map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
        setScanHistory(parsed.slice(-500).reverse())
      } catch {}
    } catch {
      setTelemetryStatus('Telemetry folder connection cancelled.')
    }
  }

  const buildDb = async (files) => {
    const imageFiles = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
    if (!imageFiles.length) return setDbStatus('No images selected.')
    setDbStatus('Building DB...')
    const next = []
    for (let i = 0; i < imageFiles.length; i++) {
      const f = imageFiles[i]
      try { next.push({ id: `${f.name}-${i}`, name: f.name, previewUrl: URL.createObjectURL(f), ...computeHashes(await fileToBitmap(f)) }) } catch {}
      setDbStatus(`Building DB... ${i + 1}/${imageFiles.length}`)
    }
    setReferenceDb(next)
    setDbStatus(`DB ready (${next.length} cards indexed).`)
  }

  const runMatch = async (file) => {
    if (!file) return setMatchStatus('Pick a query image first.')
    if (!referenceDb.length) return setMatchStatus('Build DB first.')
    setMatchStatus('Matching...')
    const query = computeHashes(await fileToBitmap(file))
    const top = referenceDb.map((ref) => {
      const distance = blendedDistance(query, ref)
      return { ...ref, distance, confidence: confidenceFromDistance(distance) }
    }).sort((a, b) => a.distance - b.distance).slice(0, 8)
    setResults(top)
    setMatchStatus(`Done. Top ${top.length} matches.`)
  }

  const runOcr = async (file) => {
    if (!file) return setOcrStatus('Pick an image for OCR first.')
    setOcrStatus('OCR running...')
    try {
      const { recognize } = await import('tesseract.js')
      const out = await recognize(file, languageMode === 'japanese' ? 'jpn+eng' : 'eng')
      setOcrText(out?.data?.text?.trim() || '')
      setOcrStatus('OCR complete.')
    } catch { setOcrStatus('OCR failed. Check console/network and retry.') }
  }

  const extractSetNumber = (text) => {
    const m = String(text || '').match(/(\d{1,3}\/\d{2,3})/)
    return m ? m[1] : null
  }

  const normalizeSetNumber = (text) => {
    const m = String(text || '').match(/(\d{1,3})\s*\/\s*(\d{2,3})/)
    return m ? `${m[1]}/${m[2]}` : null
  }

  const normalizeName = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff ]/g, ' ').replace(/\s+/g, ' ').trim()

  const digitDistance = (a, b) => {
    if (!a || !b || a.length !== b.length) return 999
    let d = 0
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++
    return d
  }

  const autoResolveSetNumber = async (ai) => {
    const rawName = ai.card_name_native || ai.card_name_english || ai.card_name || ''
    const rawSet = ai.set_name_native || ai.set_name_english || ai.set_name || ''
    const rawNumber = extractSetNumber(ai.card_number)

    const baseQuery = [rawName, rawSet, 'pokemon card']
      .filter(Boolean)
      .join(' ')

    try {
      const q1 = encodeURIComponent(baseQuery)
      const url1 = 'https://r.jina.ai/http://pkmncards.com/?s=' + q1 + '&sort=date&display=images'
      const text1 = await fetch(url1).then((r) => r.text())

      const nums1 = [...text1.matchAll(/\b(\d{1,3}\/\d{2,3})\b/g)].map((m) => m[1])
      let unique = [...new Set(nums1)]

      if (!unique.length && rawNumber) {
        const q2 = encodeURIComponent(baseQuery + ' ' + rawNumber)
        const url2 = 'https://r.jina.ai/http://pkmncards.com/?s=' + q2 + '&sort=date&display=images'
        const text2 = await fetch(url2).then((r) => r.text())
        const nums2 = [...text2.matchAll(/\b(\d{1,3}\/\d{2,3})\b/g)].map((m) => m[1])
        unique = [...new Set(nums2)]
      }

      if (!unique.length) return { number: rawNumber, verified: !!rawNumber, reason: 'live-no-match' }
      if (rawNumber && unique.includes(rawNumber)) return { number: rawNumber, verified: true, reason: 'live-exact' }
      if (rawNumber) {
        const [lhs, rhs] = rawNumber.split('/')
        const lhsPad = String(lhs || '').padStart(3, '0')
        const viable = unique
          .map((n) => {
            const [base, den] = n.split('/')
            const d = digitDistance(String(base).padStart(3, '0'), lhsPad)
            const rhsOk = !rhs || den === rhs
            return { n, d, rhsOk }
          })
          .filter((x) => x.rhsOk)
          .sort((a, b) => a.d - b.d)

        if (viable.length && viable[0].d <= 1) {
          return { number: viable[0].n, verified: true, reason: 'live-autocorrect-one-digit', from: rawNumber }
        }
      }

      if (unique.length === 1) return { number: unique[0], verified: true, reason: 'live-single-candidate', from: rawNumber || null }
      return { number: rawNumber, verified: false, reason: 'live-ambiguous' }
    } catch {
      return { number: rawNumber, verified: !!rawNumber, reason: 'live-source-unavailable' }
    }
  }

  const verifyAgainstDb = (ai) => {
    if (!ai || !referenceDb.length) return null
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9぀-ヿ㐀-鿿]/g, '')
    const primaryName = languageMode === 'japanese' ? (ai.card_name_native || ai.card_name) : (ai.card_name_english || ai.card_name)
    const setName = languageMode === 'japanese' ? (ai.set_name_native || ai.set_name) : (ai.set_name_english || ai.set_name)
    const target = norm(`${primaryName || ''} ${setName || ''} ${ai.card_number || ''}`)
    const scored = referenceDb.map((r) => {
      const hay = norm(r.name)
      let score = 0
      if (primaryName && hay.includes(norm(primaryName))) score += 60
      if (ai.card_number && hay.includes(norm(ai.card_number))) score += 25
      if (setName && hay.includes(norm(setName))) score += 15
      if (target && hay.includes(target)) score += 20
      return { ...r, verifyScore: score }
    }).sort((a, b) => b.verifyScore - a.verifyScore)
    return scored[0]?.verifyScore > 0 ? scored[0] : null
  }

  const hashFile = async (file) => {
    const buf = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  const compressForVision = async (file, maxDim = 1024, quality = 0.78) => {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality))
  }

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob)
  })

  const cropSetIdRegion = async (file) => {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0)

    const cw = canvas.width
    const ch = Math.max(1, Math.round(canvas.height * 0.24))
    const sx = 0
    const sy = Math.max(0, canvas.height - ch - Math.round(canvas.height * 0.01))

    const out = document.createElement('canvas')
    out.width = cw
    out.height = ch
    const octx = out.getContext('2d')
    octx.drawImage(canvas, sx, sy, cw, ch, 0, 0, cw, ch)

    return await new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/jpeg', 0.9))
  }

  const callVisionSetId = async (model, imageDataUrl) => {
    const prompt = 'Read only the card set number from this cropped image. Return ONLY JSON: {"card_number":"###/###","confidence":0-100}'
    const endpoint = devMode && aiApiKey ? 'https://openrouter.ai/api/v1/chat/completions' : '/api/vision/chat'
    const headers = devMode && aiApiKey
      ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + aiApiKey }
      : { 'Content-Type': 'application/json' }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } }] }],
      }),
    })
    if (!res.ok) {
      let detail = ''
      try { detail = await res.text() } catch {}
      throw new Error(`HTTP ${res.status}${detail ? ` - ${detail.slice(0, 220)}` : ''}`)
    }
    const json = await res.json()
    const parsed = safeJsonParse(json?.choices?.[0]?.message?.content || '')
    return parsed || null
  }

  const getRatePer1K = (model) => {
    const m = String(model || '').toLowerCase()
    if (m.includes('4o-mini')) return { in: 0.00015, out: 0.0006 }
    if (m.includes('4o')) return { in: 0.0025, out: 0.01 }
    return { in: 0.0005, out: 0.002 }
  }
  const estimateCost = (model, usage) => {
    const rate = getRatePer1K(model)
    const inTok = Number(usage?.prompt_tokens || 0)
    const outTok = Number(usage?.completion_tokens || 0)
    return (inTok / 1000) * rate.in + (outTok / 1000) * rate.out
  }

  const buildPrompt = () => {
    const langInstruction = languageMode === 'japanese'
      ? 'This is likely a Japanese Pokemon card. Prefer Japanese/native naming and printed Japanese set conventions.'
      : languageMode === 'english'
      ? 'This is likely an English Pokemon card. Prefer English naming and set conventions.'
      : 'Auto-detect whether card is Japanese or English.'
    return `Identify this Pokemon trading card from the image. ${langInstruction} Return ONLY valid JSON with keys: detected_language, card_name, card_name_native, card_name_english, set_name, set_name_native, set_name_english, card_number, rarity, confidence (0-100), alternatives (array up to 3), reasoning_short.`
  }

  const callVisionModel = async (model, imageDataUrl) => {
    const prompt = buildPrompt()
    const endpoint = devMode && aiApiKey ? 'https://openrouter.ai/api/v1/chat/completions' : '/api/vision/chat'
    const headers = devMode && aiApiKey
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${aiApiKey}` }
      : { 'Content-Type': 'application/json' }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } }] }],
      }),
    })
    if (!res.ok) {
      let detail = ''
      try { detail = await res.text() } catch {}
      throw new Error(`HTTP ${res.status}${detail ? ` - ${detail.slice(0, 220)}` : ''}`)
    }
    const json = await res.json()
    const text = json?.choices?.[0]?.message?.content || ''
    const parsed = safeJsonParse(text)
    if (!parsed) throw new Error('Model did not return parseable JSON')
    return { parsed, usage: json?.usage || {}, model }
  }

  const summarizePrices = (allPricesInOrder) => {
    const recent5 = allPricesInOrder.slice(0, 5)
    const recentAvg = recent5.reduce((a, b) => a + b, 0) / recent5.length
    const recentMedianSorted = [...recent5].sort((a, b) => a - b)
    const recentMedian = recentMedianSorted[Math.floor(recentMedianSorted.length / 2)]
    const sortedAll = [...allPricesInOrder].sort((a, b) => a - b)
    const globalMedian = sortedAll[Math.floor(sortedAll.length / 2)]
    const globalAvg = allPricesInOrder.reduce((a, b) => a + b, 0) / allPricesInOrder.length
    const currentMarket = (recentAvg * 0.85) + (globalMedian * 0.15)
    return {
      sample: allPricesInOrder.length,
      recentSample: recent5.length,
      recentMedian: Number(recentMedian.toFixed(2)),
      recentAverage: Number(recentAvg.toFixed(2)),
      globalMedian: Number(globalMedian.toFixed(2)),
      globalAverage: Number(globalAvg.toFixed(2)),
      currentMarket: Number(currentMarket.toFixed(2)),
    }
  }

  const runExperimentalEbayScrape = async () => {
    if (!aiResult) return
    const query = encodeURIComponent(`${aiResult.card_name_english || aiResult.card_name || ''} ${aiResult.card_number || ''} pokemon card sold`)
    const target = `https://r.jina.ai/http://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1&rt=nc`
    setScrapeStatus('Scraping sold comps...')
    setScrapeData(null)
    try {
      const text = await fetch(target).then((r) => r.text())
      const allPricesInOrder = [...text.matchAll(/\$([0-9]+(?:\.[0-9]{1,2})?)/g)]
        .map((m) => Number(m[1]))
        .filter((n) => Number.isFinite(n) && n > 0.5 && n < 5000)

      if (!allPricesInOrder.length) {
        setScrapeStatus('No usable sold prices found.')
        return
      }

      const summary = summarizePrices(allPricesInOrder)
      setScrapeData(summary)
      setScrapeStatus(`Sold comps found: ${allPricesInOrder.length} (weighted to latest ${summary.recentSample})`)
    } catch (e) {
      setScrapeStatus(`Scrape failed: ${e?.message || 'unknown error'}`)
    }
  }



  const convertCurrency = async (amount, from, to) => {
    if (!Number.isFinite(amount)) return null
    if (!to || from === to) return { value: Number(amount.toFixed(2)), currency: from, rate: 1 }
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      if (!res.ok) throw new Error(`FX HTTP ${res.status}`)
      const json = await res.json()
      const val = Number(json?.rates?.[to])
      if (!Number.isFinite(val)) return null
      return { value: Number(val.toFixed(2)), currency: to, rate: Number((val / amount).toFixed(6)) }
    } catch {
      return null
    }
  }

  const fetchCardmarketPrimaryPrice = async (ai) => {
    const cardName = String(ai.card_name_english || ai.card_name_native || ai.card_name || '').trim()
    const cardNum = String(ai.card_number || '').trim()
    const setName = String(ai.set_name_english || ai.set_name_native || ai.set_name || '').trim().toLowerCase()

    // Production path: server-side proxy keeps secrets out of client
    try {
      const proxyRes = await fetch('/api/cardmarket/price', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cardName, cardNum, setName }),
      })
      if (proxyRes.ok) {
        const pj = await proxyRes.json()
        if (pj?.ok && pj?.data?.value) return pj.data
      }
    } catch {}

    // Dev fallback only (direct RapidAPI from browser)
    if (!rapidApiKey) throw new Error('Cardmarket proxy unavailable and no dev RapidAPI key configured')
    const headers = {
      'x-rapidapi-host': 'cardmarket-api-tcg.p.rapidapi.com',
      'x-rapidapi-key': rapidApiKey,
    }

    const buildUrl = (name, number) => {
      const q = new URLSearchParams()
      if (name) q.set('name', name)
      if (number) q.set('card_number', number)
      q.set('sort', 'relevance')
      q.set('page', '1')
      return `https://cardmarket-api-tcg.p.rapidapi.com/pokemon/cards/search?${q.toString()}`
    }

    const fetchSearch = async (name, number) => {
      const res = await fetch(buildUrl(name, number), { headers })
      if (!res.ok) throw new Error(`Cardmarket search HTTP ${res.status}`)
      const json = await res.json()
      return Array.isArray(json?.data) ? json.data : []
    }

    let cards = await fetchSearch(cardName, cardNum)
    if (!cards.length && cardName) cards = await fetchSearch(cardName, '')
    if (!cards.length) throw new Error('No cards returned from Cardmarket search')

    const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
    const nameN = norm(cardName)
    const numBase = cardNum.split('/')[0]

    const scored = cards.map((c) => {
      let score = 0
      const cName = norm(c.name)
      const cNum = String(c.card_number ?? '').trim()
      const epName = norm(c?.episode?.name || '')

      if (nameN && (cName === nameN)) score += 70
      else if (nameN && (cName.includes(nameN) || nameN.includes(cName))) score += 50

      if (cardNum && cNum === cardNum) score += 40
      if (numBase && String(cNum).split('/')[0] === numBase) score += 20
      if (setName && epName.includes(norm(setName))) score += 25

      return { ...c, _score: score }
    }).sort((a, b) => b._score - a._score)

    const candidate = scored[0]
    if (!candidate || candidate._score < 35) throw new Error('No confident Cardmarket match')

    const prices = candidate?.prices?.cardmarket || {}
    const value = Number(prices.avg30 || prices.avg7 || prices.trend || prices.lowest_near_mint || prices.sell || prices.average || 0)
    if (!Number.isFinite(value) || value <= 0) throw new Error('No usable Cardmarket price value')

    return {
      source: 'cardmarket-api-tcg',
      currency: prices.currency || 'EUR',
      value: Number(value.toFixed(2)),
      baseCurrency: prices.currency || 'EUR',
      fetchedAt: new Date().toISOString(),
      cardmarketId: candidate.cardmarket_id || null,
      tcgid: candidate.tcgid || null,
      confidence: candidate._score,
      matchedName: candidate.name || null,
      matchedNumber: candidate.card_number || null,
      matchedEpisode: candidate?.episode?.name || null,
      topCandidates: scored.slice(0, 3).map((x) => ({
        name: x.name,
        number: x.card_number,
        episode: x?.episode?.name,
        score: x._score,
      })),
    }
  }

  const runCardmarketPrimary = async () => {
    if (!aiResult) return
    setScrapeStatus('Fetching Cardmarket primary price...')
    try {
      const cm = await fetchCardmarketPrimaryPrice(aiResult)
      const fx = await convertCurrency(cm.value, cm.baseCurrency || cm.currency || 'EUR', pricingCurrency)
      const primary = fx ? { ...cm, value: fx.value, currency: fx.currency, fxRate: fx.rate, convertedFrom: cm.baseCurrency || cm.currency || 'EUR' } : cm
      setAiResult((prev) => prev ? { ...prev, pricing: { ...(prev.pricing || {}), primary, final: primary.value, reason: fx ? 'cardmarket_primary_converted' : 'cardmarket_primary' } } : prev)
      setScrapeStatus(`Cardmarket price fetched: ${primary.value} ${primary.currency}${fx ? ` (from ${cm.value} ${cm.baseCurrency || cm.currency || 'EUR'})` : ''}`)
    } catch (e) {
      setAiResult((prev) => prev ? { ...prev, pricing: { ...(prev.pricing || {}), reason: 'cardmarket_error', error: String(e?.message || e) } } : prev)
      setScrapeStatus(`Cardmarket fetch failed: ${e?.message || 'unknown error'}`)
    }
  }

  const runExperimentalHybridScrape = async () => {
    if (!aiResult) return
    setScrapeStatus('Scraping eBay + TCG...')
    setScrapeData(null)
    setTcgScrapeData(null)

    const name = aiResult.card_name_english || aiResult.card_name || ''
    const number = aiResult.card_number || ''

    const ebayQ = encodeURIComponent(`${name} ${number} pokemon card sold`)
    const tcgQ = encodeURIComponent(`${name} ${number} site:tcgplayer.com pokemon`)

    const ebayUrl = `https://r.jina.ai/http://www.ebay.com/sch/i.html?_nkw=${ebayQ}&LH_Sold=1&LH_Complete=1&rt=nc`
    const tcgUrl = `https://r.jina.ai/http://www.google.com/search?q=${tcgQ}`

    try {
      const [ebayText, tcgText] = await Promise.all([
        fetch(ebayUrl).then((r) => r.text()),
        fetch(tcgUrl).then((r) => r.text()),
      ])

      const parsePrices = (text) => [...text.matchAll(/\$([0-9]+(?:\.[0-9]{1,2})?)/g)]
        .map((m) => Number(m[1]))
        .filter((n) => Number.isFinite(n) && n > 0.5 && n < 5000)

      const ebayPrices = parsePrices(ebayText)
      const tcgPrices = parsePrices(tcgText)

      if (!ebayPrices.length && !tcgPrices.length) {
        setScrapeStatus('No usable prices found from either source.')
        return
      }

      const ebaySummary = ebayPrices.length ? summarizePrices(ebayPrices) : null
      const tcgSummary = tcgPrices.length ? summarizePrices(tcgPrices) : null
      setScrapeData(ebaySummary)
      setTcgScrapeData(tcgSummary)

      let blended = null
      if (ebaySummary && tcgSummary) {
        const wE = Math.min(0.8, Math.max(0.2, ebaySummary.sample / (ebaySummary.sample + tcgSummary.sample)))
        const wT = 1 - wE
        blended = Number((ebaySummary.currentMarket * wE + tcgSummary.currentMarket * wT).toFixed(2))
      } else {
        blended = (ebaySummary || tcgSummary).currentMarket
      }

      setScrapeStatus(`Hybrid done. Current blended: $${blended}`)
      setAiResult((prev) => prev ? { ...prev, pricing: { ebay: ebaySummary, tcg: tcgSummary, blendedCurrent: blended } } : prev)
    } catch (e) {
      setScrapeStatus(`Hybrid scrape failed: ${e?.message || 'unknown error'}`)
    }
  }

  const submitFeedback = async (verdict, correctedLabel = '') => {
    if (!aiResult?.scanHash) return
    const feedback = {
      ts: new Date().toISOString(),
      hash: aiResult.scanHash,
      verdict,
      correctedLabel: correctedLabel || null,
      model: aiResult.routedModel || null,
      confidence: Number(aiResult.confidence || 0),
      detected_language: aiResult.detected_language || languageMode,
      predicted_card: aiResult.card_name_native || aiResult.card_name || null,
    }
    setScanHistory((prev) => prev.map((h) => h.hash === aiResult.scanHash ? { ...h, verdict, correctedLabel: correctedLabel || null } : h))
    setAiResult((prev) => prev ? { ...prev, verdict, correctedLabel: correctedLabel || null } : prev)
    const route = await emitTelemetry('feedback', feedback, 'scanner-feedback.jsonl')
    if (route === 'none') {
      setTelemetryStatus('No telemetry target connected (select folder or webhook).')
      window.alert('Feedback NOT saved to telemetry: no target connected.')
    } else if (route === 'error') {
      window.alert('Feedback NOT saved to telemetry: sync failed. Check webhook/folder.')
    } else {
      window.alert('Feedback saved successfully.')
    }
    setAiStatus(`Feedback saved: ${verdict}${correctedLabel ? ' (' + correctedLabel + ')' : ''}`)
  }

  const runAiIdentify = async (file) => {
    if (!file) return setAiStatus('Pick a card image first.')
    if (devMode && !aiApiKey) return setAiStatus('Add API key first.')
    if (spentToday >= dailyBudgetCap) return setAiStatus(`Daily cap reached ($${dailyBudgetCap}).`)

    setAiStatus('Preparing image + checking cache...')
    setAiResult(null)

    try {
      const scanHash = await hashFile(file)
      const cached = scanCache[scanHash]
      if (cached) {
        setAiResult({ ...cached.result, cached: true, scanHash })
        setAiStatus('Cache hit: returned previous result instantly.')
        return
      }

      const compressed = await compressForVision(file)
      const imageDataUrl = await blobToDataUrl(compressed)
      const compressedB64 = await blobToDataUrl(compressed)

      setAiStatus('AI identify running (primary model)...')
      const primary = await callVisionModel(aiPrimaryModel, imageDataUrl)
      const primaryConfidence = Number(primary.parsed?.confidence || 0)
      const primaryVerified = verifyAgainstDb(primary.parsed)
      let totalCost = estimateCost(aiPrimaryModel, primary.usage)

      let finalResult = { ...primary.parsed, routedModel: aiPrimaryModel, verifiedMatch: primaryVerified || null, escalated: false, scanHash }
      const needsEscalation = primaryConfidence < Number(aiThreshold || 85) || !primaryVerified

      if (needsEscalation) {
        setAiStatus('Escalating to fallback model...')
        const fallback = await callVisionModel(aiFallbackModel, imageDataUrl)
        totalCost += estimateCost(aiFallbackModel, fallback.usage)
        const fallbackVerified = verifyAgainstDb(fallback.parsed)
        finalResult = { ...fallback.parsed, routedModel: aiFallbackModel, verifiedMatch: fallbackVerified || null, escalated: true, primaryCandidate: { ...primary.parsed, verified: !!primaryVerified }, scanHash }
      }

      try {
        finalResult = { ...finalResult, set_number_crop_attempted: true, set_number_before_crop: finalResult.card_number || null }
        const cropBlob = await cropSetIdRegion(file)
        const cropDataUrl = await blobToDataUrl(cropBlob)
        const cropRead = await callVisionSetId(aiPrimaryModel, cropDataUrl) || {}
        const cropRaw = String(cropRead?.card_number || '').trim()
        const cropNum = normalizeSetNumber(cropRaw) || extractSetNumber(cropRaw)
        finalResult = {
          ...finalResult,
          set_number_crop_raw: cropRaw || null,
          set_number_crop_confidence: Number(cropRead?.confidence || 0),
          set_number_crop_image_bytes: Number(cropBlob?.size || 0),
        }
        if (cropNum) {
          finalResult = { ...finalResult, card_number: cropNum }
        }
      } catch (err) {
        finalResult = { ...finalResult, set_number_crop_error: String(err?.message || err || 'crop-pass-failed') }
      }

      if (finalResult.card_number && Number(finalResult.set_number_crop_confidence || 0) >= 85) {
        finalResult = { ...finalResult, set_number_verified: true, set_number_resolution_reason: 'crop-authoritative', set_number_original: finalResult.set_number_before_crop || null }
      } else {
        const resolved = await autoResolveSetNumber(finalResult)
        finalResult = { ...finalResult, card_number: resolved.number || finalResult.card_number, set_number_verified: !!resolved.verified, set_number_resolution_reason: resolved.reason, set_number_original: resolved.from || null }
      }

      // Auto-fetch primary pricing after set verification succeeds
      try {
        const cm = await fetchCardmarketPrimaryPrice(finalResult)
        const fx = await convertCurrency(cm.value, cm.baseCurrency || cm.currency || 'EUR', pricingCurrency)
        const primary = fx ? { ...cm, value: fx.value, currency: fx.currency, fxRate: fx.rate, convertedFrom: cm.baseCurrency || cm.currency || 'EUR' } : cm
        finalResult = { ...finalResult, pricing: { ...(finalResult.pricing || {}), primary, final: primary.value, reason: fx ? 'cardmarket_primary_converted' : 'cardmarket_primary' } }
      } catch (priceErr) {
        finalResult = { ...finalResult, pricing: { ...(finalResult.pricing || {}), reason: 'cardmarket_error', error: String(priceErr?.message || priceErr) } }
      }

      const baseHistory = { ts: new Date().toISOString(), hash: scanHash, card: finalResult.card_name || null, card_number: finalResult.card_number || null, set_number_verified: finalResult.set_number_verified, set_number_resolution_reason: finalResult.set_number_resolution_reason, set_number_original: finalResult.set_number_original || null, set_number_before_crop: finalResult.set_number_before_crop || null, set_number_crop_raw: finalResult.set_number_crop_raw || null, set_number_crop_confidence: Number(finalResult.set_number_crop_confidence || 0), set_number_crop_error: finalResult.set_number_crop_error || null, set_number_crop_image_bytes: Number(finalResult.set_number_crop_image_bytes || 0), model: finalResult.routedModel, confidence: Number(finalResult.confidence || 0), escalated: !!finalResult.escalated, estimatedCost: Number(totalCost.toFixed(6)), lang: finalResult.detected_language || languageMode, imageDataUrl: storeImages ? compressedB64 : null }

      if (!finalResult.card_number || !String(finalResult.card_number).includes('/') || !finalResult.set_number_verified) {
        const blockedHistory = { ...baseHistory, status: 'blocked_unverified_setid' }
        setScanHistory((prev) => [blockedHistory, ...prev].slice(0, 500))
        await emitTelemetry('event', blockedHistory, 'scanner-events.jsonl')
        setAiResult(finalResult)
        setAiStatus('Scan incomplete: set number could not be auto-verified. Blocked until verified.')
        return
      }
      const historyEntry = { ...baseHistory, status: 'verified' }
      setScanHistory((prev) => [historyEntry, ...prev].slice(0, 500))
      setScanCache((prev) => ({ ...prev, [scanHash]: { ts: historyEntry.ts, result: finalResult } }))
      const route = await emitTelemetry('event', historyEntry, 'scanner-events.jsonl')
      if (route === 'none') setTelemetryStatus('No telemetry target connected (select folder or webhook).')
      if (route === 'error') setTelemetryStatus('Telemetry sync failed, but scan result succeeded.')

      setAiResult({ ...finalResult, estimatedCost: historyEntry.estimatedCost, cached: false })
      const suffix = route === 'error' ? ' (telemetry failed)' : ''
      setAiStatus(`AI identify complete (${finalResult.routedModel}${finalResult.escalated ? ', escalated' : ''}). Est. cost: ${historyEntry.estimatedCost}${suffix}`)
    } catch (e) {
      if (String(e.message || '').includes('HTTP 402')) setAiStatus('AI identify failed: OpenRouter credits/billing required (402).')
      else if (String(e.message || '').includes('HTTP 429')) setAiStatus('AI identify failed: rate limited (429). Slow down/retry.')
      else setAiStatus(`AI identify failed: ${e.message || 'unknown error'}`)
    }
  }

  if (coreMode) {
    return <Card title="Scanner Core" description="Deep diagnostics + tuning for scanner internals.">
      <div className="scanner-grid">
        <div className="panel">
          <h3>Reference DB</h3>
          <label>Upload card image folder<input type="file" multiple accept="image/*" onChange={(e) => buildDb(e.target.files)} /></label>
          <div className="action-row"><button className="btn" onClick={() => { setReferenceDb([]); setDbStatus('Reference DB cleared.') }}>Clear DB</button></div>
          <p className="muted">{dbStatus}</p>
          <p className="muted">Indexed cards: {referenceDb.length}</p>
        </div>
        <div className="panel">
          <h3>Database Match Test</h3>
          <label>Query image<input type="file" accept="image/*" onChange={(e) => runMatch(e.target.files?.[0])} /></label>
          <p className="muted">{matchStatus}</p>
          <div className="match-results">{results.map((m) => <div key={m.id} className="result-row"><img src={m.previewUrl} alt={m.name} /><div><strong>{m.name}</strong><div className="muted">Confidence {m.confidence}%</div></div></div>)}</div>
        </div>
        <div className="panel">
          <h3>OCR Test</h3>
          <label>OCR image<input type="file" accept="image/*" onChange={(e) => runOcr(e.target.files?.[0])} /></label>
          <p className="muted">{ocrStatus}</p>
          <textarea rows={6} value={ocrText} onChange={(e) => setOcrText(e.target.value)} />
        </div>
      </div>
    </Card>
  }

  return <Card title="Scanner" description="Capture-first reseller scanner flow.">
    <div className="scan-shell">
      <section className="scan-capture">
        <div className="scan-kicker">Step 1</div>
        <h3>Capture card</h3>
        <p className="muted">Tap the capture button to scan one card at a time (RareCandy style).</p>
        <div className="live-cam-wrap">
          <video ref={videoRef} className="live-cam" playsInline muted autoPlay />
          <div className="cam-overlay">
            <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          </div>
        </div>
        <label className="capture-drop">
          <input type="file" accept="image/*" onChange={(e) => runAiIdentify(e.target.files?.[0])} />
          <span>Manual upload fallback</span>
        </label>
        <div className="action-row">
          <select value={languageMode} onChange={(e) => setLanguageMode(e.target.value)} style={{maxWidth:130}}><option value="auto">Language: Auto</option><option value="english">Language: English</option><option value="japanese">Language: Japanese</option></select>
          <select value={pricingCurrency} onChange={(e) => setPricingCurrency(e.target.value)} style={{maxWidth:110}}><option value="USD">USD</option><option value="CAD">CAD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="JPY">JPY</option></select>
          <button className="btn" onClick={async () => { const f = await captureLiveFrame(); if (f) await runAiIdentify(f); else setAiStatus('Camera not ready yet.'); }}>Tap to capture + scan</button>
          <button className="btn" onClick={runCardmarketPrimary} disabled={!aiResult}>Refresh price</button>
        </div>
        <div className="muted">{aiStatus || 'Ready.'}</div>
        <div className="price-pill">Running total: {runningTotal} {aiResult?.pricing?.primary?.currency || pricingCurrency}</div>
      </section>

      <section className="scan-result panel">
        <div className="scan-kicker">Step 2</div>
        <h3>Verify + price</h3>
        {!aiResult ? <p className="muted">No result yet. Run a scan to populate this card.</p> : <>
          <div className="result-title">{aiResult.card_name_native || aiResult.card_name || 'Unknown card'}</div>
          <div className="muted">EN: {aiResult.card_name_english || '-'}</div>
          <div className="result-grid">
            <div><span>Set</span><strong>{aiResult.set_name_english || aiResult.set_name || '-'}</strong></div>
            <div><span>No.</span><strong>{aiResult.card_number || '-'}</strong></div>
            <div><span>Confidence</span><strong>{aiResult.confidence ?? '-'}%</strong></div>
            <div><span>Set verify</span><strong>{aiResult.set_number_verified ? 'Verified' : 'Unverified'}</strong></div>
          </div>
          {aiResult?.pricing?.primary ? <div className="price-pill">{aiResult.pricing.primary.value} {aiResult.pricing.primary.currency} <small>via {aiResult.pricing.primary.source}</small></div> : null}
          {aiResult?.pricing?.reason ? <div className="muted">Pricing: {aiResult.pricing.reason}{aiResult?.pricing?.error ? ` (${aiResult.pricing.error})` : ''}</div> : null}
          <div className="action-row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => submitFeedback('correct')}>Correct</button>
            <button className="btn" onClick={() => submitFeedback('incorrect')}>Incorrect</button>
            <button className="btn" onClick={() => submitFeedback('corrected', correction)} disabled={!correction.trim()}>Save correction</button>
          </div>
          <label style={{ marginTop: 8 }}>Corrected label
            <input value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Charizard ex 134/108 JP" />
          </label>
        </>}
      </section>
    </div>

    <section className="scan-history panel" style={{ marginTop: 12 }}>
      <div className="lab-head"><h3>Recent scans</h3><span className="muted">{scanHistory.length} entries</span></div>
      <div className="history-row">
        {liveItems.slice(0, 20).map((h, i) => <button key={h.scanHash + i} className="history-chip">
          <strong>{h.name}</strong>
          <small>{h.number} | {h.set} | {h.price} {h.currency}</small>
        </button>)}
        {!liveItems.length ? <span className="muted">No live detections yet.</span> : null}
      </div>
    </section>
  </Card>

}

function ToolPreview({ target }) {
  if (target === 'singles') return <SinglesTab />
  if (target === 'purchase') return <PurchaseTab />
  if (target === 'bags') return <BagBuilderTab />
  if (target === 'scanner') return <ScannerTab coreMode />
  return <Card title="Test Bench" description="No in-app preview mapped yet."><p className="muted">This module has no preview yet.</p></Card>
}

function LabEnvironment({ onLaunchTool }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [statusOverrides, setStatusOverrides] = useState(() => { try { return JSON.parse(localStorage.getItem('rng-lab-status-overrides-v1') || '{}') } catch { return {} } })
  const [customTools, setCustomTools] = useState(() => { try { return JSON.parse(localStorage.getItem('rng-lab-custom-tools-v1') || '[]') } catch { return [] } })
  const [activeToolId, setActiveToolId] = useState(null)
  const [draft, setDraft] = useState({ name: '', summary: '', category: 'General' })
  const [benchTarget, setBenchTarget] = useState(null)

  useEffect(() => { localStorage.setItem('rng-lab-custom-tools-v1', JSON.stringify(customTools)) }, [customTools])
  useEffect(() => { localStorage.setItem('rng-lab-status-overrides-v1', JSON.stringify(statusOverrides)) }, [statusOverrides])

  const allTools = useMemo(() => [...LAB_SEED_TOOLS, ...customTools].map((t) => ({ ...t, status: statusOverrides[t.id] || t.status })), [customTools, statusOverrides])
  const filtered = useMemo(() => allTools.filter((tool) => (statusFilter === 'all' || tool.status === statusFilter) && (!query.trim() || `${tool.name} ${tool.summary} ${tool.category} ${(tool.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase()))), [allTools, query, statusFilter])
  useEffect(() => { if (!activeToolId && filtered.length) setActiveToolId(filtered[0].id); if (activeToolId && !allTools.find((t) => t.id === activeToolId) && filtered.length) setActiveToolId(filtered[0].id) }, [filtered, allTools, activeToolId])

  const active = allTools.find((t) => t.id === activeToolId) || null
  const stableTools = allTools.filter((t) => t.status === 'stable')
  const noteKey = active ? `rng-lab-note-${active.id}` : null
  const [note, setNote] = useState('')
  useEffect(() => { setNote(noteKey ? localStorage.getItem(noteKey) || '' : '') }, [noteKey])
  const persistNote = (text) => { setNote(text); if (noteKey) localStorage.setItem(noteKey, text) }
  const addDraft = () => {
    if (!draft.name.trim()) return
    setCustomTools((prev) => [{ id: `custom-${crypto.randomUUID()}`, name: draft.name.trim(), summary: draft.summary.trim() || 'WIP tool module.', category: draft.category.trim() || 'General', status: 'wip', tags: ['custom', 'wip'] }, ...prev])
    setDraft({ name: '', summary: '', category: 'General' })
  }
  const setStatus = (id, status) => setStatusOverrides((prev) => ({ ...prev, [id]: status }))

  return <Card title="RNG Lab" description="WIP environment + promotion pipeline for all tools.">
    <div className="lab-shell">
      <aside className="panel lab-sidebar">
        <div className="grid" style={{ gap: 8 }}><input placeholder="Search lab tools..." value={query} onChange={(e) => setQuery(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="planned">Planned</option><option value="wip">WIP</option><option value="review">Review</option><option value="stable">Stable</option></select></div>
        <div style={{ marginTop: 10 }}>{filtered.map((tool) => <button key={tool.id} className={`list-row ${activeToolId === tool.id ? 'active' : ''}`} onClick={() => setActiveToolId(tool.id)}><span>{tool.name}</span><small>{tool.category}</small></button>)}{filtered.length === 0 ? <p className="muted">No matching tools.</p> : null}</div>
      </aside>

      <section className="panel lab-main">
        {active ? <><div className="lab-head"><h3>{active.name}</h3><span className={`status-pill ${active.status}`}>{active.status.toUpperCase()}</span></div>
          <p className="muted">{active.summary}</p><div className="chip-row">{(active.tags || []).map((tag) => <span key={tag} className="chip">{tag}</span>)}</div>
          <div className="action-row">
            {active.status === 'planned' ? <button className="btn" onClick={() => setStatus(active.id, 'wip')}>Start WIP</button> : null}
            {active.status === 'wip' ? <button className="btn" onClick={() => setStatus(active.id, 'review')}>Send to Review</button> : null}
            {active.status === 'review' ? <button className="btn" onClick={() => setStatus(active.id, 'stable')}>Graduate to Production</button> : null}
            {active.testTarget ? <button className="btn" onClick={() => setBenchTarget(active.testTarget)}>Open Test View</button> : null}
            {active.testTarget ? <button className="btn" onClick={() => onLaunchTool(active.testTarget)}>Open Full App</button> : null}
          </div>
          <label style={{ marginTop: 10 }}>Lab notes / spec<textarea rows={6} value={note} onChange={(e) => persistNote(e.target.value)} /></label>
        </> : <p className="muted">Select a lab tool.</p>}

        <div className="lab-create"><h4>Add future WIP tool</h4><div className="grid three"><label>Name<input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></label><label>Category<input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} /></label><label style={{ alignSelf: 'end' }}><button className="btn" onClick={addDraft}>Add to Lab</button></label></div><label style={{ marginTop: 8 }}>Summary<textarea rows={2} value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} /></label></div>
        <div className="lab-create"><h4>Production catalog ({stableTools.length})</h4><div className="chip-row">{stableTools.map((t) => <button key={t.id} className="btn btn-sm" onClick={() => t.testTarget && onLaunchTool(t.testTarget)}>{t.name}</button>)}</div></div>
      </section>
    </div>

    {benchTarget ? <div style={{ marginTop: 12 }}><Card title="Lab Test Bench" description="Run and validate module behavior."><ToolPreview target={benchTarget} /></Card></div> : null}
  </Card>
}

export default function App() {
  const [tab, setTab] = useState('singles')
  const [theme, setTheme] = useState(() => localStorage.getItem('rng-theme') === 'light' ? 'light' : 'dark')
  useEffect(() => { document.documentElement.classList.toggle('light', theme === 'light'); localStorage.setItem('rng-theme', theme) }, [theme])

  const tabs = [
    { id: 'singles', label: 'Singles' },
    { id: 'purchase', label: 'Purchase' },
    { id: 'bags', label: 'Bags' },
    { id: 'scanner', label: 'Scanner' },
    { id: 'lab', label: 'Lab' },
  ]

  return <main className="app app-clean">
    <div className="glow" />
    <header className="header clean-header">
      <div className="brand-wrap">
        <div className="logo">R</div>
        <div>
          <div className="eyebrow">RNG Society</div>
          <h1>Toolkit</h1>
        </div>
      </div>
      <div className="top-actions">
        <span className="build-chip">{BUILD_STAMP}</span>
        <button className="btn theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
      </div>
    </header>

    <nav className="tabs tabs5 clean-tabs">{tabs.map((t) => <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</nav>

    {tab === 'scanner' ? <section className="hero-strip">
      <div>
        <div className="hero-title">Built for fast reseller flow</div>
        <div className="muted">Capture ? verify set ID ? price ? commit. No config headaches for end users.</div>
      </div>
      <div className="hero-chips">
        <span className="status-pill stable">Cardmarket primary</span>
        <span className="status-pill review">AI verify enabled</span>
      </div>
    </section> : null}

    {tab === 'singles' && <SinglesTab />}
    {tab === 'purchase' && <PurchaseTab />}
    {tab === 'bags' && <BagBuilderTab />}
    {tab === 'scanner' && <ScannerTab />}
    {tab === 'lab' && <LabEnvironment onLaunchTool={setTab} />}
  </main>
}










































