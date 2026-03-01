export async function onRequestPost(context) {
  try {
    const rapidApiKey = context.env.RAPIDAPI_KEY
    if (!rapidApiKey) {
      return new Response(JSON.stringify({ ok: false, error: 'RAPIDAPI_KEY not configured' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    const body = await context.request.json().catch(() => ({}))
    const cardName = String(body?.cardName || '').trim()
    const cardNum = String(body?.cardNum || '').trim()
    const setName = String(body?.setName || '').trim().toLowerCase()

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

    const sanitizeName = (n) => String(n || '').replace(/\s+/g, ' ').trim()
    const baseName = sanitizeName(cardName)
    const strippedName = sanitizeName(baseName.replace(/\b(ex|vmax|vstar|gx|lv\.?x|radiant)\b/gi, ''))
    const firstToken = sanitizeName(baseName.split(' ')[0] || '')

    const variants = [
      { name: baseName, number: cardNum },
      { name: baseName, number: '' },
      { name: strippedName, number: cardNum },
      { name: strippedName, number: '' },
      { name: firstToken, number: cardNum },
      { name: firstToken, number: '' },
    ].filter((v, i, arr) => v.name && arr.findIndex((x) => x.name === v.name && x.number === v.number) === i)

    let cards = []
    for (const v of variants) {
      cards = await fetchSearch(v.name, v.number)
      if (cards.length) break
    }

    if (!cards.length) throw new Error(`No cards returned from Cardmarket search (name=${baseName || 'n/a'}, number=${cardNum || 'n/a'})`)

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

    const data = {
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

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
}
