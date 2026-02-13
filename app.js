(() => {
  'use strict';

  const Core = window.BagBuilderCore;
  const PurchaseCore = window.PurchaseCalculatorCore;

  const SINGLES_STORE_KEY = 'rngsociety-profit-calc-v3';
  const BAG_STORE_KEY = 'rngsociety-bag-builder-db-v1';
  const AUTH_STORE_KEY = 'rngsociety-auth-v1';
  const PURCHASE_STORE_KEY = 'rngsociety-purchase-calc-v1';

  const el = {
    toast: document.getElementById('toast'),
    authPanel: document.getElementById('authPanel'),
    moduleButtons: Array.from(document.querySelectorAll('.module-btn')),
    singlesModule: document.getElementById('singlesModule'),
    bagBuilderModule: document.getElementById('bagBuilderModule'),
    purchaseModule: document.getElementById('purchaseModule'),
    purchaseRoot: document.getElementById('purchaseCalculatorRoot'),

    cardCost: document.getElementById('cardCost'), freebieCost: document.getElementById('freebieCost'), shipFee: document.getElementById('shipFee'), cardsPerOrder: document.getElementById('cardsPerOrder'),
    commissionPct: document.getElementById('commissionPct'), processingPct: document.getElementById('processingPct'), processingFixed: document.getElementById('processingFixed'),
    perCardShip: document.getElementById('perCardShip'), breakEvenVal: document.getElementById('breakEvenVal'), recommendedVal: document.getElementById('recommendedVal'),
    recommendedHint: document.getElementById('recommendedHint'), profitVal: document.getElementById('profitVal'), profitCard: document.getElementById('profitCard'),
    breakdownToggle: document.getElementById('breakdownToggle'), breakdownPanel: document.getElementById('breakdownPanel'), breakdownInner: document.getElementById('breakdownInner'),
    copyBtn: document.getElementById('copyBtn'), resetBtn: document.getElementById('resetBtn'), buffers: Array.from(document.querySelectorAll('.buffer')),

    bagUpsell: document.getElementById('bagUpsell'), bagAppShell: document.getElementById('bagAppShell'),
    bagDashboard: document.getElementById('bagDashboard'), bagDetail: document.getElementById('bagDetail'), bagCustomers: document.getElementById('bagCustomers'), bagSettings: document.getElementById('bagSettings'), bagAdmin: document.getElementById('bagAdmin'),
    bagViewButtons: Array.from(document.querySelectorAll('.sub-btn')), adminTabBtn: document.getElementById('adminTabBtn')
  };

  let toastTimer = null;
  let selectedBuffer = 0.1;
  let lastRecommendedCents = null;

  let bagDb = loadBagDb();
  let authDb = loadAuthDb();
  let bagState = { currentBagId: null, bagView: 'dashboard', dashboardFilter: 'ACTIVE', dashboardQuery: '', sortBy: 'lastActivityAt' };
  let purchaseState = loadPurchaseState();

  const currentUser = () => authDb.users.find((u) => u.id === authDb.sessionUserId) || null;
  const isLoggedIn = () => !!currentUser();
  const isAdmin = () => currentUser()?.role === 'admin';
  const hasProAccess = () => { const u = currentUser(); return !!u && (u.role === 'admin' || u.isPro); };

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1600);
  }

  // auth
  function loadAuthDb() {
    const raw = localStorage.getItem(AUTH_STORE_KEY);
    if (!raw) return Core.createDefaultAuthDb();
    try { return Core.migrateAuthDb(JSON.parse(raw)); } catch (_) { return Core.createDefaultAuthDb(); }
  }
  function saveAuthDb() { localStorage.setItem(AUTH_STORE_KEY, JSON.stringify(authDb)); }

  function renderAuthPanel() {
    const user = currentUser();
    if (!user) {
      el.authPanel.innerHTML = `<div class="auth-row"><div><h2>Login</h2><p>Default admin: <strong>admin / admin123</strong></p><form id="loginForm" class="auth-form"><input id="loginUser" placeholder="Username" required /><input id="loginPass" placeholder="Password" type="password" required /><button class="btn primary" type="submit">Sign In</button></form></div></div>`;
      document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUser').value.trim().toLowerCase();
        const password = document.getElementById('loginPass').value;
        const found = authDb.users.find((u) => u.username.toLowerCase() === username && u.enabled);
        if (!Core.verifyPassword(found, password)) { showToast('Invalid login'); return; }
        authDb.sessionUserId = found.id;
        saveAuthDb();
        renderAuthPanel();
        renderBagBuilder();
        showToast(`Welcome ${found.username}`);
      });
    } else {
      el.authPanel.innerHTML = `<div class="auth-row"><div><h2>Logged In</h2><p class="user-chip">${user.username} • ${user.role.toUpperCase()} ${user.isPro ? '• PRO' : ''}</p></div><div class="auth-form"><button id="logoutBtn" class="btn secondary">Logout</button></div></div>`;
      document.getElementById('logoutBtn').addEventListener('click', () => {
        authDb.sessionUserId = null;
        saveAuthDb();
        renderAuthPanel();
        switchModule('singles');
        renderBagBuilder();
      });
    }
  }

  // singles
  const toCents = (n) => Math.round(n * 100);
  const money = (cents, sign = false) => `${cents < 0 ? '-' : sign && cents > 0 ? '+' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`;
  const numberOr = (input, fallback = NaN) => { const v = Number.parseFloat(input.value); return Number.isFinite(v) && v >= 0 ? v : fallback; };
  const intOr = (input, fallback = NaN) => { const v = Number.parseInt(input.value, 10); return Number.isInteger(v) && v > 0 ? v : fallback; };

  function getPerCardShipping() {
    const cents = Math.round((numberOr(el.shipFee, 2) / intOr(el.cardsPerOrder, 5)) * 100);
    el.perCardShip.textContent = `Shipping / Card: ${money(cents)}`;
    return cents;
  }
  function saleBreakdown(saleCents, costsCents, commPct, procPct, procFixedCents, shippingCents) {
    const commissionCents = Math.round((saleCents * commPct) / 100);
    const processingCents = Math.round((saleCents * procPct) / 100) + procFixedCents;
    const totalFeesCents = commissionCents + processingCents + shippingCents;
    const earningsCents = saleCents - totalFeesCents;
    return { commissionCents, processingCents, shippingCents, totalFeesCents, earningsCents, netProfitCents: earningsCents - costsCents };
  }
  function findBreakEven(costsCents, commPct, procPct, procFixedCents, shippingCents) {
    for (let sale = 1; sale <= 200000; sale += 1) if (saleBreakdown(sale, costsCents, commPct, procPct, procFixedCents, shippingCents).netProfitCents >= 0) return sale;
    return null;
  }
  function renderSinglesBreakdown(saleCents, costsCents, commPct, procPct, procFixedCents, shippingCents) {
    const d = saleBreakdown(saleCents, costsCents, commPct, procPct, procFixedCents, shippingCents);
    el.breakdownInner.innerHTML = `<p class="row"><span>Sale price</span><strong class="revenue">${money(saleCents)}</strong></p><p class="row"><span>Card + freebies cost</span><strong class="cost">-${money(costsCents)}</strong></p><p class="row"><span>Commission</span><strong class="cost">-${money(d.commissionCents)}</strong></p><p class="row"><span>Processing</span><strong class="cost">-${money(d.processingCents)}</strong></p><p class="row"><span>Shipping per card</span><strong class="cost">-${money(d.shippingCents)}</strong></p><p class="row"><span>Total fees</span><strong class="cost">-${money(d.totalFeesCents)}</strong></p><p class="row"><span>Net earnings</span><strong class="revenue">${money(d.earningsCents)}</strong></p><p class="row total"><span>Net profit</span><strong class="${d.netProfitCents >= 0 ? 'profit-pos' : 'profit-neg'}">${money(d.netProfitCents, true)}</strong></p>`;
  }
  function saveSingles() { localStorage.setItem(SINGLES_STORE_KEY, JSON.stringify({ cardCost: el.cardCost.value, freebieCost: el.freebieCost.value, shipFee: el.shipFee.value, cardsPerOrder: el.cardsPerOrder.value, commissionPct: el.commissionPct.value, processingPct: el.processingPct.value, processingFixed: el.processingFixed.value, selectedBuffer })); }
  function restoreSingles() {
    const raw = localStorage.getItem(SINGLES_STORE_KEY); if (!raw) return;
    try {
      const s = JSON.parse(raw);
      el.cardCost.value = s.cardCost ?? ''; el.freebieCost.value = s.freebieCost ?? ''; el.shipFee.value = s.shipFee ?? '2.00'; el.cardsPerOrder.value = s.cardsPerOrder ?? '5';
      el.commissionPct.value = s.commissionPct ?? '8'; el.processingPct.value = s.processingPct ?? '2.9'; el.processingFixed.value = s.processingFixed ?? '0.30';
      selectedBuffer = typeof s.selectedBuffer === 'number' ? s.selectedBuffer : 0.1;
      el.buffers.forEach((b) => b.classList.toggle('active', Number.parseFloat(b.dataset.buffer) === selectedBuffer));
    } catch (_) {}
  }
  function renderSinglesEmpty() {
    lastRecommendedCents = null;
    el.breakEvenVal.textContent = '—'; el.recommendedVal.textContent = '—'; el.recommendedHint.textContent = 'Enter card cost'; el.profitVal.textContent = '—'; el.copyBtn.disabled = true; el.profitCard.classList.remove('negative');
    el.breakdownInner.innerHTML = '<p class="row">Enter card cost to see detailed breakdown.</p>';
  }
  function calculateSingles() {
    const cardCost = numberOr(el.cardCost), freebie = numberOr(el.freebieCost, 0), commPct = numberOr(el.commissionPct, 8), procPct = numberOr(el.processingPct, 2.9), procFixedCents = toCents(numberOr(el.processingFixed, 0.3)), shipCents = getPerCardShipping();
    if (!Number.isFinite(cardCost)) { renderSinglesEmpty(); saveSingles(); return; }
    const costsCents = toCents(cardCost + freebie); const breakEven = findBreakEven(costsCents, commPct, procPct, procFixedCents, shipCents);
    if (!breakEven) { renderSinglesEmpty(); return; }
    const rec = Math.ceil(Math.ceil(breakEven * (1 + selectedBuffer)) / 25) * 25; const detail = saleBreakdown(rec, costsCents, commPct, procPct, procFixedCents, shipCents);
    lastRecommendedCents = rec;
    el.breakEvenVal.textContent = money(breakEven); el.recommendedVal.textContent = money(rec); el.recommendedHint.textContent = `With ${Math.round(selectedBuffer * 100)}% buffer`; el.profitVal.textContent = money(detail.netProfitCents, true); el.profitCard.classList.toggle('negative', detail.netProfitCents < 0); el.copyBtn.disabled = false;
    renderSinglesBreakdown(rec, costsCents, commPct, procPct, procFixedCents, shipCents); saveSingles();
  }
  function wireSingles() {
    restoreSingles();
    el.buffers.forEach((b) => b.addEventListener('click', () => { el.buffers.forEach((x) => x.classList.remove('active')); b.classList.add('active'); selectedBuffer = Number.parseFloat(b.dataset.buffer || '0.1'); calculateSingles(); }));
    [el.cardCost, el.freebieCost, el.shipFee, el.cardsPerOrder, el.commissionPct, el.processingPct, el.processingFixed].forEach((i) => i.addEventListener('input', calculateSingles));
    el.breakdownToggle.addEventListener('click', () => { const open = el.breakdownToggle.getAttribute('aria-expanded') === 'true'; el.breakdownToggle.setAttribute('aria-expanded', String(!open)); el.breakdownPanel.classList.toggle('open', !open); });
    el.copyBtn.addEventListener('click', async () => { if (lastRecommendedCents == null) return; await navigator.clipboard.writeText(`Start at ${money(lastRecommendedCents)} (RNG Singles Calc)`); el.copyBtn.classList.add('copied'); showToast('Copied'); setTimeout(() => el.copyBtn.classList.remove('copied'), 450); });
    el.resetBtn.addEventListener('click', () => { el.cardCost.value = ''; el.freebieCost.value = ''; el.shipFee.value = '2.00'; el.cardsPerOrder.value = '5'; el.commissionPct.value = '8.0'; el.processingPct.value = '2.9'; el.processingFixed.value = '0.30'; selectedBuffer = 0.1; el.buffers.forEach((b) => b.classList.toggle('active', Number.parseFloat(b.dataset.buffer) === selectedBuffer)); localStorage.removeItem(SINGLES_STORE_KEY); calculateSingles(); });
    calculateSingles();
  }

  // purchase calculator
  function loadPurchaseState() {
    const raw = localStorage.getItem(PURCHASE_STORE_KEY);
    const base = { settings: PurchaseCore.defaultPurchaseSettings, rows: [], offerPrice: 0, collectionName: 'Untitled Collection', history: [] };
    if (!raw) return base;
    try {
      const parsed = JSON.parse(raw);
      return { ...base, ...parsed, settings: PurchaseCore.normalizeSettings(parsed.settings) };
    } catch (_) {
      return base;
    }
  }
  function savePurchaseState() { localStorage.setItem(PURCHASE_STORE_KEY, JSON.stringify(purchaseState)); }
  function validateRows(rows) { return rows.filter((r) => String(r.cardName || '').trim() && (Number.parseInt(r.qty,10) || 0) >= 1 && (Number(r.marketValue) || 0) >= 0); }

  function renderPurchaseCalculator() {
    const settings = PurchaseCore.normalizeSettings(purchaseState.settings);
    if (settings.fairDealMode) settings.targetProfitPercent = Math.max(settings.targetProfitPercent, 20);
    const cleanRows = validateRows(purchaseState.rows);
    const result = PurchaseCore.aggregateResults(cleanRows, settings);
    const scenario = PurchaseCore.scenarioRange(result.totals);
    const offerPrice = Number(purchaseState.offerPrice || 0);
    const offerPnL = result.recommendedMaxOffer - offerPrice;
    const impliedPctMarket = result.totals.totalMarket > 0 ? (result.recommendedMaxOffer / result.totals.totalMarket) * 100 : 0;

    el.purchaseRoot.innerHTML = `
      <div class="grid two">
        <div class="panel">
          <h3>Global Settings</h3>
          <div class="grid three">
            <label class="field"><span>Platform Fee %</span><input id="pcPlatformFee" type="number" step="0.1" value="${settings.platformFeePercent}" /></label>
            <label class="field"><span>Processing %</span><input id="pcProcessingFee" type="number" step="0.1" value="${settings.paymentProcessingPercent}" /></label>
            <label class="field"><span>Underperform %</span><input id="pcUnderperform" type="number" step="0.1" value="${settings.underperformRatePercent}" /></label>
            <label class="field"><span>Target Profit %</span><input id="pcTargetProfit" type="number" step="0.1" value="${settings.targetProfitPercent}" /></label>
            <label class="field"><span>Shipping Material / Order</span><input id="pcShipMat" type="number" step="0.01" value="${settings.shippingMaterialPerOrder}" /></label>
            <label class="field"><span>Protect threshold</span><input id="pcProtectThreshold" type="number" step="0.01" value="${settings.protectBangersThreshold}" /></label>
          </div>
          <div class="mini-actions">
            <button id="pcProtectToggle" class="btn secondary">Protect Bangers: ${settings.protectBangers ? 'ON' : 'OFF'}</button>
            <button id="pcFairToggle" class="btn secondary">Fair Deal Mode: ${settings.fairDealMode ? 'ON' : 'OFF'}</button>
            <button id="pcSaveSettings" class="btn primary">Save Settings</button>
          </div>
          <p>${impliedPctMarket < 50 ? '<span class="badge overdue">Warning: max offer below 50% market.</span>' : ''}</p>
        </div>
        <div class="panel">
          <h3>Results</h3>
          <div class="row"><span>Total Market Value</span><strong>$${result.totals.totalMarket.toFixed(2)}</strong></div>
          <div class="row"><span>Estimated Stream Gross</span><strong>$${result.totals.estimatedStreamGross.toFixed(2)}</strong></div>
          <div class="row"><span>Estimated Net After Fees</span><strong>$${result.totals.estimatedNetAfterFees.toFixed(2)}</strong></div>
          <div class="row"><span>Risk-Adjusted Net</span><strong>$${result.totals.riskAdjustedNet.toFixed(2)}</strong></div>
          <div class="row"><span>Max Offer (target margin)</span><strong>$${result.recommendedMaxOffer.toFixed(2)}</strong></div>
          <div class="row"><span>Max Offer Before Risk</span><strong>$${result.maxOfferBeforeRisk.toFixed(2)}</strong></div>
          <div class="row"><span>Break-even Offer</span><strong>$${result.breakEvenOffer.toFixed(2)}</strong></div>
          <div class="row"><span>Offer Price Input</span><input id="pcOfferPrice" class="status-select" type="number" step="0.01" value="${offerPrice}" /></div>
          <div class="row"><span>Profit/Loss vs Offer</span><strong class="${offerPnL >= 0 ? 'profit-pos' : 'profit-neg'}">$${offerPnL.toFixed(2)}</strong></div>
          <div class="row"><span>Scenario (P/B/O)</span><strong>$${scenario.pessimistic.toFixed(2)} / $${scenario.base.toFixed(2)} / $${scenario.optimistic.toFixed(2)}</strong></div>
        </div>
      </div>

      <div class="panel">
        <h3>Collection Input</h3>
        <div class="mini-actions">
          <button id="pcAddRow" class="btn primary">Add Row</button>
          <button id="pcDuplicateCollection" class="btn secondary">Duplicate This Collection</button>
          <button id="pcExportFullCsv" class="btn secondary">Export Full CSV</button>
          <button id="pcExportTiersCsv" class="btn secondary">Export Tiers CSV</button>
          <button id="pcCopyTiers" class="btn secondary">Copy Tier Text</button>
        </div>
        <table class="table"><thead><tr><th>Name</th><th>Set</th><th>Condition</th><th>Qty</th><th>Market</th><th>Confidence</th><th>Actions</th></tr></thead><tbody>
          ${purchaseState.rows.map((row, idx) => `<tr>
            <td><input data-field="cardName" data-idx="${idx}" class="status-select pc-cell" value="${row.cardName || ''}" /></td>
            <td><input data-field="set" data-idx="${idx}" class="status-select pc-cell" value="${row.set || ''}" /></td>
            <td><input data-field="condition" data-idx="${idx}" class="status-select pc-cell" value="${row.condition || ''}" /></td>
            <td><input data-field="qty" data-idx="${idx}" class="status-select pc-cell" type="number" min="1" value="${row.qty || 1}" /></td>
            <td><input data-field="marketValue" data-idx="${idx}" class="status-select pc-cell" type="number" min="0" step="0.01" value="${row.marketValue || 0}" /></td>
            <td><input data-field="confidence" data-idx="${idx}" class="status-select pc-cell" type="number" min="0" max="1" step="0.1" value="${row.confidence ?? 1}" /></td>
            <td><button class="btn secondary pc-dup" data-idx="${idx}">Dup</button><button class="btn secondary pc-del" data-idx="${idx}">Del</button></td>
          </tr>`).join('')}
        </tbody></table>

        <label class="field"><span>Bulk Paste (Name - qty - $value)</span><textarea id="pcBulk" placeholder="Charizard - 2 - $35\nPikachu - 1 - $4"></textarea></label>
        <div class="mini-actions"><button id="pcParseBulk" class="btn primary">Parse Bulk Paste</button></div>
      </div>

      <div class="panel">
        <h3>Start Tier Buckets</h3>
        ${Object.entries(result.grouped).map(([tier, items]) => `<div class="panel"><h4>${tier} (${items.length})</h4><table class="table"><thead><tr><th>Name</th><th>Qty</th><th>Market</th><th>Expected Close</th><th>Recommended</th></tr></thead><tbody>${items.map((r) => `<tr><td>${r.cardName}</td><td>${r.qty}</td><td>$${r.marketValue.toFixed(2)}</td><td>$${r.expectedClose.toFixed(2)}</td><td>${r.suggestedStartTier}</td></tr>`).join('') || '<tr><td colspan="5">No cards</td></tr>'}</tbody></table></div>`).join('')}
      </div>

      <div class="panel">
        <h3>Recent Collections</h3>
        <table class="table"><thead><tr><th>Name</th><th>Date</th><th>Market</th><th>Risk Net</th><th></th></tr></thead><tbody>
          ${(purchaseState.history || []).map((h, i) => `<tr><td>${h.name}</td><td>${new Date(h.date).toLocaleString()}</td><td>$${h.totalMarket.toFixed(2)}</td><td>$${h.riskNet.toFixed(2)}</td><td><button class="btn secondary pc-load-history" data-idx="${i}">Load</button></td></tr>`).join('') || '<tr><td colspan="5">No saved collections yet.</td></tr>'}
        </tbody></table>
      </div>
    `;

    document.getElementById('pcSaveSettings').addEventListener('click', () => {
      settings.platformFeePercent = Number(document.getElementById('pcPlatformFee').value) || 0;
      settings.paymentProcessingPercent = Number(document.getElementById('pcProcessingFee').value) || 0;
      settings.underperformRatePercent = Number(document.getElementById('pcUnderperform').value) || 0;
      settings.targetProfitPercent = Number(document.getElementById('pcTargetProfit').value) || 0;
      settings.shippingMaterialPerOrder = Number(document.getElementById('pcShipMat').value) || 0;
      settings.protectBangersThreshold = Number(document.getElementById('pcProtectThreshold').value) || 75;
      purchaseState.settings = settings;
      savePurchaseState();
      renderPurchaseCalculator();
    });

    document.getElementById('pcProtectToggle').addEventListener('click', () => {
      settings.protectBangers = !settings.protectBangers; purchaseState.settings = settings; savePurchaseState(); renderPurchaseCalculator();
    });
    document.getElementById('pcFairToggle').addEventListener('click', () => {
      settings.fairDealMode = !settings.fairDealMode;
      if (settings.fairDealMode && settings.targetProfitPercent < 20) settings.targetProfitPercent = 20;
      purchaseState.settings = settings; savePurchaseState(); renderPurchaseCalculator();
    });

    document.getElementById('pcOfferPrice').addEventListener('input', (e) => {
      purchaseState.offerPrice = Number(e.target.value) || 0;
      savePurchaseState();
      renderPurchaseCalculator();
    });

    document.getElementById('pcAddRow').addEventListener('click', () => {
      purchaseState.rows.push({ cardName: '', set: '', condition: '', qty: 1, marketValue: 0, confidence: 1 });
      savePurchaseState();
      renderPurchaseCalculator();
    });

    Array.from(el.purchaseRoot.querySelectorAll('.pc-cell')).forEach((input) => {
      input.addEventListener('input', () => {
        const idx = Number(input.dataset.idx);
        const field = input.dataset.field;
        purchaseState.rows[idx][field] = input.value;
        savePurchaseState();
      });
      input.addEventListener('change', () => renderPurchaseCalculator());
    });

    Array.from(el.purchaseRoot.querySelectorAll('.pc-del')).forEach((btn) => btn.addEventListener('click', () => {
      purchaseState.rows.splice(Number(btn.dataset.idx), 1);
      savePurchaseState();
      renderPurchaseCalculator();
    }));
    Array.from(el.purchaseRoot.querySelectorAll('.pc-dup')).forEach((btn) => btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      purchaseState.rows.splice(idx + 1, 0, { ...purchaseState.rows[idx] });
      savePurchaseState();
      renderPurchaseCalculator();
    }));

    document.getElementById('pcParseBulk').addEventListener('click', () => {
      const parsed = PurchaseCore.parseBulkPaste(document.getElementById('pcBulk').value);
      purchaseState.rows = purchaseState.rows.concat(parsed);
      savePurchaseState();
      renderPurchaseCalculator();
    });

    document.getElementById('pcExportFullCsv').addEventListener('click', () => downloadText('purchase-analysis.csv', PurchaseCore.exportRowsCsv(result.analyzedRows)));
    document.getElementById('pcExportTiersCsv').addEventListener('click', () => downloadText('purchase-tier-buckets.csv', PurchaseCore.exportTierCsv(result.grouped)));
    document.getElementById('pcCopyTiers').addEventListener('click', async () => {
      const text = Object.entries(result.grouped).map(([tier, items]) => `${tier}\n${items.map((i) => `- ${i.cardName} x${i.qty} ($${i.marketValue.toFixed(2)})`).join('\n') || '- none'}`).join('\n\n');
      await navigator.clipboard.writeText(text);
      showToast('Copied tier list');
    });

    document.getElementById('pcDuplicateCollection').addEventListener('click', () => {
      const name = prompt('Collection name:', purchaseState.collectionName || 'Collection') || 'Collection';
      const snapshot = {
        name,
        date: new Date().toISOString(),
        rows: purchaseState.rows.map((r) => ({ ...r })),
        totalMarket: result.totals.totalMarket,
        riskNet: result.totals.riskAdjustedNet
      };
      purchaseState.history = [snapshot, ...(purchaseState.history || [])].slice(0, 5);
      savePurchaseState();
      renderPurchaseCalculator();
      showToast('Collection saved to history');
    });

    Array.from(el.purchaseRoot.querySelectorAll('.pc-load-history')).forEach((btn) => btn.addEventListener('click', () => {
      const item = purchaseState.history[Number(btn.dataset.idx)];
      if (!item) return;
      purchaseState.rows = item.rows.map((r) => ({ ...r }));
      purchaseState.collectionName = item.name;
      savePurchaseState();
      renderPurchaseCalculator();
    }));
  }

  // bag builder
  function loadBagDb() {
    const raw = localStorage.getItem(BAG_STORE_KEY);
    if (!raw) return Core.createEmptyDb();
    try { return Core.migrateDb(JSON.parse(raw)); } catch (_) { return Core.createEmptyDb(); }
  }
  function saveBagDb() { localStorage.setItem(BAG_STORE_KEY, JSON.stringify(bagDb)); }
  function logAudit(bagId, event, payload) { bagDb.auditLogs.unshift({ id: Core.uid(), bagId, event, payload, createdAt: new Date().toISOString(), actor: currentUser()?.username || 'local_user' }); }
  const bagById = (id) => bagDb.bags.find((b) => b.id === id);
  const bagItems = (id) => bagDb.items.filter((i) => i.bagId === id);
  function findOrCreateCustomer(platform, username, displayName = '', notes = '') {
    const norm = Core.normalizeUsername(username);
    let customer = bagDb.customers.find((c) => c.platform === platform && Core.normalizeUsername(c.username) === norm);
    if (customer) return customer;
    customer = { id: Core.uid(), platform, username: username.trim(), displayName: displayName.trim(), notes: notes.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    bagDb.customers.push(customer); return customer;
  }
  function updateBagComputedTotals(bag) {
    const totals = Core.buildTotals(bagItems(bag.id));
    bag.totalItems = totals.totalItems; bag.totalValue = Number(totals.totalValue.toFixed(2)); bag.totalWeightGrams = totals.totalWeightGrams;
  }
  function createBag(data) {
    const customer = findOrCreateCustomer(data.platform, data.username, data.displayName, data.customerNotes);
    const now = new Date();
    const bag = { id: Core.uid(), bagId: Core.generateBagId(bagDb.nextBagSeq++), customerId: customer.id, status: Core.STATUS.OPEN, createdAt: now.toISOString(), lastActivityAt: now.toISOString(), deadlineAt: new Date(now.getTime() + bagDb.settings.deadlineDays * 86400000).toISOString(), shippingPaid: false, shippingPaidRef: '', trackingNumber: '', binLocation: (data.binLocation || '').trim(), notes: (data.notes || '').trim(), totalItems: 0, totalValue: 0, totalWeightGrams: 0 };
    bagDb.bags.push(bag); logAudit(bag.id, 'CREATE_BAG', { bagId: bag.bagId, customerId: customer.id }); saveBagDb(); return bag;
  }
  function addItemToBag(bag, data) {
    const item = { id: Core.uid(), bagId: bag.id, type: data.type || Core.TYPE.SINGLE, name: String(data.name || '').trim(), set: '', condition: '', qty: Math.max(1, Number.parseInt(data.qty, 10) || 1), salePrice: Math.max(0, Number(data.salePrice) || 0), marketPrice: null, costBasis: data.costBasis ? Number(data.costBasis) : null, weightGrams: data.weightGrams ? Number(data.weightGrams) : null, imageUrl: '', streamId: data.streamId || '', status: Core.ITEM_STATUS.IN_BAG, addedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notes: data.notes || '' };
    if (!item.name) throw new Error('Item name required');
    bagDb.items.push(item); bag.lastActivityAt = new Date().toISOString(); updateBagComputedTotals(bag); logAudit(bag.id, 'ADD_ITEM', { itemId: item.id, name: item.name }); saveBagDb();
  }
  function updateItem(itemId, data) {
    const item = bagDb.items.find((x) => x.id === itemId); if (!item) return;
    const before = { ...item };
    item.name = String(data.name || '').trim(); item.qty = Math.max(1, Number.parseInt(data.qty, 10) || 1); item.salePrice = Math.max(0, Number(data.salePrice) || 0); item.type = data.type || item.type; item.weightGrams = data.weightGrams ? Number(data.weightGrams) : null; item.costBasis = data.costBasis ? Number(data.costBasis) : null; item.notes = data.notes || ''; item.updatedAt = new Date().toISOString();
    const bag = bagById(item.bagId); bag.lastActivityAt = new Date().toISOString(); updateBagComputedTotals(bag); logAudit(bag.id, 'EDIT_ITEM', { before, after: { ...item } }); saveBagDb();
  }
  function removeItem(itemId) {
    const item = bagDb.items.find((x) => x.id === itemId); if (!item) return;
    item.status = Core.ITEM_STATUS.REMOVED; item.updatedAt = new Date().toISOString();
    const bag = bagById(item.bagId); bag.lastActivityAt = new Date().toISOString(); updateBagComputedTotals(bag); logAudit(bag.id, 'REMOVE_ITEM', { itemId: item.id }); saveBagDb();
  }
  function setBagStatus(bag, status, payload = {}) {
    const from = bag.status;
    if (from !== status && !Core.validTransition(from, status) && !payload.manualOverride) { showToast('Invalid status transition'); return; }
    bag.status = status; bag.lastActivityAt = new Date().toISOString(); if (status === Core.STATUS.SHIPPING_PAID) bag.shippingPaid = true; logAudit(bag.id, 'CHANGE_STATUS', { from, to: status, ...payload }); saveBagDb();
  }
  function downloadText(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 250);
  }
  function generatePackingSlip(bag) {
    const customer = bagDb.customers.find((c) => c.id === bag.customerId); const items = bagItems(bag.id).filter((x) => x.status === Core.ITEM_STATUS.IN_BAG); const totals = Core.buildTotals(items);
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><html><head><title>Packing Slip ${bag.bagId}</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}</style></head><body><h2>RNG Society - Packing Slip</h2><p><strong>Bag:</strong> ${bag.bagId}<br><strong>Customer:</strong> ${customer.username} (${customer.platform})<br><strong>Date:</strong> ${new Date().toLocaleString()}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Sale Price</th></tr></thead><tbody>${items.map((i) => `<tr><td>${i.name}</td><td>${i.qty}</td><td>$${Number(i.salePrice).toFixed(2)}</td></tr>`).join('')}</tbody></table><p><strong>Total Items:</strong> ${totals.totalItems}<br><strong>Total Value:</strong> $${totals.totalValue.toFixed(2)}<br><strong>Estimated Weight:</strong> ${totals.totalWeightGrams}g<br><strong>Tracking:</strong> ${bag.trackingNumber || '________________'}</p></body></html>`);
    w.document.close(); w.focus(); w.print(); logAudit(bag.id, 'GENERATE_PACKING_SLIP', {}); saveBagDb();
  }
  const bagDeepLink = (bag) => `${window.location.origin}${window.location.pathname}#bag/${encodeURIComponent(bag.id)}`;

  function renderUpsell() {
    el.bagUpsell.innerHTML = `<h2>Bag Builder Pro</h2><p>Track every bag with dispute-proof audit logs, shipping statuses, labels, and packing slips.</p><p>Ask admin to enable Pro on your user account.</p>`;
  }
  function dashboardRows() {
    const query = bagState.dashboardQuery.trim().toLowerCase();
    let rows = bagDb.bags.map((bag) => { const customer = bagDb.customers.find((c) => c.id === bag.customerId) || { username: 'Unknown' }; updateBagComputedTotals(bag); return { bag, customer, overdue: Core.isOverdue(bag) }; });
    rows = rows.filter((r) => !query || r.customer.username.toLowerCase().includes(query) || r.bag.bagId.toLowerCase().includes(query));
    rows = rows.filter((r) => ({ ACTIVE: [Core.STATUS.OPEN, Core.STATUS.HOLD].includes(r.bag.status), READY: r.bag.status === Core.STATUS.READY_TO_SHIP, SHIPPING_PAID: r.bag.status === Core.STATUS.SHIPPING_PAID, PACKED: r.bag.status === Core.STATUS.PACKED, SHIPPED: r.bag.status === Core.STATUS.SHIPPED, OVERDUE: r.overdue }[bagState.dashboardFilter] ?? true));
    rows.sort((a, b) => bagState.sortBy === 'totalValue' ? b.bag.totalValue - a.bag.totalValue : bagState.sortBy === 'deadlineAt' ? new Date(a.bag.deadlineAt) - new Date(b.bag.deadlineAt) : bagState.sortBy === 'totalItems' ? b.bag.totalItems - a.bag.totalItems : new Date(b.bag.lastActivityAt) - new Date(a.bag.lastActivityAt));
    return rows;
  }
  function renderDashboard() {
    const rows = dashboardRows(); const openBags = bagDb.bags.filter((b) => [Core.STATUS.OPEN, Core.STATUS.HOLD].includes(b.status)); const overdue = bagDb.bags.filter((b) => Core.isOverdue(b)); const ready = bagDb.bags.filter((b) => b.status === Core.STATUS.READY_TO_SHIP).length; const openValue = openBags.reduce((sum, b) => sum + (b.totalValue || 0), 0);
    el.bagDashboard.innerHTML = `<h2>Bag Builder Dashboard</h2><div class="kpi-grid"><div class="kpi"><div class="label">Active bags</div><div class="value">${openBags.length}</div></div><div class="kpi"><div class="label">Ready to ship</div><div class="value">${ready}</div></div><div class="kpi"><div class="label">Overdue</div><div class="value">${overdue.length}</div></div><div class="kpi"><div class="label">Open value</div><div class="value">$${openValue.toFixed(2)}</div></div></div><div class="toolbar"><input id="bagSearch" class="status-select" placeholder="Search username or BAG ID" value="${bagState.dashboardQuery}" /><select id="bagFilter" class="status-select">${[['ACTIVE', 'Active'], ['READY', 'Ready to Ship'], ['SHIPPING_PAID', 'Shipping Paid'], ['PACKED', 'Packed'], ['SHIPPED', 'Shipped'], ['OVERDUE', 'Overdue']].map(([v, l]) => `<option value="${v}" ${bagState.dashboardFilter === v ? 'selected' : ''}>${l}</option>`).join('')}</select><select id="bagSort" class="status-select">${[['lastActivityAt', 'Last activity'], ['totalValue', 'Total value'], ['deadlineAt', 'Deadline'], ['totalItems', 'Total items']].map(([v, l]) => `<option value="${v}" ${bagState.sortBy === v ? 'selected' : ''}>${l}</option>`).join('')}</select><button id="createBagBtn" class="btn primary">Create Bag</button><button id="exportAllBagsBtn" class="btn secondary">Export CSV</button></div><table class="table"><thead><tr><th>Bag</th><th>User</th><th>Status</th><th>Total</th><th>Items</th><th>Last Activity</th><th>Deadline</th><th>Flags</th><th></th></tr></thead><tbody>${rows.map(({ bag, customer, overdue: isOver }) => `<tr><td>${bag.bagId}</td><td>${customer.username}</td><td>${bag.status}</td><td>$${Number(bag.totalValue).toFixed(2)}</td><td>${bag.totalItems}</td><td>${new Date(bag.lastActivityAt).toLocaleDateString()}</td><td>${new Date(bag.deadlineAt).toLocaleDateString()}</td><td>${isOver ? '<span class="badge overdue">Overdue</span>' : ''} ${(bag.totalValue || 0) >= bagDb.settings.highValueThreshold ? '<span class="badge high">High Value</span>' : ''} ${bag.binLocation ? `<span class="badge bin">${bag.binLocation}</span>` : ''}</td><td><button class="btn secondary open-bag" data-bag-id="${bag.id}">Open</button></td></tr>`).join('')}</tbody></table>`;
    document.getElementById('bagSearch').addEventListener('input', (e) => { bagState.dashboardQuery = e.target.value; renderDashboard(); });
    document.getElementById('bagFilter').addEventListener('change', (e) => { bagState.dashboardFilter = e.target.value; renderDashboard(); });
    document.getElementById('bagSort').addEventListener('change', (e) => { bagState.sortBy = e.target.value; renderDashboard(); });
    document.getElementById('createBagBtn').addEventListener('click', createBagPrompt);
    document.getElementById('exportAllBagsBtn').addEventListener('click', () => downloadText('bags-summary.csv', Core.exportBagsSummaryCsv(bagDb)));
    Array.from(el.bagDashboard.querySelectorAll('.open-bag')).forEach((btn) => btn.addEventListener('click', () => { bagState.currentBagId = btn.dataset.bagId; bagState.bagView = 'detail'; renderBagBuilder(); }));
  }
  function createBagPrompt() {
    const platform = prompt('Platform:', 'whatnot') || 'whatnot'; const username = prompt('Customer username:', ''); if (!username) return;
    const displayName = prompt('Display name:', '') || ''; const binLocation = prompt('Bin location:', '') || ''; const notes = prompt('Bag notes:', '') || '';
    const bag = createBag({ platform, username, displayName, customerNotes: '', binLocation, notes }); bagState.currentBagId = bag.id; bagState.bagView = 'detail'; renderBagBuilder();
  }
  function renderBagDetail() {
    const bag = bagById(bagState.currentBagId); if (!bag) { bagState.bagView = 'dashboard'; renderBagBuilder(); return; }
    const customer = bagDb.customers.find((c) => c.id === bag.customerId); const active = bagItems(bag.id).filter((i) => i.status === Core.ITEM_STATUS.IN_BAG); const totals = Core.buildTotals(active); const logs = bagDb.auditLogs.filter((x) => x.bagId === bag.id).slice(0, 40);
    el.bagDetail.innerHTML = `<div class="mini-actions"><button id="backDash" class="btn secondary">Back</button><button id="quickAdd" class="btn primary">Quick Add Item</button><button id="exportBagCsv" class="btn secondary">Export Ledger CSV</button><button id="labelBtn" class="btn secondary">Label / QR</button><button id="packingSlipBtn" class="btn secondary">Packing Slip (PDF)</button></div><h2>${bag.bagId} • ${customer.username}</h2><div class="row"><span>Status</span><span><select id="bagStatus" class="status-select">${Object.values(Core.STATUS).map((s) => `<option value="${s}" ${bag.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></span></div><div class="row"><span>Deadline</span><strong>${new Date(bag.deadlineAt).toLocaleDateString()} ${Core.isOverdue(bag) ? '<span class="badge overdue">Overdue</span>' : ''}</strong></div><div class="row"><span>Shipping Paid</span><strong>${bag.shippingPaid ? 'Yes' : 'No'} ${bag.shippingPaidRef ? `(${bag.shippingPaidRef})` : ''}</strong></div><div class="row"><span>Tracking</span><strong>${bag.trackingNumber || '—'}</strong></div><div class="mini-actions"><button id="readyBtn" class="btn secondary">Mark Ready</button><button id="paidBtn" class="btn secondary">Mark Shipping Paid</button><button id="packedBtn" class="btn secondary">Mark Packed</button><button id="shippedBtn" class="btn secondary">Mark Shipped</button><button id="archiveBtn" class="btn secondary">Archive</button></div><div class="two-col"><div><h3>Ledger</h3><table class="table"><thead><tr><th>Name</th><th>Qty</th><th>Sale</th><th>Type</th><th>Added</th><th>Notes</th><th></th></tr></thead><tbody>${active.map((i) => `<tr><td>${i.name}</td><td>${i.qty}</td><td>$${Number(i.salePrice).toFixed(2)}</td><td>${i.type}</td><td>${new Date(i.addedAt).toLocaleDateString()}</td><td>${i.notes || ''}</td><td><button class="btn secondary item-edit" data-item-id="${i.id}">Edit</button><button class="btn secondary item-remove" data-item-id="${i.id}">Remove</button></td></tr>`).join('')}</tbody></table></div><div class="stack"><div class="panel"><h3>Totals</h3><div class="row"><span>Total Items</span><strong>${totals.totalItems}</strong></div><div class="row"><span>Total Value</span><strong>$${totals.totalValue.toFixed(2)}</strong></div><div class="row"><span>Estimated Weight</span><strong>${totals.totalWeightGrams} g</strong></div><div class="row"><span>Shipping Class</span><strong>${Core.estimateShippingClass(totals.totalWeightGrams)}</strong></div></div><div class="panel"><h3>Audit Log</h3>${logs.map((l) => `<div class="row"><span>${l.event}</span><small>${new Date(l.createdAt).toLocaleString()}</small></div>`).join('') || '<p>No events yet.</p>'}</div></div></div>`;

    document.getElementById('backDash').addEventListener('click', () => { bagState.bagView = 'dashboard'; renderBagBuilder(); });
    document.getElementById('quickAdd').addEventListener('click', () => quickAddPrompt(bag));
    document.getElementById('exportBagCsv').addEventListener('click', () => downloadText(`${bag.bagId}-ledger.csv`, Core.exportBagCsv(bag, customer, active)));
    document.getElementById('packingSlipBtn').addEventListener('click', () => generatePackingSlip(bag));
    document.getElementById('labelBtn').addEventListener('click', () => showLabel(bag, customer));
    document.getElementById('bagStatus').addEventListener('change', (e) => { setBagStatus(bag, e.target.value, { manualOverride: true }); renderBagBuilder(); });
    document.getElementById('readyBtn').addEventListener('click', () => { setBagStatus(bag, Core.STATUS.READY_TO_SHIP); renderBagBuilder(); });
    document.getElementById('paidBtn').addEventListener('click', () => { bag.shippingPaidRef = prompt('Shipping payment reference:', bag.shippingPaidRef || '') || ''; bag.shippingPaid = true; setBagStatus(bag, Core.STATUS.SHIPPING_PAID, { ref: bag.shippingPaidRef }); logAudit(bag.id, 'MARK_SHIPPING_PAID', { ref: bag.shippingPaidRef }); renderBagBuilder(); });
    document.getElementById('packedBtn').addEventListener('click', () => { setBagStatus(bag, Core.STATUS.PACKED); renderBagBuilder(); });
    document.getElementById('shippedBtn').addEventListener('click', () => { bag.trackingNumber = prompt('Tracking number:', bag.trackingNumber || '') || ''; setBagStatus(bag, Core.STATUS.SHIPPED, { tracking: bag.trackingNumber }); logAudit(bag.id, 'ADD_TRACKING', { tracking: bag.trackingNumber }); renderBagBuilder(); });
    document.getElementById('archiveBtn').addEventListener('click', () => { setBagStatus(bag, Core.STATUS.ARCHIVED); logAudit(bag.id, 'ARCHIVE_BAG', {}); renderBagBuilder(); });
    Array.from(el.bagDetail.querySelectorAll('.item-remove')).forEach((b) => b.addEventListener('click', () => { removeItem(b.dataset.itemId); renderBagBuilder(); }));
    Array.from(el.bagDetail.querySelectorAll('.item-edit')).forEach((b) => b.addEventListener('click', () => editItemPrompt(b.dataset.itemId)));
  }
  function quickAddPrompt(bag) {
    const mode = prompt('Quick Add Mode: manual or singles', 'manual') || 'manual';
    if (mode.toLowerCase() === 'singles') {
      const name = prompt('Item name:', 'From Singles Calculator'); if (!name) return;
      addItemToBag(bag, { name, qty: 1, salePrice: Number(el.cardCost.value || 0), type: Core.TYPE.SINGLE, weightGrams: bagDb.settings.weightPresets.rawTopLoader, notes: 'Added from Singles Calculator' }); renderBagBuilder(); return;
    }
    const name = prompt('Item name:', ''); if (!name) return;
    addItemToBag(bag, { name, qty: prompt('Qty:', '1'), salePrice: prompt('Sale price:', '0'), type: prompt('Type:', 'SINGLE') || 'SINGLE', weightGrams: prompt('Weight grams:', ''), costBasis: prompt('Cost basis:', ''), notes: prompt('Notes:', '') });
    renderBagBuilder();
  }
  function editItemPrompt(itemId) {
    const item = bagDb.items.find((x) => x.id === itemId); if (!item) return;
    const name = prompt('Item name:', item.name); if (!name) return;
    updateItem(itemId, { name, qty: prompt('Qty:', String(item.qty)), salePrice: prompt('Sale price:', String(item.salePrice)), type: prompt('Type:', item.type), weightGrams: prompt('Weight grams:', item.weightGrams ?? ''), costBasis: prompt('Cost basis:', item.costBasis ?? ''), notes: prompt('Notes:', item.notes || '') });
    renderBagBuilder();
  }
  function showLabel(bag, customer) {
    const qr = `https://quickchart.io/qr?text=${encodeURIComponent(bagDeepLink(bag))}&size=180`;
    const w = window.open('', '_blank'); w.document.write(`<!doctype html><html><body style="font-family:Arial;padding:18px"><h3>${bag.bagId}</h3><p>${customer.username} (${customer.platform})</p><p>Bin: ${bag.binLocation || '—'}</p><img src="${qr}" alt="Bag QR" /><p>${bagDeepLink(bag)}</p></body></html>`); w.document.close();
  }
  function renderCustomers() {
    const rows = bagDb.customers.map((c) => { const bags = bagDb.bags.filter((b) => b.customerId === c.id && b.status !== Core.STATUS.ARCHIVED); return `<tr><td>${c.username}</td><td>${c.platform}</td><td>${bags.length}</td><td>$${bags.reduce((s, b) => s + Number(b.totalValue || 0), 0).toFixed(2)}</td><td>${c.notes || ''}</td></tr>`; }).join('');
    el.bagCustomers.innerHTML = `<h2>Customers</h2><table class="table"><thead><tr><th>Username</th><th>Platform</th><th>Bag count</th><th>Open value</th><th>Notes</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No customers yet.</td></tr>'}</tbody></table>`;
  }
  function renderSettings() {
    const s = bagDb.settings;
    el.bagSettings.innerHTML = `<h2>Bag Builder Settings</h2><div class="grid three"><label class="field"><span>Default deadline days</span><input id="setDeadline" type="number" min="1" value="${s.deadlineDays}" /></label><label class="field"><span>High-value threshold ($)</span><input id="setHighValue" type="number" min="0" step="0.01" value="${s.highValueThreshold}" /></label><label class="field"><span>Inactivity thresholds (comma)</span><input id="setInactivity" type="text" value="${s.inactivityThresholds.join(',')}" /></label></div><h3>Weight Presets (grams)</h3><div class="grid three"><label class="field"><span>Raw single top loader</span><input id="wRaw" type="number" value="${s.weightPresets.rawTopLoader}" /></label><label class="field"><span>Slab</span><input id="wSlab" type="number" value="${s.weightPresets.slab}" /></label><label class="field"><span>Booster pack</span><input id="wPack" type="number" value="${s.weightPresets.boosterPack}" /></label><label class="field"><span>Booster box</span><input id="wBox" type="number" value="${s.weightPresets.boosterBox}" /></label><label class="field"><span>Packaging weight</span><input id="wPkg" type="number" value="${s.weightPresets.packaging}" /></label></div><button id="saveBagSettings" class="btn primary">Save Settings</button>`;
    document.getElementById('saveBagSettings').addEventListener('click', () => {
      bagDb.settings.deadlineDays = Math.max(1, Number(document.getElementById('setDeadline').value) || 60);
      bagDb.settings.highValueThreshold = Math.max(0, Number(document.getElementById('setHighValue').value) || 150);
      bagDb.settings.inactivityThresholds = String(document.getElementById('setInactivity').value).split(',').map((x) => Number(x.trim())).filter((x) => Number.isFinite(x));
      bagDb.settings.weightPresets = { rawTopLoader: Number(document.getElementById('wRaw').value) || 18, slab: Number(document.getElementById('wSlab').value) || 110, boosterPack: Number(document.getElementById('wPack').value) || 28, boosterBox: Number(document.getElementById('wBox').value) || 820, packaging: Number(document.getElementById('wPkg').value) || 65 };
      saveBagDb(); showToast('Settings saved');
    });
  }
  function renderAdmin() {
    if (!isAdmin()) { bagState.bagView = 'dashboard'; renderBagBuilder(); return; }
    el.bagAdmin.innerHTML = `<h2>Admin Panel</h2><p>Manage users, roles, Pro access, and password resets.</p><div class="mini-actions"><button id="newUserBtn" class="btn primary">Create User</button></div><table class="table"><thead><tr><th>Username</th><th>Role</th><th>Pro</th><th>Enabled</th><th>Created</th><th></th></tr></thead><tbody>${authDb.users.map((u) => `<tr><td>${u.username}</td><td>${u.role}</td><td>${u.isPro ? 'Yes' : 'No'}</td><td>${u.enabled ? 'Yes' : 'No'}</td><td>${new Date(u.createdAt).toLocaleDateString()}</td><td><button class="btn secondary toggle-pro" data-user-id="${u.id}">Toggle Pro</button><button class="btn secondary toggle-enable" data-user-id="${u.id}">Toggle Enabled</button><button class="btn secondary reset-pass" data-user-id="${u.id}">Reset Pass</button></td></tr>`).join('')}</tbody></table>`;
    document.getElementById('newUserBtn').addEventListener('click', () => {
      const username = prompt('New username:', ''); if (!username) return;
      if (authDb.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) { showToast('Username exists'); return; }
      const password = prompt('Temporary password:', 'changeme123') || 'changeme123';
      const role = (prompt('Role (admin/user):', 'user') || 'user').toLowerCase() === 'admin' ? 'admin' : 'user';
      const isPro = confirm('Enable Pro access for this user?');
      authDb.users.push({ id: Core.uid(), username, passwordHash: Core.hashPassword(password), role, isPro, enabled: true, createdAt: new Date().toISOString() });
      saveAuthDb(); renderAdmin();
    });
    Array.from(el.bagAdmin.querySelectorAll('.toggle-pro')).forEach((b) => b.addEventListener('click', () => { const u = authDb.users.find((x) => x.id === b.dataset.userId); if (!u) return; u.isPro = !u.isPro; saveAuthDb(); renderAdmin(); }));
    Array.from(el.bagAdmin.querySelectorAll('.toggle-enable')).forEach((b) => b.addEventListener('click', () => { const u = authDb.users.find((x) => x.id === b.dataset.userId); if (!u || u.username === 'admin') return; u.enabled = !u.enabled; saveAuthDb(); renderAdmin(); }));
    Array.from(el.bagAdmin.querySelectorAll('.reset-pass')).forEach((b) => b.addEventListener('click', () => { const u = authDb.users.find((x) => x.id === b.dataset.userId); if (!u) return; const p = prompt(`New password for ${u.username}:`, 'changeme123'); if (!p) return; u.passwordHash = Core.hashPassword(p); saveAuthDb(); showToast('Password reset'); }));
  }
  function setBagView(view) {
    bagState.bagView = view;
    el.bagViewButtons.forEach((b) => b.classList.toggle('active', b.dataset.bagView === view));
    el.bagDashboard.classList.toggle('hidden', view !== 'dashboard');
    el.bagDetail.classList.toggle('hidden', view !== 'detail');
    el.bagCustomers.classList.toggle('hidden', view !== 'customers');
    el.bagSettings.classList.toggle('hidden', view !== 'settings');
    el.bagAdmin.classList.toggle('hidden', view !== 'admin');
  }
  function renderBagBuilder() {
    el.adminTabBtn.classList.toggle('hidden', !isAdmin());
    if (!isLoggedIn() || !hasProAccess()) { el.bagUpsell.classList.remove('hidden'); el.bagAppShell.classList.add('hidden'); renderUpsell(); return; }
    el.bagUpsell.classList.add('hidden'); el.bagAppShell.classList.remove('hidden');
    if (bagState.bagView === 'admin' && !isAdmin()) bagState.bagView = 'dashboard';
    setBagView(bagState.bagView);
    if (bagState.bagView === 'dashboard') renderDashboard();
    else if (bagState.bagView === 'detail') renderBagDetail();
    else if (bagState.bagView === 'customers') renderCustomers();
    else if (bagState.bagView === 'settings') renderSettings();
    else renderAdmin();
  }

  // module switching
  function switchModule(module) {
    el.moduleButtons.forEach((b) => b.classList.toggle('active', b.dataset.module === module));
    el.singlesModule.classList.toggle('hidden', module !== 'singles');
    el.purchaseModule.classList.toggle('hidden', module !== 'purchase');
    el.bagBuilderModule.classList.toggle('hidden', module !== 'bagBuilder');
    if (module === 'bagBuilder') renderBagBuilder();
    if (module === 'purchase') renderPurchaseCalculator();
  }

  function wireRouting() {
    el.moduleButtons.forEach((btn) => btn.addEventListener('click', () => switchModule(btn.dataset.module)));
    el.bagViewButtons.forEach((btn) => btn.addEventListener('click', () => { bagState.bagView = btn.dataset.bagView; renderBagBuilder(); }));
    if (window.location.hash.startsWith('#bag/')) {
      const bagId = decodeURIComponent(window.location.hash.replace('#bag/', ''));
      if (bagById(bagId)) { bagState.currentBagId = bagId; bagState.bagView = 'detail'; switchModule('bagBuilder'); }
    }
  }

  wireSingles();
  renderAuthPanel();
  wireRouting();
})();
