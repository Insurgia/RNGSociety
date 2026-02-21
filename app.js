(() => {
  'use strict';

  const els = {
    cardCost: document.getElementById('cardCost'),
    freebieCost: document.getElementById('freebieCost'),
    shipFee: document.getElementById('shipFee'),
    cardsPerOrder: document.getElementById('cardsPerOrder'),
    commissionPct: document.getElementById('commissionPct'),
    processingPct: document.getElementById('processingPct'),
    processingFixed: document.getElementById('processingFixed'),
    perCardShip: document.getElementById('perCardShip'),
    breakEvenVal: document.getElementById('breakEvenVal'),
    recommendVal: document.getElementById('recommendVal'),
    recommendHint: document.getElementById('recommendHint'),
    profitVal: document.getElementById('profitVal'),
    profitCard: document.getElementById('profitCard'),
    breakdownInner: document.getElementById('breakdownInner'),
    breakdownToggle: document.getElementById('breakdownToggle'),
    breakdownPanel: document.getElementById('breakdownPanel'),
    copyBtn: document.getElementById('copyBtn'),
    resetBtn: document.getElementById('resetBtn'),
    toast: document.getElementById('toast'),
    bufferBtns: [...document.querySelectorAll('.buffer-btn')],
    navSingles: document.getElementById('navSingles'),
    navBags: document.getElementById('navBags'),
    singlesModule: document.getElementById('singlesModule'),
    bagsModule: document.getElementById('bagsModule'),
    bagUpsell: document.getElementById('bagUpsell'),
    bagApp: document.getElementById('bagApp'),
    createBagBtn: document.getElementById('createBagBtn'),
    exportBagsCsvBtn: document.getElementById('exportBagsCsvBtn'),
    bagCustomerUsername: document.getElementById('bagCustomerUsername'),
    bagCustomerPlatform: document.getElementById('bagCustomerPlatform'),
    bagList: document.getElementById('bagList'),
    bagActiveCount: document.getElementById('bagActiveCount'),
    bagOverdueCount: document.getElementById('bagOverdueCount'),
  };

  let currentBuffer = 0.15;
  let currentRecommended = null;
  let toastTimeout;

  const STORAGE_KEY = 'rngsociety-profit-calc-v3';
  const BAG_DB_KEY = 'rngsociety-bag-builder-v1';
  const PRO_KEY = 'rngsociety-pro-enabled';

  let activeModule = 'singles';
  let bagDb = null;

  const toNumber = (value) => {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : NaN;
  };

  const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
  const currency = (value) => `$${round2(value).toFixed(2)}`;
  const ceilQuarter = (value) => Math.ceil(value * 4) / 4;

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => els.toast.classList.remove('show'), 1500);
  }

  function getPerCardShip() {
    const shipFee = Math.max(0, toNumber(els.shipFee.value) || 0);
    const cards = Math.max(1, Math.floor(toNumber(els.cardsPerOrder.value) || 1));
    const perCard = round2(shipFee / cards);
    els.perCardShip.textContent = `${currency(perCard)} / card`;
    return perCard;
  }

  function feeBreakdownForSale(sale, commissionPct, processingPct, processingFixed) {
    const commission = round2((commissionPct / 100) * sale);
    const processingPercentPart = round2((processingPct / 100) * sale);
    const processing = round2(processingPercentPart + processingFixed);
    const totalFees = round2(commission + processing);
    const netEarnings = round2(sale - totalFees);
    return { commission, processing, totalFees, netEarnings };
  }

  function calculateProfitForSale(sale, hardCost, commissionPct, processingPct, processingFixed) {
    const fees = feeBreakdownForSale(sale, commissionPct, processingPct, processingFixed);
    return {
      ...fees,
      profit: round2(fees.netEarnings - hardCost),
    };
  }

  function findBreakEven(hardCost, commissionPct, processingPct, processingFixed) {
    let sale = 0.01;
    let guard = 0;

    while (sale <= 5000 && guard < 600000) {
      const { profit } = calculateProfitForSale(sale, hardCost, commissionPct, processingPct, processingFixed);
      if (profit >= 0) return round2(sale);
      sale = round2(sale + 0.01);
      guard += 1;
    }

    return round2(hardCost);
  }

  function renderBreakdown(data) {
    if (!data) {
      els.breakdownInner.innerHTML = '<p class="row">Enter card cost to see breakdown.</p>';
      return;
    }

    const profitClass = data.profit >= 0 ? 'profit-pos' : 'profit-neg';

    els.breakdownInner.innerHTML = `
      <div class="row"><span>Sale price</span><strong class="revenue">${currency(data.recommended)}</strong></div>
      <div class="row"><span>Commission (${data.commissionPct.toFixed(1)}%)</span><strong class="cost">-${currency(data.commission)}</strong></div>
      <div class="row"><span>Processing (${data.processingPct.toFixed(1)}% + ${currency(data.processingFixed)})</span><strong class="cost">-${currency(data.processing)}</strong></div>
      <div class="row"><span>Total fees</span><strong class="cost">-${currency(data.totalFees)}</strong></div>
      <div class="row"><span>Net earnings</span><strong class="revenue">${currency(data.netEarnings)}</strong></div>
      <div class="row"><span>Card cost</span><strong class="cost">-${currency(data.cardCost)}</strong></div>
      <div class="row"><span>Freebie cost</span><strong class="cost">-${currency(data.freebieCost)}</strong></div>
      <div class="row"><span>Shipping / card</span><strong class="cost">-${currency(data.perCardShip)}</strong></div>
      <div class="row total"><span>Net profit</span><strong class="${profitClass}">${data.profit >= 0 ? '+' : ''}${currency(data.profit)}</strong></div>
    `;
  }

  function setEmptyState() {
    currentRecommended = null;
    els.breakEvenVal.textContent = '—';
    els.recommendVal.textContent = '—';
    els.profitVal.textContent = '—';
    els.recommendHint.textContent = 'Enter card cost to calculate';
    els.copyBtn.disabled = true;
    els.profitCard.classList.remove('negative');
    renderBreakdown(null);
  }

  function calculate() {
    const cardCost = toNumber(els.cardCost.value);
    if (!Number.isFinite(cardCost) || cardCost < 0 || els.cardCost.value === '') {
      getPerCardShip();
      setEmptyState();
      persistInputs();
      return;
    }

    const freebieCost = Math.max(0, toNumber(els.freebieCost.value) || 0);
    const perCardShip = getPerCardShip();

    const commissionPct = Math.min(100, Math.max(0, toNumber(els.commissionPct.value) || 8));
    const processingPct = Math.min(100, Math.max(0, toNumber(els.processingPct.value) || 2.9));
    const processingFixed = Math.max(0, toNumber(els.processingFixed.value) || 0.30);

    const hardCost = round2(cardCost + freebieCost + perCardShip);
    const breakEven = findBreakEven(hardCost, commissionPct, processingPct, processingFixed);

    const recommendedRaw = breakEven * (1 + currentBuffer);
    const recommended = ceilQuarter(recommendedRaw);

    const calc = calculateProfitForSale(recommended, hardCost, commissionPct, processingPct, processingFixed);

    currentRecommended = recommended;
    els.breakEvenVal.textContent = currency(breakEven);
    els.recommendVal.textContent = currency(recommended);
    els.profitVal.textContent = `${calc.profit >= 0 ? '+' : ''}${currency(calc.profit)}`;
    els.recommendHint.textContent = `${Math.round(currentBuffer * 100)}% buffer + rounded to nearest $0.25`;
    els.profitCard.classList.toggle('negative', calc.profit < 0);
    els.copyBtn.disabled = false;

    renderBreakdown({
      recommended,
      cardCost,
      freebieCost,
      perCardShip,
      commissionPct,
      processingPct,
      processingFixed,
      ...calc,
    });

    persistInputs();
  }

  function persistInputs() {
    const activeBuffer = els.bufferBtns.find((btn) => btn.classList.contains('active'));
    const data = {
      cardCost: els.cardCost.value,
      freebieCost: els.freebieCost.value,
      shipFee: els.shipFee.value,
      cardsPerOrder: els.cardsPerOrder.value,
      commissionPct: els.commissionPct.value,
      processingPct: els.processingPct.value,
      processingFixed: els.processingFixed.value,
      buffer: activeBuffer?.dataset.buffer || '0.15',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function restoreInputs() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (typeof data.cardCost === 'string') els.cardCost.value = data.cardCost;
      if (typeof data.freebieCost === 'string') els.freebieCost.value = data.freebieCost;
      if (typeof data.shipFee === 'string') els.shipFee.value = data.shipFee;
      if (typeof data.cardsPerOrder === 'string') els.cardsPerOrder.value = data.cardsPerOrder;
      if (typeof data.commissionPct === 'string') els.commissionPct.value = data.commissionPct;
      if (typeof data.processingPct === 'string') els.processingPct.value = data.processingPct;
      if (typeof data.processingFixed === 'string') els.processingFixed.value = data.processingFixed;
      if (typeof data.buffer === 'string') {
        const match = els.bufferBtns.find((btn) => btn.dataset.buffer === data.buffer);
        if (match) {
          els.bufferBtns.forEach((btn) => btn.classList.remove('active'));
          match.classList.add('active');
          currentBuffer = Number.parseFloat(match.dataset.buffer);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  els.breakdownToggle.addEventListener('click', () => {
    const isOpen = els.breakdownPanel.classList.toggle('open');
    els.breakdownToggle.setAttribute('aria-expanded', String(isOpen));
  });

  [
    els.cardCost,
    els.freebieCost,
    els.shipFee,
    els.cardsPerOrder,
    els.commissionPct,
    els.processingPct,
    els.processingFixed,
  ].forEach((input) => {
    input.addEventListener('input', calculate);
  });

  els.bufferBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      els.bufferBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentBuffer = Number.parseFloat(btn.dataset.buffer);
      calculate();
    });
  });

  els.copyBtn.addEventListener('click', async () => {
    if (!Number.isFinite(currentRecommended)) return;
    const snippet = `Start: ${currency(currentRecommended)} | Break-even: ${els.breakEvenVal.textContent} | Fees: ${els.commissionPct.value}% + ${els.processingPct.value}% + ${currency(toNumber(els.processingFixed.value) || 0)}`;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(snippet);
      els.copyBtn.classList.add('copied');
      setTimeout(() => els.copyBtn.classList.remove('copied'), 350);
      showToast('Listing snippet copied');
    }
  });

  els.resetBtn.addEventListener('click', () => {
    els.cardCost.value = '';
    els.freebieCost.value = '';
    els.shipFee.value = '2';
    els.cardsPerOrder.value = '5';
    els.commissionPct.value = '8';
    els.processingPct.value = '2.9';
    els.processingFixed.value = '0.30';
    els.bufferBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.buffer === '0.15'));
    currentBuffer = 0.15;
    localStorage.removeItem(STORAGE_KEY);
    setEmptyState();
    getPerCardShip();
    els.cardCost.focus();
  });

  function loadBagDb() {
    const core = window.BagBuilderCore;
    if (!core) return core?.createEmptyDb?.() || {};
    try {
      const raw = localStorage.getItem(BAG_DB_KEY);
      const parsed = raw ? JSON.parse(raw) : core.createEmptyDb();
      return core.migrateDb(parsed);
    } catch {
      return core.createEmptyDb();
    }
  }

  function saveBagDb() {
    localStorage.setItem(BAG_DB_KEY, JSON.stringify(bagDb));
  }

  function isProEnabled() {
    return localStorage.getItem(PRO_KEY) === 'true';
  }

  function setActiveModule(module) {
    activeModule = module;
    const showSingles = module === 'singles';
    els.singlesModule.hidden = !showSingles;
    els.bagsModule.hidden = showSingles;
    els.navSingles.classList.toggle('active', showSingles);
    els.navBags.classList.toggle('active', !showSingles);

    if (!showSingles) {
      const pro = isProEnabled();
      els.bagUpsell.hidden = pro;
      els.bagApp.hidden = !pro;
      if (pro) renderBagDashboard();
    }
  }

  function upsertCustomer(platform, username) {
    const core = window.BagBuilderCore;
    const normalized = core.normalizeUsername(username);
    let existing = bagDb.customers.find((c) => core.normalizeUsername(c.username) === normalized && c.platform === platform);
    if (existing) return existing;
    const now = new Date().toISOString();
    existing = {
      id: core.uid(),
      platform,
      username: username.trim(),
      displayName: '',
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    bagDb.customers.push(existing);
    return existing;
  }

  function createBag() {
    const core = window.BagBuilderCore;
    const username = (els.bagCustomerUsername.value || '').trim();
    const platform = (els.bagCustomerPlatform.value || 'whatnot').trim() || 'whatnot';
    if (!username) {
      showToast('Enter customer username first');
      return;
    }

    const customer = upsertCustomer(platform, username);
    const now = new Date();
    const deadline = new Date(now.getTime() + (bagDb.settings.deadlineDays || 60) * 86400000);

    const bag = {
      id: core.uid(),
      bagId: core.generateBagId(bagDb.nextBagSeq++),
      customerId: customer.id,
      status: core.STATUS.OPEN,
      createdAt: now.toISOString(),
      lastActivityAt: now.toISOString(),
      deadlineAt: deadline.toISOString(),
      shippingPaid: false,
      shippingPaidRef: '',
      trackingNumber: '',
      binLocation: '',
    };

    bagDb.bags.push(bag);
    bagDb.auditLogs.push({
      id: core.uid(),
      bagId: bag.id,
      event: 'CREATE_BAG',
      payload: { bagId: bag.bagId, customerId: customer.id },
      createdAt: now.toISOString(),
      actor: 'local_user',
    });

    saveBagDb();
    renderBagDashboard();
    els.bagCustomerUsername.value = '';
    showToast(`Created ${bag.bagId}`);
  }

  function renderBagDashboard() {
    const core = window.BagBuilderCore;
    const activeBags = bagDb.bags.filter((b) => [core.STATUS.OPEN, core.STATUS.HOLD, core.STATUS.READY_TO_SHIP, core.STATUS.SHIPPING_PAID, core.STATUS.PACKED].includes(b.status));
    const overdue = bagDb.bags.filter((b) => core.isOverdue(b));
    els.bagActiveCount.textContent = String(activeBags.length);
    els.bagOverdueCount.textContent = String(overdue.length);

    if (!bagDb.bags.length) {
      els.bagList.innerHTML = '<p class="row">No bags yet. Create your first bag above.</p>';
      return;
    }

    const sorted = [...bagDb.bags].sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
    els.bagList.innerHTML = sorted.map((bag) => {
      const customer = bagDb.customers.find((c) => c.id === bag.customerId);
      const totals = core.buildTotals(bagDb.items.filter((i) => i.bagId === bag.id));
      const overdueBadge = core.isOverdue(bag) ? ' <span class="pro-pill">OVERDUE</span>' : '';
      return `<div class="row"><span><strong>${bag.bagId}</strong> · ${customer?.username || 'unknown'} (${bag.status})${overdueBadge}</span><strong>${currency(totals.totalValue)}</strong></div>`;
    }).join('');
  }

  function exportBagsCsv() {
    const core = window.BagBuilderCore;
    const csv = core.exportBagsSummaryCsv(bagDb);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bags-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Bags CSV exported');
  }

  function initBagBuilder() {
    bagDb = loadBagDb();
    els.navSingles.addEventListener('click', () => setActiveModule('singles'));
    els.navBags.addEventListener('click', () => setActiveModule('bags'));
    els.createBagBtn.addEventListener('click', createBag);
    els.exportBagsCsvBtn.addEventListener('click', exportBagsCsv);
  }

  restoreInputs();
  calculate();
  initBagBuilder();
  setActiveModule(activeModule);
  els.cardCost.focus();
})();
