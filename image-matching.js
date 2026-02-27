const dbFolderInput = document.getElementById('dbFolder');
const buildDbBtn = document.getElementById('buildDbBtn');
const loadPokemonDbBtn = document.getElementById('loadPokemonDbBtn');
const clearDbBtn = document.getElementById('clearDbBtn');
const dbStatus = document.getElementById('dbStatus');

const queryFileInput = document.getElementById('queryFile');
const matchBtn = document.getElementById('matchBtn');
const matchStatus = document.getElementById('matchStatus');
const resultsEl = document.getElementById('results');
const debugStagesEl = document.getElementById('debugStages');

const DB_KEY = 'rng_image_match_db_v3';
let referenceDb = [];

function saveDb() {
  localStorage.setItem(DB_KEY, JSON.stringify(referenceDb));
}

function loadDb() {
  try {
    referenceDb = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  } catch {
    referenceDb = [];
  }
  dbStatus.textContent = `Reference images in DB: ${referenceDb.length}`;
}

function clearDb() {
  referenceDb = [];
  localStorage.removeItem(DB_KEY);
  dbStatus.textContent = 'Reference DB cleared.';
}

function hammingDistance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

function confidenceFromDistance(distance, bits = 64) {
  const ratio = Math.max(0, 1 - distance / bits);
  return Math.round(ratio * 100);
}

async function fileToImageBitmap(file) {
  return createImageBitmap(file);
}

async function urlToImageBitmap(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

function bitmapToCanvas(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

function detectCardCropRect(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;
  const { data } = ctx.getImageData(0, 0, w, h);

  const step = Math.max(2, Math.floor(Math.min(w, h) / 300));
  const edgePts = [];
  const threshold = 55;

  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const i = (y * w + x) * 4;
      const il = (y * w + (x - step)) * 4;
      const ir = (y * w + (x + step)) * 4;
      const iu = ((y - step) * w + x) * 4;
      const id = ((y + step) * w + x) * 4;

      const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const gl = (data[il] + data[il + 1] + data[il + 2]) / 3;
      const gr = (data[ir] + data[ir + 1] + data[ir + 2]) / 3;
      const gu = (data[iu] + data[iu + 1] + data[iu + 2]) / 3;
      const gd = (data[id] + data[id + 1] + data[id + 2]) / 3;

      const gx = Math.abs(gr - gl);
      const gy = Math.abs(gd - gu);
      const mag = gx + gy + Math.abs(g - (gl + gr + gu + gd) / 4);
      if (mag >= threshold) edgePts.push({ x, y });
    }
  }

  if (edgePts.length < 200) {
    // fallback to center crop with card-ish ratio
    const ratio = 0.715; // pokemon card width/height
    let cw = Math.floor(w * 0.78);
    let ch = Math.floor(cw / ratio);
    if (ch > h * 0.9) {
      ch = Math.floor(h * 0.9);
      cw = Math.floor(ch * ratio);
    }
    return { x: Math.floor((w - cw) / 2), y: Math.floor((h - ch) / 2), w: cw, h: ch };
  }

  const xs = edgePts.map((p) => p.x).sort((a, b) => a - b);
  const ys = edgePts.map((p) => p.y).sort((a, b) => a - b);

  const q = (arr, pct) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(arr.length * pct)))];
  let x1 = q(xs, 0.08);
  let x2 = q(xs, 0.92);
  let y1 = q(ys, 0.08);
  let y2 = q(ys, 0.92);

  // normalize to card ratio
  const targetRatio = 0.715;
  let cw = Math.max(20, x2 - x1);
  let ch = Math.max(20, y2 - y1);
  const cx = Math.floor((x1 + x2) / 2);
  const cy = Math.floor((y1 + y2) / 2);
  const ratio = cw / ch;

  if (ratio > targetRatio) cw = Math.floor(ch * targetRatio);
  else ch = Math.floor(cw / targetRatio);

  x1 = Math.max(0, Math.floor(cx - cw / 2));
  y1 = Math.max(0, Math.floor(cy - ch / 2));
  if (x1 + cw > w) x1 = w - cw;
  if (y1 + ch > h) y1 = h - ch;

  return { x: x1, y: y1, w: cw, h: ch };
}

function averageHashFromCanvas(canvas, size = 8) {
  const hashCanvas = document.createElement('canvas');
  const ctx = hashCanvas.getContext('2d', { willReadFrequently: true });
  hashCanvas.width = size;
  hashCanvas.height = size;
  ctx.drawImage(canvas, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const gray = [];
  for (let i = 0; i < data.length; i += 4) gray.push(Math.round((data[i] + data[i + 1] + data[i + 2]) / 3));
  const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
  return gray.map((g) => (g >= avg ? '1' : '0')).join('');
}

function renderCanvasThumb(canvas, label) {
  if (!debugStagesEl) return;
  const wrap = document.createElement('div');
  wrap.style.background = '#0b1220';
  wrap.style.border = '1px solid #334155';
  wrap.style.borderRadius = '8px';
  wrap.style.padding = '8px';

  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/jpeg', 0.85);
  img.style.width = '100%';
  img.style.borderRadius = '6px';

  const caption = document.createElement('div');
  caption.textContent = label;
  caption.className = 'muted';
  caption.style.marginTop = '6px';

  wrap.appendChild(img);
  wrap.appendChild(caption);
  debugStagesEl.appendChild(wrap);
}

function clearDebugStages() {
  if (debugStagesEl) debugStagesEl.innerHTML = '';
}

function computeMultiHashesFromBitmap(bitmap, debug = false) {
  const full = bitmapToCanvas(bitmap);
  const cropRect = detectCardCropRect(full);

  const crop = document.createElement('canvas');
  crop.width = cropRect.w;
  crop.height = cropRect.h;
  const cropCtx = crop.getContext('2d', { willReadFrequently: true });
  cropCtx.drawImage(full, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h);

  // central tighter crop for robustness
  const inner = document.createElement('canvas');
  const iw = Math.floor(crop.width * 0.82);
  const ih = Math.floor(crop.height * 0.82);
  inner.width = iw;
  inner.height = ih;
  const ix = Math.floor((crop.width - iw) / 2);
  const iy = Math.floor((crop.height - ih) / 2);
  inner.getContext('2d', { willReadFrequently: true }).drawImage(crop, ix, iy, iw, ih, 0, 0, iw, ih);

  const hashPreview = document.createElement('canvas');
  hashPreview.width = 64;
  hashPreview.height = 64;
  const hctx = hashPreview.getContext('2d', { willReadFrequently: true });
  hctx.imageSmoothingEnabled = false;
  hctx.drawImage(inner, 0, 0, 8, 8, 0, 0, 64, 64);

  if (debug) {
    clearDebugStages();
    renderCanvasThumb(full, '1) Original');
    renderCanvasThumb(crop, '2) Detected card crop');
    renderCanvasThumb(inner, '3) Inner crop');
    renderCanvasThumb(hashPreview, '4) 8x8 hash preview');
  }

  return {
    fullHash: averageHashFromCanvas(full),
    cropHash: averageHashFromCanvas(crop),
    innerHash: averageHashFromCanvas(inner),
  };
}

function blendedDistance(query, ref) {
  const d1 = hammingDistance(query.fullHash, ref.fullHash || ref.hash || query.fullHash);
  const d2 = hammingDistance(query.cropHash, ref.cropHash || ref.hash || query.cropHash);
  const d3 = hammingDistance(query.innerHash, ref.innerHash || ref.cropHash || ref.hash || query.innerHash);
  return Math.round(d1 * 0.2 + d2 * 0.5 + d3 * 0.3);
}

async function buildReferenceDb(files) {
  const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (!imageFiles.length) {
    dbStatus.textContent = 'No image files detected in selected folder.';
    return;
  }

  dbStatus.textContent = `Building DB from ${imageFiles.length} images...`;
  const nextDb = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    try {
      const bitmap = await fileToImageBitmap(file);
      const hashes = computeMultiHashesFromBitmap(bitmap);
      const previewUrl = URL.createObjectURL(file);
      nextDb.push({ id: `${file.name}-${i}`, name: file.webkitRelativePath || file.name, previewUrl, ...hashes });
      dbStatus.textContent = `Building DB... ${i + 1}/${imageFiles.length}`;
    } catch (err) {
      console.warn('Failed to hash image', file.name, err);
    }
  }

  referenceDb = nextDb;
  saveDb();
  dbStatus.textContent = `DB ready. Indexed ${referenceDb.length} images.`;
}

async function buildFromPokemonManifest() {
  dbStatus.textContent = 'Loading Pokemon manifest...';
  const res = await fetch('./data/pokemon/cards.json');
  if (!res.ok) {
    dbStatus.textContent = 'Could not load ./data/pokemon/cards.json';
    return;
  }

  const cards = await res.json();
  dbStatus.textContent = `Hashing ${cards.length} Pokemon card images... (phase 2 crop-aware hashing)`;
  const nextDb = [];

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const localSrc = c.localImage ? `./data/pokemon/${c.localImage}` : '';
    const remoteSrc = c.imageUrl || '';
    const candidates = [localSrc, remoteSrc].filter(Boolean);

    let bitmap = null;
    let usedSrc = '';
    for (const src of candidates) {
      try {
        bitmap = await urlToImageBitmap(src);
        usedSrc = src;
        break;
      } catch {}
    }

    if (bitmap) {
      const hashes = computeMultiHashesFromBitmap(bitmap);
      nextDb.push({
        id: c.id,
        name: `${c.name} (${c.setName} #${c.number})`,
        previewUrl: usedSrc,
        meta: c,
        ...hashes,
      });
    }

    if ((i + 1) % 100 === 0) dbStatus.textContent = `Hashing Pokemon images... ${i + 1}/${cards.length}`;
  }

  referenceDb = nextDb;
  saveDb();
  dbStatus.textContent = `Pokemon DB ready (phase 2). Indexed ${referenceDb.length} images.`;
}

function scoreClass(confidence) {
  if (confidence >= 85) return 'ok';
  if (confidence >= 65) return 'warn';
  return 'danger';
}

function renderResults(matches) {
  resultsEl.innerHTML = '';
  if (!matches.length) {
    resultsEl.innerHTML = '<p class="muted">No matches found.</p>';
    return;
  }

  for (const match of matches) {
    const div = document.createElement('div');
    div.className = 'result';

    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = match.previewUrl;
    img.alt = match.name;

    const meta = document.createElement('div');
    meta.innerHTML = `<div><strong>${match.name}</strong></div><div class="score ${scoreClass(match.confidence)}">Confidence: ${match.confidence}% (distance ${match.distance})</div>`;

    div.appendChild(img);
    div.appendChild(meta);
    resultsEl.appendChild(div);
  }
}

async function runMatch(file) {
  if (!referenceDb.length) {
    matchStatus.textContent = 'Build or load a reference DB first.';
    return;
  }

  matchStatus.textContent = 'Matching (phase 2 crop-aware)...';
  const bitmap = await fileToImageBitmap(file);
  const query = computeMultiHashesFromBitmap(bitmap, true);

  const matches = referenceDb
    .map((ref) => {
      const distance = blendedDistance(query, ref);
      return { ...ref, distance, confidence: confidenceFromDistance(distance) };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);

  renderResults(matches);
  matchStatus.textContent = `Done. Showing top ${matches.length} matches.`;
}

buildDbBtn.addEventListener('click', async () => {
  if (!dbFolderInput.files?.length) {
    dbStatus.textContent = 'Pick a folder first.';
    return;
  }
  await buildReferenceDb(dbFolderInput.files);
});

loadPokemonDbBtn?.addEventListener('click', async () => {
  await buildFromPokemonManifest();
});

clearDbBtn.addEventListener('click', clearDb);

matchBtn.addEventListener('click', async () => {
  const file = queryFileInput.files?.[0];
  if (!file) {
    matchStatus.textContent = 'Pick a query image first.';
    return;
  }
  await runMatch(file);
});

loadDb();

