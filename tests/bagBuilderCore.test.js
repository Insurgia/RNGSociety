const test = require('node:test');
const assert = require('node:assert/strict');

const Core = require('../bagBuilderCore.js');

test('bagId generation is unique for increasing sequence', () => {
  const ids = new Set();
  for (let i = 1; i <= 200; i += 1) ids.add(Core.generateBagId(i));
  assert.equal(ids.size, 200);
  assert.equal(Core.generateBagId(1), 'BAG-00001');
});

test('totals calculation only counts IN_BAG items', () => {
  const totals = Core.buildTotals([
    { qty: 2, salePrice: 3.5, weightGrams: 10, status: Core.ITEM_STATUS.IN_BAG },
    { qty: 1, salePrice: 99, weightGrams: 50, status: Core.ITEM_STATUS.REMOVED }
  ]);
  assert.equal(totals.totalItems, 2);
  assert.equal(totals.totalValue, 7);
  assert.equal(totals.totalWeightGrams, 20);
});

test('overdue detection ignores shipped or archived', () => {
  const base = { deadlineAt: '2025-01-01T00:00:00.000Z' };
  assert.equal(Core.isOverdue({ ...base, status: Core.STATUS.OPEN }, '2025-02-01T00:00:00.000Z'), true);
  assert.equal(Core.isOverdue({ ...base, status: Core.STATUS.SHIPPED }, '2025-02-01T00:00:00.000Z'), false);
  assert.equal(Core.isOverdue({ ...base, status: Core.STATUS.ARCHIVED }, '2025-02-01T00:00:00.000Z'), false);
});

test('summary csv formatting includes required columns', () => {
  const db = Core.createEmptyDb();
  const customer = { id: 'c1', username: 'user1', platform: 'whatnot' };
  db.customers.push(customer);
  db.bags.push({ id: 'b1', bagId: 'BAG-00001', customerId: 'c1', status: Core.STATUS.OPEN, lastActivityAt: '2025-01-01', deadlineAt: '2025-03-01' });
  db.items.push({ bagId: 'b1', qty: 2, salePrice: 4, weightGrams: 5, status: Core.ITEM_STATUS.IN_BAG });

  const csv = Core.exportBagsSummaryCsv(db, '2025-02-01T00:00:00.000Z');
  assert.match(csv.split('\n')[0], /bagId,username,status,totalItems,totalValue,totalWeightGrams,lastActivityAt,deadlineAt,overdue/);
  assert.match(csv, /BAG-00001,user1,OPEN,2,8.00,10/);
});

test('auth db creates default admin and verifies password', () => {
  const auth = Core.createDefaultAuthDb();
  assert.equal(auth.users.length, 1);
  assert.equal(auth.users[0].username, 'admin');
  assert.equal(auth.users[0].role, 'admin');
  assert.equal(Core.verifyPassword(auth.users[0], 'admin123'), true);
  assert.equal(Core.verifyPassword(auth.users[0], 'wrong'), false);
});
