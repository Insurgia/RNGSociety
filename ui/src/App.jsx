import React, { useMemo, useState } from 'react'

function SinglesTab() {
  const [cardCost, setCardCost] = useState('')
  const [freebieCost, setFreebieCost] = useState('')
  const [feePct, setFeePct] = useState('12.9')

  const profit = useMemo(() => {
    const c = Number(cardCost) || 0
    const f = Number(freebieCost) || 0
    const fee = Number(feePct) || 0
    const gross = c + f
    return gross - gross * (fee / 100)
  }, [cardCost, freebieCost, feePct])

  return (
    <section className="card">
      <h2>Singles Calculator</h2>
      <div className="grid two" style={{marginTop:10}}>
        <label>Card Cost<input value={cardCost} onChange={(e)=>setCardCost(e.target.value)} /></label>
        <label>Freebie Cost<input value={freebieCost} onChange={(e)=>setFreebieCost(e.target.value)} /></label>
        <label>Fees (%)<input value={feePct} onChange={(e)=>setFeePct(e.target.value)} /></label>
      </div>
      <div className="kpi">
        <div className="pill"><strong>Estimated Net</strong><div>${profit.toFixed(2)}</div></div>
      </div>
    </section>
  )
}

function PurchaseTab(){
  return <section className="card"><h2>Purchase Calculator</h2><p style={{color:'#94a3b8'}}>Clean rebuild in progress. Existing logic will be ported next.</p></section>
}
function BagsTab(){
  return <section className="card"><h2>Bag Builder</h2><p style={{color:'#94a3b8'}}>Clean rebuild in progress. Existing logic will be ported next.</p></section>
}
function ScannerTab(){
  return <section className="card"><h2>Scanner Lab</h2><p style={{color:'#94a3b8'}}>Integrated directly as an app tab.</p><iframe className="scanner-frame" src="/image-matching.html" title="Scanner Lab" /></section>
}

export default function App(){
  const [tab, setTab] = useState('scanner')
  return (
    <main className="app">
      <header className="header">
        <div className="logo">R</div>
        <div><div style={{fontSize:12,color:'#94a3b8'}}>RNG Society</div><h1 style={{margin:'2px 0 0',fontSize:20}}>Toolkit</h1></div>
      </header>
      <nav className="tabs">
        {['singles','purchase','bags','scanner'].map((t)=><button key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}
      </nav>
      {tab==='singles' && <SinglesTab/>}
      {tab==='purchase' && <PurchaseTab/>}
      {tab==='bags' && <BagsTab/>}
      {tab==='scanner' && <ScannerTab/>}
    </main>
  )
}
