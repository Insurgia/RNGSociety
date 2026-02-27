#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  const next = args[idx + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
};

const repoRoot = path.resolve(getArg('--repoRoot', '.'));
const outDir = path.resolve(repoRoot, getArg('--outDir', 'data/pokemon'));
const cloneDir = path.resolve(repoRoot, getArg('--cloneDir', 'tmp-pokemon-tcg-data'));
const downloadImages = getArg('--download-images', 'false') === 'true';
const imageType = getArg('--imageType', 'small'); // small | large
const maxCards = Number(getArg('--maxCards', 0)); // 0 = all

function sh(cmd) {
  execSync(cmd, { stdio: 'inherit' });
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

function toCsvValue(v) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function downloadImage(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

async function loadAllCardsFromSetFiles(cardsEnDir) {
  const files = (await fs.readdir(cardsEnDir)).filter((f) => f.endsWith('.json'));
  const cards = [];
  for (const f of files) {
    const full = path.join(cardsEnDir, f);
    const raw = await fs.readFile(full, 'utf8');
    const arr = JSON.parse(raw);
    for (const c of arr) cards.push(c);
  }
  return cards;
}

async function main() {
  console.log('Preparing Pokémon card source repo...');
  if (!(await fs.stat(cloneDir).then(() => true).catch(() => false))) {
    sh(`git clone --depth 1 https://github.com/PokemonTCG/pokemon-tcg-data.git "${cloneDir}"`);
  } else {
    sh(`git -C "${cloneDir}" pull --ff-only`);
  }

  const cardsEnDir = path.join(cloneDir, 'cards', 'en');
  const allCards = await loadAllCardsFromSetFiles(cardsEnDir);
  const cardsInput = maxCards > 0 ? allCards.slice(0, maxCards) : allCards;

  await ensureDir(outDir);
  const imagesDir = path.join(outDir, 'images');
  if (downloadImages) await ensureDir(imagesDir);

  const cards = [];
  for (let i = 0; i < cardsInput.length; i++) {
    const c = cardsInput[i];
    const imageUrl = c.images?.[imageType] || c.images?.small || c.images?.large || '';
    const card = {
      id: c.id,
      name: c.name,
      setId: c.set?.id || '',
      setName: c.set?.name || '',
      number: c.number || '',
      rarity: c.rarity || '',
      supertype: c.supertype || '',
      subtypes: (c.subtypes || []).join('|'),
      hp: c.hp || '',
      artist: c.artist || '',
      imageUrl,
      localImage: downloadImages ? `images/${c.id}.jpg` : '',
    };
    cards.push(card);

    if (downloadImages && imageUrl) {
      const out = path.join(imagesDir, `${c.id}.jpg`);
      try {
        await downloadImage(imageUrl, out);
      } catch (err) {
        console.warn(`Failed image ${c.id}: ${err.message}`);
      }
    }

    if ((i + 1) % 500 === 0) console.log(`Processed ${i + 1}/${cardsInput.length}`);
  }

  await fs.writeFile(path.join(outDir, 'cards.json'), JSON.stringify(cards, null, 2));
  const headers = ['id', 'name', 'setId', 'setName', 'number', 'rarity', 'supertype', 'subtypes', 'hp', 'artist', 'imageUrl', 'localImage'];
  const csv = [headers.join(',')]
    .concat(cards.map((c) => headers.map((h) => toCsvValue(c[h])).join(',')))
    .join('\n');
  await fs.writeFile(path.join(outDir, 'cards.csv'), csv);

  await fs.writeFile(path.join(outDir, 'README.md'), [
    '# Pokemon DB (auto-generated from pokemon-tcg-data)',
    '',
    `Cards: ${cards.length}`,
    `Images downloaded: ${downloadImages}`,
    '',
    'Regenerate examples:',
    '```bash',
    'node scripts/build-pokemon-db.mjs --repoRoot D:/Software/RNGSociety --maxCards 2000',
    'node scripts/build-pokemon-db.mjs --repoRoot D:/Software/RNGSociety --download-images true --maxCards 2000',
    '```',
  ].join('\n'));

  console.log(`Done. Wrote ${cards.length} cards to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
