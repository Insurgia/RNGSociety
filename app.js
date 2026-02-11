(() => {
  'use strict';

  const els = {
    cardCost: document.getElementById('cardCost'),
    freebieCost: document.getElementById('freebieCost'),
    shipFee: document.getElementById('shipFee'),
    cardsPerOrder: document.getElementById('cardsPerOrder'),
    platformFeePct: document.getElementById('platformFeePct'),
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
  };

  let currentBuffer = 0.15;
  let currentRecommended = null;
  let toastTimeout;

  const STORAGE_KEY = 'rngsociety-profit-calc-v2';

  const toNumber = (value) => {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : NaN;
  };

  const currency = (value) => `$${value.toFixed(2)}`;
  const toCents = (value) => Math.round(value * 100);
  const fromCents = (value) => value / 100;
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
    const perCard = shipFee / cards;
    els.perCardShip.textContent = `${currency(perCard)} / card`;
    return perCard;
  }

  function feeBreakdownForSale(price, commissionPct, processingPct, processingFixed, perCardShip) {
    const commission = fromCents(toCents(price * (commissionPct / 100)));
    const processingPercentFee = fromCents(toCents(price * (processingPct / 100)));
    const processing = fromCents(toCents(processingPercentFee + processingFixed));
    const shipping = fromCents(toCents(perCardShip));
    const totalFees = fromCents(toCents(commission + processing + shipping));
    const netEarnings = fromCents(toCents(price - totalFees));

    return {
      commission,
      processing,
      shipping,
      totalFees,
      netEarnings,
    };
  }

  function calculateProfitForSale(price, costs) {
    const fees = feeBreakdownForSale(
      price,
      costs.commissionPct,
      costs.processingPct,
      costs.processingFixed,
      costs.perCardShip,
    );

    const cogs = fromCents(toCents(costs.cardCost + costs.freebieCost));
    const netProfit = fromCents(toCents(fees.netEarnings - cogs));

    return {
      ...fees,
      cogs,
      netProfit,
    };
  }

  function findBreakEven(costs) {
    const effectiveRate = 1 - (costs.commissionPct + costs.processingPct) / 100;
    const rough = effectiveRate > 0 ? (costs.cardCost + costs.freebieCost + costs.perCardShip + costs.processingFixed) / effectiveRate : 0;
    const upperDollars = Math.max(5, Math.ceil(rough + 10));
    const upperCents = upperDollars * 100;

    for (let cents = 0; cents <= upperCents; cents += 1) {
      const price = fromCents(cents);
      const outcome = calculateProfitForSale(price, costs);
      if (outcome.netProfit >= 0) return price;
    }

    return fromCents(upperCents);
  }

  function renderBreakdown(data) {
    if (!data) {
      els.breakdownInner.innerHTML = '<p class="row">Enter card cost to see breakdown.</p>';
      return;
    }

    const profitClass = data.netProfit >= 0 ? 'profit-pos' : 'profit-neg';

    els.breakdownInner.innerHTML = `
      <div class="row"><span>Sale price</span><strong class="revenue">${currency(data.recommended)}</strong></div>
      <div class="row"><span>Card cost</span><strong class="cost">-${currency(data.cardCost)}</strong></div>
      <div class="row"><span>Freebie cost</span><strong class="cost">-${currency(data.freebieCost)}</strong></div>
      <div class="row"><span>Commission (${data.commissionPct.toFixed(1)}%)</span><strong class="cost">-${currency(data.commission)}</strong></div>
      <div class="row"><span>Processing (${data.processingPct.toFixed(1)}% + ${currency(data.processingFixed)})</span><strong class="cost">-${currency(data.processing)}</strong></div>
      <div class="row"><span>Shipping / card</span><strong class="cost">-${currency(data.shipping)}</strong></div>
      <div class="row"><span>Total fees</span><strong class="cost">-${currency(data.totalFees)}</strong></div>
      <div class="row"><span>Net earnings</span><strong class="revenue">${currency(data.netEarnings)}</strong></div>
      <div class="row total"><span>Net profit</span><strong class="${profitClass}">${data.netProfit >= 0 ? '+' : ''}${currency(data.netProfit)}</strong></div>
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

    const costs = {
      cardCost,
      freebieCost: Math.max(0, toNumber(els.freebieCost.value) || 0),
      perCardShip: getPerCardShip(),
      commissionPct: Math.min(100, Math.max(0, toNumber(els.platformFeePct.value) || 8)),
      processingPct: Math.min(100, Math.max(0, toNumber(els.processingPct.value) || 2.9)),
      processingFixed: Math.max(0, toNumber(els.processingFixed.value) || 0.3),
    };

    const breakEven = findBreakEven(costs);
    const recommendedRaw = breakEven * (1 + currentBuffer);
    const recommended = ceilQuarter(recommendedRaw);
    const recommendedOutcome = calculateProfitForSale(recommended, costs);

    currentRecommended = recommended;
    els.breakEvenVal.textContent = currency(breakEven);
    els.recommendVal.textContent = currency(recommended);
    els.profitVal.textContent = `${recommendedOutcome.netProfit >= 0 ? '+' : ''}${currency(recommendedOutcome.netProfit)}`;
    els.recommendHint.textContent = `${Math.round(currentBuffer * 100)}% buffer + rounded to nearest $0.25`;
    els.profitCard.classList.toggle('negative', recommendedOutcome.netProfit < 0);
    els.copyBtn.disabled = false;

    renderBreakdown({
      recommended,
      ...costs,
      ...recommendedOutcome,
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
      platformFeePct: els.platformFeePct.value,
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
      if (typeof data.platformFeePct === 'string') els.platformFeePct.value = data.platformFeePct;
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
    els.platformFeePct,
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
    const snippet = `Start: ${currency(currentRecommended)} | Break-even: ${els.breakEvenVal.textContent} | Buffer: ${Math.round(currentBuffer * 100)}%`;

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
    els.platformFeePct.value = '8';
    els.processingPct.value = '2.9';
    els.processingFixed.value = '0.30';
    els.bufferBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.buffer === '0.15'));
    currentBuffer = 0.15;
    localStorage.removeItem(STORAGE_KEY);
    setEmptyState();
    getPerCardShip();
    els.cardCost.focus();
  });

  restoreInputs();
  calculate();
  els.cardCost.focus();
})();
