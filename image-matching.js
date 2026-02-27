const dbFolderInput = document.getElementById('dbFolder');
const buildDbBtn = document.getElementById('buildDbBtn');
const clearDbBtn = document.getElementById('clearDbBtn');
const dbStatus = document.getElementById('dbStatus');

const queryFileInput = document.getElementById('queryFile');
const matchBtn = document.getElementById('matchBtn');
const matchStatus = document.getElementById('matchStatus');
const resultsEl = document.getElementById('results');

const DB_KEY = 'rng_image_match_db_v1';
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
  const bitmap = await createImageBitmap(file);
  return bitmap;
}

function averageHashFromBitmap(bitmap, size = 8) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(bitmap, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const gray = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(Math.round((data[i] + data[i + 1] + data[i + 2]) / 3));
  }
  const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
  return gray.map((g) => (g >= avg ? '1' : '0')).join('');
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
      const hash = averageHashFromBitmap(bitmap);
      const previewUrl = URL.createObjectURL(file);
      nextDb.push({
        id: `${file.name}-${i}`,
        name: file.webkitRelativePath || file.name,
        hash,
        previewUrl,
      });
      dbStatus.textContent = `Building DB... ${i + 1}/${imageFiles.length}`;
    } catch (err) {
      console.warn('Failed to hash image', file.name, err);
    }
  }

  referenceDb = nextDb;
  saveDb();
  dbStatus.textContent = `DB ready. Indexed ${referenceDb.length} images.`;
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
    meta.innerHTML = `
      <div><strong>${match.name}</strong></div>
      <div class="score ${scoreClass(match.confidence)}">Confidence: ${match.confidence}% (distance ${match.distance})</div>
    `;

    div.appendChild(img);
    div.appendChild(meta);
    resultsEl.appendChild(div);
  }
}

async function runMatch(file) {
  if (!referenceDb.length) {
    matchStatus.textContent = 'Build the reference DB first.';
    return;
  }

  matchStatus.textContent = 'Matching...';
  const bitmap = await fileToImageBitmap(file);
  const queryHash = averageHashFromBitmap(bitmap);

  const matches = referenceDb
    .map((ref) => {
      const distance = hammingDistance(queryHash, ref.hash);
      return {
        ...ref,
        distance,
        confidence: confidenceFromDistance(distance),
      };
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
