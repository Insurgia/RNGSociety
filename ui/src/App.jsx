import React, { useEffect, useMemo, useState } from 'react'

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

function ScannerTab() {
  const [referenceDb, setReferenceDb] = useState(() => { try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]') } catch { return [] } })
  const [dbStatus, setDbStatus] = useState('Ready.')
  const [matchStatus, setMatchStatus] = useState('')
  const [results, setResults] = useState([])
  const [ocrText, setOcrText] = useState('')
  const [ocrStatus, setOcrStatus] = useState('')
  const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem('rng_ai_key') || '')
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('rng_ai_model') || 'openai/gpt-4o-mini')
  const [aiStatus, setAiStatus] = useState('')
  const [aiResult, setAiResult] = useState(null)

  useEffect(() => { localStorage.setItem(DB_KEY, JSON.stringify(referenceDb)) }, [referenceDb])
  useEffect(() => { localStorage.setItem('rng_ai_key', aiApiKey) }, [aiApiKey])
  useEffect(() => { localStorage.setItem('rng_ai_model', aiModel) }, [aiModel])

  const buildDb = async (files) => {
    const imageFiles = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
    if (!imageFiles.length) return setDbStatus('No images selected.')
    setDbStatus(`Building DB from ${imageFiles.length} images...`)
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
      const out = await recognize(file, 'eng')
      setOcrText(out?.data?.text?.trim() || '')
      setOcrStatus('OCR complete.')
    } catch { setOcrStatus('OCR failed. Check console/network and retry.') }
  }

  const verifyAgainstDb = (ai) => {
    if (!ai || !referenceDb.length) return null
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const target = norm(`${ai.card_name || ''} ${ai.set_name || ''} ${ai.card_number || ''}`)
    const scored = referenceDb.map((r) => {
      const hay = norm(r.name)
      let score = 0
      if (hay.includes(norm(ai.card_name))) score += 60
      if (ai.card_number && hay.includes(norm(ai.card_number))) score += 25
      if (ai.set_name && hay.includes(norm(ai.set_name))) score += 15
      if (target && hay.includes(target)) score += 20
      return { ...r, verifyScore: score }
    }).sort((a, b) => b.verifyScore - a.verifyScore)
    return scored[0]?.verifyScore > 0 ? scored[0] : null
  }

  const runAiIdentify = async (file) => {
    if (!file) return setAiStatus('Pick a card image first.')
    if (!aiApiKey) return setAiStatus('Add API key first.')
    setAiStatus('AI identify running...')
    setAiResult(null)
    try {
      const imageDataUrl = await fileToDataUrl(file)
      const prompt = `Identify this trading card. Return ONLY valid JSON with keys: card_name, set_name, card_number, rarity, confidence (0-100), alternatives (array of up to 3 strings), reasoning_short.`
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({
          model: aiModel,
          temperature: 0.1,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: imageDataUrl } }] }],
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const text = json?.choices?.[0]?.message?.content || ''
      const parsed = safeJsonParse(text)
      if (!parsed) throw new Error('Model did not return parseable JSON')
      const verified = verifyAgainstDb(parsed)
      setAiResult({ ...parsed, verifiedMatch: verified || null })
      setAiStatus('AI identify complete.')
    } catch (e) {
      setAiStatus(`AI identify failed: ${e.message || 'unknown error'}`)
    }
  }

  return <Card title="Scanner Core" description="Hybrid scanner: OCR + DB matching + AI identify.">
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
        <label>Query card image<input type="file" accept="image/*" onChange={(e) => runMatch(e.target.files?.[0])} /></label>
        <p className="muted">{matchStatus}</p>
        <div className="match-results">{results.map((m) => <div key={m.id} className="result-row"><img src={m.previewUrl} alt={m.name} /><div><strong>{m.name}</strong><div className="muted">Confidence {m.confidence}% � d={m.distance}</div></div></div>)}</div>
      </div>

      <div className="panel">
        <h3>OCR Test</h3>
        <label>Card image for OCR<input type="file" accept="image/*" onChange={(e) => runOcr(e.target.files?.[0])} /></label>
        <p className="muted">{ocrStatus}</p>
        <textarea rows={6} value={ocrText} onChange={(e) => setOcrText(e.target.value)} placeholder="OCR output appears here..." />
      </div>

      <div className="panel">
        <h3>AI Identify (Vision)</h3>
        <label>OpenRouter API key<input type="password" value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)} placeholder="sk-or-v1-..." /></label>
        <label>Model<input value={aiModel} onChange={(e) => setAiModel(e.target.value)} /></label>
        <label>Card image for AI identify<input type="file" accept="image/*" onChange={(e) => runAiIdentify(e.target.files?.[0])} /></label>
        <p className="muted">{aiStatus}</p>
        {aiResult ? <div className="ai-result">
          <div><strong>{aiResult.card_name || 'Unknown card'}</strong></div>
          <div className="muted">Set: {aiResult.set_name || '-'} � No: {aiResult.card_number || '-'} � Rarity: {aiResult.rarity || '-'}</div>
          <div className="muted">AI confidence: {aiResult.confidence ?? '-'}%</div>
          {aiResult.alternatives?.length ? <div className="muted">Alternatives: {aiResult.alternatives.join(', ')}</div> : null}
          {aiResult.verifiedMatch ? <div className="muted">DB verify: ? {aiResult.verifiedMatch.name}</div> : <div className="muted">DB verify: not matched</div>}
        </div> : null}
      </div>
    </div>
  </Card>
}

function ToolPreview({ target }) {
  if (target === 'singles') return <SinglesTab />
  if (target === 'purchase') return <PurchaseTab />
  if (target === 'bags') return <BagBuilderTab />
  if (target === 'scanner') return <ScannerTab />
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

  return <main className="app"><header className="header"><div className="logo">R</div><div><div className="eyebrow">RNG Society</div><h1>Toolkit</h1></div><button className="btn theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '?? Light mode' : '?? Dark mode'}</button></header>
    <nav className="tabs tabs5">{tabs.map((t) => <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</nav>
    {tab === 'singles' && <SinglesTab />}
    {tab === 'purchase' && <PurchaseTab />}
    {tab === 'bags' && <BagBuilderTab />}
    {tab === 'scanner' && <ScannerTab />}
    {tab === 'lab' && <LabEnvironment onLaunchTool={setTab} />}
  </main>
}
