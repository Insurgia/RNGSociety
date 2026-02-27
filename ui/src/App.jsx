import React, { useEffect, useMemo, useState } from 'react'

const currency = (n) => `$${Number(n || 0).toFixed(2)}`
const pct = (n) => `${Number(n || 0).toFixed(1)}%`
const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100
const ceilQuarter = (n) => Math.ceil(Number(n || 0) * 4) / 4

const LAB_SEED_TOOLS = [
  { id: 'singles-core', name: 'Singles Calculator', status: 'stable', category: 'Core', summary: 'Production calculator for single-card pricing.', tags: ['calculator', 'core'], testTarget: 'singles' },
  { id: 'purchase-core', name: 'Purchase Calculator', status: 'stable', category: 'Core', summary: 'Production lot-buying calculator.', tags: ['calculator', 'core'], testTarget: 'purchase' },
  { id: 'bags-core', name: 'Bag Builder', status: 'stable', category: 'Core', summary: 'Production bag tracking tool.', tags: ['core', 'workflow'], testTarget: 'bags' },
  { id: 'scanner-core', name: 'Scanner Core', status: 'wip', category: 'Scanner', summary: 'Card scan ingestion + normalization pipeline.', tags: ['ocr', 'pipeline', 'scanner'] },
  { id: 'scanner-lab', name: 'Scanner Lab', status: 'wip', category: 'Scanner', summary: 'Experimental scan models, confidence tuning, edge-case QA.', tags: ['experiments', 'qa', 'vision'] },
  { id: 'pricing-rules', name: 'Pricing Rules Sandbox', status: 'planned', category: 'Pricing', summary: 'Prototype pricing curves and fee logic before promotion.', tags: ['pricing', 'simulation'] },
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
    const buffer = Math.max(0, Number(bufferPct) || 0) / 100
    const perCardShip = round2(ship / cards)
    const hardCost = round2(card + freebie + perCardShip)
    const denominator = 1 - (commission + processing) / 100
    const breakEven = denominator > 0 ? (hardCost + fixed) / denominator : hardCost
    const recommended = ceilQuarter(breakEven * (1 + buffer))
    const commissionFee = recommended * (commission / 100)
    const processingFee = recommended * (processing / 100) + fixed
    const totalFees = commissionFee + processingFee
    const netEarnings = recommended - totalFees
    const profit = netEarnings - hardCost
    return { perCardShip, hardCost, breakEven: round2(breakEven), recommended: round2(recommended), commission, processing, fixed, commissionFee: round2(commissionFee), processingFee: round2(processingFee), totalFees: round2(totalFees), netEarnings: round2(netEarnings), profit: round2(profit) }
  }, [cardCost, freebieCost, shipFee, cardsPerOrder, commissionPct, processingPct, processingFixed, bufferPct])

  return <Card title="Singles Calculator" description="Pricing + fee-aware profitability for live selling.">
    <div className="grid three">
      <label>Card cost<input value={cardCost} onChange={(e) => setCardCost(e.target.value)} placeholder="0.00" /></label>
      <label>Freebie cost<input value={freebieCost} onChange={(e) => setFreebieCost(e.target.value)} placeholder="0.00" /></label>
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
  return String(text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split('-').map((x) => x.trim())
    if (parts.length >= 3) return { cardName: parts[0], qty: Number.parseInt(parts[1].replace(/[^0-9]/g, ''), 10) || 1, marketValue: Number(parts[2].replace(/[^0-9.]/g, '')) || 0 }
    const fallback = Number(line.match(/\$?([0-9]+(?:\.[0-9]+)?)/)?.[1] || 0)
    return { cardName: line, qty: 1, marketValue: fallback }
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
      const riskAdjustedNet = (market * multiplier) * (1 - (pf + pr)) * (1 - under)
      acc.market += market * qty
      acc.risk += riskAdjustedNet * qty
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
  const createBag = () => {
    if (!username.trim()) return
    const id = crypto.randomUUID()
    setBags((prev) => [{ id, bagId: `BAG-${String(prev.length + 1).padStart(5, '0')}`, username: username.trim(), platform, status: 'OPEN', items: [] }, ...prev])
    setActiveId(id)
  }
  const addItem = () => {
    if (!activeBag || !itemName.trim()) return
    const item = { id: crypto.randomUUID(), name: itemName.trim(), qty: Math.max(1, Number(qty) || 1), salePrice: Math.max(0, Number(salePrice) || 0) }
    setBags((prev) => prev.map((b) => b.id === activeBag.id ? { ...b, items: [...b.items, item] } : b))
    setItemName(''); setQty('1'); setSalePrice('0')
  }
  const totals = useMemo(() => activeBag ? activeBag.items.reduce((acc, i) => ({ items: acc.items + i.qty, value: acc.value + i.qty * i.salePrice }), { items: 0, value: 0 }) : { items: 0, value: 0 }, [activeBag])

  return <Card title="Bag Builder" description="Customer bag tracking."><div className="grid three"><label>Customer username<input value={username} onChange={(e) => setUsername(e.target.value)} /></label><label>Platform<input value={platform} onChange={(e) => setPlatform(e.target.value)} /></label><label style={{ alignSelf: 'end' }}><button className="btn" onClick={createBag}>Create bag</button></label></div>
    <div className="split" style={{ marginTop: 12 }}><div className="panel"><h3>Active bags</h3>{bags.length === 0 ? <p className="muted">No bags yet.</p> : bags.map((b) => <button key={b.id} className={`list-row ${b.id === activeId ? 'active' : ''}`} onClick={() => setActiveId(b.id)}><span>{b.bagId}</span><small>{b.username} · {b.items.length} items</small></button>)}</div>
      <div className="panel"><h3>{activeBag ? `${activeBag.bagId} · ${activeBag.username}` : 'Select a bag'}</h3>{activeBag ? <><div className="grid three"><label>Item<input value={itemName} onChange={(e) => setItemName(e.target.value)} /></label><label>Qty<input value={qty} onChange={(e) => setQty(e.target.value)} /></label><label>Sale price<input value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></label></div><button className="btn" style={{ marginTop: 10 }} onClick={addItem}>Add item</button><div className="kpi" style={{ marginTop: 12 }}><div className="pill"><span>Total qty</span><strong>{totals.items}</strong></div><div className="pill"><span>Total value</span><strong>{currency(totals.value)}</strong></div></div></> : <p className="muted">Create/select a bag to manage items.</p>}</div></div>
  </Card>
}

function ToolPreview({ target }) {
  if (target === 'singles') return <SinglesTab />
  if (target === 'purchase') return <PurchaseTab />
  if (target === 'bags') return <BagBuilderTab />
  return <Card title="Test Bench" description="No in-app preview mapped yet."><p className="muted">This module does not have a runnable preview yet.</p></Card>
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

  useEffect(() => {
    if (!activeToolId && filtered.length) setActiveToolId(filtered[0].id)
    if (activeToolId && !allTools.find((t) => t.id === activeToolId) && filtered.length) setActiveToolId(filtered[0].id)
  }, [filtered, allTools, activeToolId])

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

  return <Card title="RNG Lab" description="Integrated WIP environment for current and future tools.">
    <div className="lab-shell">
      <aside className="panel lab-sidebar">
        <div className="grid" style={{ gap: 8 }}><input placeholder="Search lab tools..." value={query} onChange={(e) => setQuery(e.target.value)} /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="planned">Planned</option><option value="wip">WIP</option><option value="review">Review</option><option value="stable">Stable</option></select></div>
        <div style={{ marginTop: 10 }}>{filtered.map((tool) => <button key={tool.id} className={`list-row ${activeToolId === tool.id ? 'active' : ''}`} onClick={() => setActiveToolId(tool.id)}><span>{tool.name}</span><small>{tool.category}</small></button>)}{filtered.length === 0 ? <p className="muted">No matching tools.</p> : null}</div>
      </aside>

      <section className="panel lab-main">
        {active ? <>
          <div className="lab-head"><h3>{active.name}</h3><span className={`status-pill ${active.status}`}>{active.status.toUpperCase()}</span></div>
          <p className="muted">{active.summary}</p>
          <div className="chip-row">{(active.tags || []).map((tag) => <span key={tag} className="chip">{tag}</span>)}</div>
          <div className="action-row">
            {active.status === 'planned' ? <button className="btn" onClick={() => setStatus(active.id, 'wip')}>Start WIP</button> : null}
            {active.status === 'wip' ? <button className="btn" onClick={() => setStatus(active.id, 'review')}>Send to Review</button> : null}
            {active.status === 'review' ? <button className="btn" onClick={() => setStatus(active.id, 'stable')}>Graduate to Production</button> : null}
            {active.testTarget ? <button className="btn" onClick={() => setBenchTarget(active.testTarget)}>Open Test View</button> : null}
            {active.testTarget ? <button className="btn" onClick={() => onLaunchTool(active.testTarget)}>Open Full App</button> : null}
          </div>
          <label style={{ marginTop: 10 }}>Lab notes / spec<textarea rows={6} value={note} onChange={(e) => persistNote(e.target.value)} placeholder="Use this as the persistent WIP notebook for this module." /></label>
        </> : <p className="muted">Select a lab tool.</p>}

        <div className="lab-create"><h4>Add future WIP tool</h4><div className="grid three"><label>Name<input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></label><label>Category<input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} /></label><label style={{ alignSelf: 'end' }}><button className="btn" onClick={addDraft}>Add to Lab</button></label></div><label style={{ marginTop: 8 }}>Summary<textarea rows={2} value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} /></label></div>

        <div className="lab-create"><h4>Production catalog ({stableTools.length})</h4><div className="chip-row">{stableTools.map((t) => <button key={t.id} className="btn btn-sm" onClick={() => t.testTarget && onLaunchTool(t.testTarget)}>{t.name}</button>)}</div></div>
      </section>
    </div>

    {benchTarget ? <div style={{ marginTop: 12 }}><Card title="Lab Test Bench" description="Run and validate tool behavior before/after promotion."><ToolPreview target={benchTarget} /></Card></div> : null}
  </Card>
}

export default function App() {
  const [tab, setTab] = useState('singles')
  const [theme, setTheme] = useState(() => localStorage.getItem('rng-theme') === 'light' ? 'light' : 'dark')
  useEffect(() => { document.documentElement.classList.toggle('light', theme === 'light'); localStorage.setItem('rng-theme', theme) }, [theme])
  const tabs = [{ id: 'singles', label: 'Singles' }, { id: 'purchase', label: 'Purchase' }, { id: 'bags', label: 'Bags' }, { id: 'lab', label: 'Lab' }]

  return <main className="app"><header className="header"><div className="logo">R</div><div><div className="eyebrow">RNG Society</div><h1>Toolkit</h1></div><button className="btn theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '?? Light mode' : '?? Dark mode'}</button></header>
    <nav className="tabs tabs4">{tabs.map((t) => <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</nav>
    {tab === 'singles' && <SinglesTab />}
    {tab === 'purchase' && <PurchaseTab />}
    {tab === 'bags' && <BagBuilderTab />}
    {tab === 'lab' && <LabEnvironment onLaunchTool={setTab} />}
  </main>
}
