const test = require('node:test');
const assert = require('node:assert/strict');

const PCore = require('../purchaseCalculatorCore.js');

test('expectedClose calculation uses bracket multiplier', () => {
  const settings = PCore.normalizeSettings();
  const row = PCore.analyzeRow({ cardName: 'Card A', qty: 1, marketValue: 10 }, settings);
  assert.equal(row.expectedClose, 8);
});

test('tier assignment protects bangers', () => {
  const settings = PCore.normalizeSettings({ protectBangers: true, protectBangersThreshold: 75 });
  const tier = PCore.suggestedTier({ marketValue: 120 }, settings);
  assert.equal(tier, 'Fixed Price');
});

test('maxOffer calculation follows risk-adjusted target', () => {
  const settings = PCore.normalizeSettings({ targetProfitPercent: 25, underperformRatePercent: 10, platformFeePercent: 10, paymentProcessingPercent: 0 });
  const result = PCore.aggregateResults([{ cardName: 'X', qty: 1, marketValue: 100 }], settings);
  assert.ok(result.recommendedMaxOffer > 0);
  assert.equal(result.recommendedMaxOffer.toFixed(2), (result.totals.riskAdjustedNet * 0.75).toFixed(2));
});

test('bulk paste parser reads Name - qty - $value', () => {
  const rows = PCore.parseBulkPaste('Charizard - 2 - $35\nPikachu - 1 - $4');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].cardName, 'Charizard');
  assert.equal(rows[0].qty, 2);
  assert.equal(rows[0].marketValue, 35);
});
