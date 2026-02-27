(function (global) {
  'use strict';

  const STATUS = {
    OPEN: 'OPEN',
    READY_TO_SHIP: 'READY_TO_SHIP',
    SHIPPING_PAID: 'SHIPPING_PAID',
    PACKED: 'PACKED',
    SHIPPED: 'SHIPPED',
    ARCHIVED: 'ARCHIVED',
    HOLD: 'HOLD'
  };

  const ITEM_STATUS = {
    IN_BAG: 'IN_BAG',
    REMOVED: 'REMOVED',
    SWAPPED: 'SWAPPED',
    RETURNED: 'RETURNED'
  };

  const TYPE = {
    SINGLE: 'SINGLE',
    SLAB: 'SLAB',
    SEALED: 'SEALED',
    ACCESSORY: 'ACCESSORY',
    OTHER: 'OTHER'
  };

  const defaultSettings = {
    deadlineDays: 60,
    highValueThreshold: 150,
    inactivityThresholds: [30, 45, 60],
    weightPresets: {
      rawTopLoader: 18,
      slab: 110,
      boosterPack: 28,
      boosterBox: 820,
      packaging: 65
    }
  };

  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function hashPassword(raw) {
    const s = String(raw || '');
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(s)));
    return Buffer.from(s, 'utf8').toString('base64');
  }

  function createDefaultAuthDb() {
    const now = new Date().toISOString();
    return {
      version: 1,
      users: [{ id: uid(), username: 'admin', passwordHash: hashPassword('admin123'), role: 'admin', isPro: true, enabled: true, createdAt: now }],
      sessionUserId: null
    };
  }

  function migrateAuthDb(db) {
    const next = db && typeof db === 'object' ? db : createDefaultAuthDb();
    if (!next.version) next.version = 1;
    next.users = Array.isArray(next.users) ? next.users : [];
    if (!next.users.length) next.users = createDefaultAuthDb().users;
    next.sessionUserId = next.sessionUserId || null;
    next.users = next.users.map((u) => ({
      id: u.id || uid(),
      username: String(u.username || '').trim(),
      passwordHash: u.passwordHash || hashPassword('changeme'),
      role: u.role === 'admin' ? 'admin' : 'user',
      isPro: !!u.isPro,
      enabled: u.enabled !== false,
      createdAt: u.createdAt || new Date().toISOString()
    }));
    return next;
  }

  function verifyPassword(user, raw) {
    return !!user && user.passwordHash === hashPassword(raw);
  }

  function createEmptyDb() {
    return {
      version: 1,
      nextBagSeq: 1,
      customers: [],
      bags: [],
      items: [],
      sessions: [],
      auditLogs: [],
      settings: { ...defaultSettings }
    };
  }

  function migrateDb(db) {
    const next = db && typeof db === 'object' ? db : createEmptyDb();
    if (!next.version) next.version = 1;
    if (!next.nextBagSeq || next.nextBagSeq < 1) next.nextBagSeq = 1;
    next.customers = Array.isArray(next.customers) ? next.customers : [];
    next.bags = Array.isArray(next.bags) ? next.bags : [];
    next.items = Array.isArray(next.items) ? next.items : [];
    next.sessions = Array.isArray(next.sessions) ? next.sessions : [];
    next.auditLogs = Array.isArray(next.auditLogs) ? next.auditLogs : [];
    next.settings = { ...defaultSettings, ...(next.settings || {}), weightPresets: { ...defaultSettings.weightPresets, ...((next.settings || {}).weightPresets || {}) } };
    return next;
  }

  function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
  }

  function generateBagId(seq) {
    return `BAG-${String(seq).padStart(5, '0')}`;
  }

  function buildTotals(items) {
    const active = items.filter((x) => x.status === ITEM_STATUS.IN_BAG);
    return active.reduce((acc, item) => {
      const qty = Number(item.qty) || 0;
      acc.totalItems += qty;
      acc.totalValue += qty * (Number(item.salePrice) || 0);
      acc.totalWeightGrams += qty * (Number(item.weightGrams) || 0);
      return acc;
    }, { totalItems: 0, totalValue: 0, totalWeightGrams: 0 });
  }

  function isOverdue(bag, nowIso) {
    const now = nowIso ? new Date(nowIso) : new Date();
    if (!bag.deadlineAt) return false;
    if ([STATUS.SHIPPED, STATUS.ARCHIVED].includes(bag.status)) return false;
    return now.getTime() > new Date(bag.deadlineAt).getTime();
  }

  function estimateShippingClass(weightGrams) {
    if (weightGrams <= 99) return 'LETTER';
    if (weightGrams <= 499) return 'SMALL_PACKET';
    if (weightGrams <= 1999) return 'PARCEL';
    return 'HEAVY_PARCEL';
  }

  function csvCell(value) {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  }

  function exportBagCsv(bag, customer, items) {
    const header = ['bagId', 'customer', 'platform', 'status', 'itemName', 'qty', 'salePrice', 'type', 'streamId', 'addedAt'];
    const rows = items.map((i) => [bag.bagId, customer.username, customer.platform, bag.status, i.name, i.qty, i.salePrice, i.type, i.streamId || '', i.addedAt || '']);
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  }

  function exportBagsSummaryCsv(db, nowIso) {
    const header = ['bagId', 'username', 'status', 'totalItems', 'totalValue', 'totalWeightGrams', 'lastActivityAt', 'deadlineAt', 'overdue'];
    const rows = db.bags.map((bag) => {
      const customer = db.customers.find((c) => c.id === bag.customerId) || { username: '' };
      const totals = buildTotals(db.items.filter((i) => i.bagId === bag.id));
      return [bag.bagId, customer.username, bag.status, totals.totalItems, totals.totalValue.toFixed(2), totals.totalWeightGrams, bag.lastActivityAt, bag.deadlineAt, isOverdue(bag, nowIso) ? 'yes' : 'no'];
    });
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  }

  function validTransition(from, to) {
    const flow = {
      OPEN: ['READY_TO_SHIP', 'HOLD', 'ARCHIVED'],
      HOLD: ['OPEN', 'READY_TO_SHIP', 'ARCHIVED'],
      READY_TO_SHIP: ['SHIPPING_PAID', 'HOLD', 'OPEN', 'ARCHIVED'],
      SHIPPING_PAID: ['PACKED', 'HOLD', 'ARCHIVED'],
      PACKED: ['SHIPPED', 'HOLD', 'ARCHIVED'],
      SHIPPED: ['ARCHIVED'],
      ARCHIVED: ['OPEN']
    };
    return (flow[from] || []).includes(to);
  }

  const api = { STATUS, ITEM_STATUS, TYPE, defaultSettings, uid, hashPassword, createDefaultAuthDb, migrateAuthDb, verifyPassword, createEmptyDb, migrateDb, normalizeUsername, generateBagId, buildTotals, isOverdue, estimateShippingClass, exportBagCsv, exportBagsSummaryCsv, validTransition };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.BagBuilderCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
