import fs from 'node:fs/promises'
import path from 'node:path'

const owner = 'PokemonTCG'
const repo = 'pokemon-tcg-data'
const branch = 'master'

const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
const treeRes = await fetch(treeUrl, { headers: { 'User-Agent': 'RNGSociety-Catalog-Builder' } })
if (!treeRes.ok) throw new Error(`Tree fetch failed: ${treeRes.status}`)
const treeJson = await treeRes.json()

const cardFiles = (treeJson.tree || [])
  .filter((n) => n.path?.startsWith('cards/') && n.path.endsWith('.json'))

console.log(`Found ${cardFiles.length} card set files`)

const catalog = []
for (let i = 0; i < cardFiles.length; i++) {
  const f = cardFiles[i]
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${f.path}`
  try {
    const res = await fetch(rawUrl)
    if (!res.ok) continue
    const arr = await res.json()
    if (Array.isArray(arr)) {
      for (const c of arr) {
        const number = (c.number || '').toString().trim()
        const printedTotal = c.set?.printedTotal ? String(c.set.printedTotal) : ''
        const numNorm = number.includes('/') ? number : (number && printedTotal ? `${number}/${printedTotal}` : number)
        catalog.push({
          id: c.id,
          name: c.name || '',
          number: numNorm || '',
          rawNumber: number || '',
          setId: c.set?.id || '',
          setName: c.set?.name || '',
          language: f.path.includes('/jp/') ? 'Japanese' : 'English',
        })
      }
    }
  } catch {}
  if ((i + 1) % 25 === 0) console.log(`Processed ${i + 1}/${cardFiles.length}`)
}

const outDir = 'D:/Software/RNGSociety/ui/public'
await fs.mkdir(outDir, { recursive: true })
const outPath = path.join(outDir, 'pokemon-catalog.json')
await fs.writeFile(outPath, JSON.stringify(catalog))
console.log(`Wrote ${catalog.length} cards -> ${outPath}`)
