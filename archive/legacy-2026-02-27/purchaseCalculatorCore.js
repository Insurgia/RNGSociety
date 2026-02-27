(function (global) {
  'use strict';

  const defaultPurchaseSettings = {
    platformFeePercent: 12,
    paymentProcessingPercent: 3,
    underperformRatePercent: 15,
    targetProfitPercent: 25,
    shippingMaterialPerOrder: 0,
    protectBangers: true,
    protectBangersThreshold: 75,
    fairDealMode: false,
    tierRules: [
      { maxMarket: 3, tier: '$1' },
      { maxMarket: 6, tier: '$2' },
      { maxMarket: 12, tier: '$3' },
      { maxMarket: 25, tier: '$5' },
      { maxMarket: 45, tier: '$10' },
      { maxMarket: 75, tier: '$15+' },
      { maxMarket: Infinity, tier: 'Fixed Price' }
    ],
    tierMultipliers: [
      { maxMarket: 3, multiplier: 0.9 },
      { maxMarket: 6, multiplier: 0.85 },
      { maxMarket: 12, multiplier: 0.8 },
      { maxMarket: 25, multiplier: 0.75 },
      { maxMarket: 45, multiplier: 0.7 },
      { maxMarket: 75, multiplier: 0.67 },
      { maxMarket: Infinity, multiplier: 0.62 }
    ]
  };

  function normalizeSettings(input) {
    const s = { ...defaultPurchaseSettings, ...(input || {}) };
    s.tierRules = Array.isArray(s.tierRules) ? s.tierRules : defaultPurchaseSettings.tierRules;
    s.tierMultipliers = Array.isArray(s.tierMultipliers) ? s.tierMultipliers : defaultPurchaseSettings.tierMultipliers;
    return s;
  }

  function multiplierForMarket(marketValue, settings) {
    const rule = settings.tierMultipliers.find((r) => Number(marketValue) <= Number(r.maxMarket));
    return rule ? Number(rule.multiplier) : 0.62;
  }

  function suggestedTier(row, settings) {
    const market = Number(row.marketValue) || 0;
    if (settings.protectBangers && market >= Number(settings.protectBangersThreshold || 75)) return 'Fixed Price';
    const rule = settings.tierRules.find((r) => market <= Number(r.maxMarket));
    return rule ? rule.tier : 'Fixed Price';
  }

  function analyzeRow(row, settings) {
    const qty = Math.max(1, Number.parseInt(row.qty, 10) || 1);
    const marketValue = Math.max(0, Number(row.marketValue) || 0);
    const multiplier = multiplierForMarket(marketValue, settings);
    const expectedClose = marketValue * multiplier;
    const totalFeePercent = (Number(settings.platformFeePercent) + Number(settings.paymentProcessingPercent)) / 100;
    const netAfterFees = expectedClose * (1 - totalFeePercent) - Number(settings.shippingMaterialPerOrder || 0);
    const riskAdjustedNet = netAfterFees * (1 - Number(settings.underperformRatePercent) / 100);
    const tier = suggestedTier(row, settings);

    return {
      ...row,
      qty,
      marketValue,
      multiplier,
      expectedClose,
      netAfterFees,
      riskAdjustedNet,
      suggestedStartTier: tier,
      totalMarket: marketValue * qty,
      totalExpectedClose: expectedClose * qty,
      totalNetAfterFees: netAfterFees * qty,
      totalRiskAdjustedNet: riskAdjustedNet * qty
    };
  }

  function aggregateResults(rows, settings) {
    const analyzedRows = rows.map((row) => analyzeRow(row, settings));
    const totals = analyzedRows.reduce((acc, row) => {
      acc.totalMarket += row.totalMarket;
      acc.estimatedStreamGross += row.totalExpectedClose;
      acc.estimatedNetAfterFees += row.totalNetAfterFees;
      acc.riskAdjustedNet += row.totalRiskAdjustedNet;
      return acc;
    }, { totalMarket: 0, estimatedStreamGross: 0, estimatedNetAfterFees: 0, riskAdjustedNet: 0 });

    const targetProfitPercent = Number(settings.targetProfitPercent) / 100;
    const recommendedMaxOffer = totals.riskAdjustedNet * (1 - targetProfitPercent);
    const maxOfferBeforeRisk = totals.estimatedNetAfterFees * (1 - targetProfitPercent);
    const breakEvenOffer = totals.riskAdjustedNet;

    const grouped = { '$1': [], '$2': [], '$3': [], '$5': [], '$10': [], '$15+': [], 'Fixed Price': [] };
    analyzedRows.forEach((row) => {
      if (!grouped[row.suggestedStartTier]) grouped[row.suggestedStartTier] = [];
      grouped[row.suggestedStartTier].push(row);
    });

    return { analyzedRows, totals, recommendedMaxOffer, maxOfferBeforeRisk, breakEvenOffer, grouped };
  }

  function scenarioRange(baseResults) {
    const pessimistic = baseResults.estimatedStreamGross * 0.9;
    const optimistic = baseResults.estimatedStreamGross * 1.1;
    return { pessimistic, base: baseResults.estimatedStreamGross, optimistic };
  }

  function parseBulkPaste(text) {
    const lines = String(text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
    return lines.map((line) => {
      const parts = line.split('-').map((x) => x.trim());
      if (parts.length >= 3) {
        const name = parts[0];
        const qty = Number.parseInt(parts[1].replace(/[^0-9]/g, ''), 10) || 1;
        const marketValue = Number(parts[2].replace(/[^0-9.]/g, '')) || 0;
        return { cardName: name, set: '', condition: '', qty, marketValue, confidence: 1 };
      }
      const fallbackVal = Number(line.match(/\$?([0-9]+(?:\.[0-9]+)?)/)?.[1] || 0);
      return { cardName: line.replace(/\$?[0-9]+(?:\.[0-9]+)?/, '').trim() || line, set: '', condition: '', qty: 1, marketValue: fallbackVal, confidence: 1 };
    });
  }

  function exportRowsCsv(rows) {
    const header = ['cardName', 'set', 'condition', 'qty', 'marketValue', 'expectedClose', 'netAfterFees', 'riskAdjustedNet', 'suggestedStartTier'];
    const csvRows = rows.map((r) => [r.cardName, r.set || '', r.condition || '', r.qty, r.marketValue.toFixed(2), r.expectedClose.toFixed(2), r.netAfterFees.toFixed(2), r.riskAdjustedNet.toFixed(2), r.suggestedStartTier]);
    return [header, ...csvRows].map((row) => row.map(csvCell).join(',')).join('\n');
  }

  function exportTierCsv(grouped) {
    const header = ['tier', 'cardName', 'qty', 'marketValue', 'expectedClose', 'recommendedStart'];
    const rows = [];
    Object.keys(grouped).forEach((tier) => {
      grouped[tier].forEach((r) => rows.push([tier, r.cardName, r.qty, r.marketValue.toFixed(2), r.expectedClose.toFixed(2), r.suggestedStartTier]));
    });
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  }

  function csvCell(value) {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }

  const api = {
    defaultPurchaseSettings,
    normalizeSettings,
    multiplierForMarket,
    suggestedTier,
    analyzeRow,
    aggregateResults,
    scenarioRange,
    parseBulkPaste,
    exportRowsCsv,
    exportTierCsv
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PurchaseCalculatorCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
