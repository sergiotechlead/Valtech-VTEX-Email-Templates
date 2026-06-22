'use strict';

// Handlebars helpers — mirrors VTEX's built-in helpers so templates
// work identically in local preview and in production.

module.exports = {

  // ── Currency ───────────────────────────────────────────────────────────────
  // VTEX stores prices as integers in the smallest currency unit (cents).
  // Usage: {{formatCurrency value}} → "€135,00"
  // Options: locale="fr-FR" currency="EUR"
  formatCurrency(value, options) {
    const cents = typeof value === 'number' ? value : Number(value) || 0;
    const amount = cents / 100;
    const hash = (options && options.hash) || {};
    const locale = hash.locale || 'fr-FR';
    const currency = hash.currency || 'EUR';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  },

  // ── Date ───────────────────────────────────────────────────────────────────
  // Usage: {{formatDate creationDate}} → "22 juin 2026"
  // Options: locale="fr-FR" dateStyle="long"
  formatDate(value, options) {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date)) return String(value);
    const hash = (options && options.hash) || {};
    const locale = hash.locale || 'fr-FR';
    const opts = hash.dateStyle
      ? { dateStyle: hash.dateStyle }
      : { year: 'numeric', month: 'long', day: 'numeric' };
    return new Intl.DateTimeFormat(locale, opts).format(date);
  },

  // ── Comparison ─────────────────────────────────────────────────────────────
  eq(a, b) { return a === b; },
  ne(a, b) { return a !== b; },
  gt(a, b) { return Number(a) > Number(b); },
  lt(a, b) { return Number(a) < Number(b); },
  gte(a, b) { return Number(a) >= Number(b); },
  lte(a, b) { return Number(a) <= Number(b); },

  // ── Logical ────────────────────────────────────────────────────────────────
  and(...args) {
    const opts = args.pop();
    return args.every(Boolean) ? opts.fn(this) : opts.inverse(this);
  },
  or(...args) {
    const opts = args.pop();
    return args.some(Boolean) ? opts.fn(this) : opts.inverse(this);
  },
  not(value, options) {
    return !value ? options.fn(this) : options.inverse(this);
  },

  // ── Math ───────────────────────────────────────────────────────────────────
  add(a, b) { return Number(a) + Number(b); },
  subtract(a, b) { return Number(a) - Number(b); },
  multiply(a, b) { return Number(a) * Number(b); },
  divide(a, b) { return Number(b) !== 0 ? Number(a) / Number(b) : 0; },
  percent(value, total) {
    return total ? Math.round((Number(value) / Number(total)) * 100) : 0;
  },

  // ── String ─────────────────────────────────────────────────────────────────
  uppercase(str) { return str ? String(str).toUpperCase() : ''; },
  lowercase(str) { return str ? String(str).toLowerCase() : ''; },
  capitalize(str) {
    if (!str) return '';
    return String(str).charAt(0).toUpperCase() + String(str).slice(1).toLowerCase();
  },
  concat(...args) {
    args.pop(); // remove options
    return args.join('');
  },
  replace(str, search, replacement) {
    return str ? String(str).split(search).join(replacement) : '';
  },
  trim(str) { return str ? String(str).trim() : ''; },
  truncate(str, length, suffix) {
    if (!str) return '';
    const s = String(str);
    const suf = typeof suffix === 'string' ? suffix : '…';
    return s.length > length ? s.slice(0, length) + suf : s;
  },

  // ── Array / Object ─────────────────────────────────────────────────────────
  first(arr) { return Array.isArray(arr) ? arr[0] : undefined; },
  last(arr) { return Array.isArray(arr) ? arr[arr.length - 1] : undefined; },
  count(arr) { return Array.isArray(arr) ? arr.length : 0; },
  includes(arr, value) { return Array.isArray(arr) && arr.includes(value); },

  // ── Default ────────────────────────────────────────────────────────────────
  default(value, fallback) {
    return (value !== null && value !== undefined && value !== '') ? value : fallback;
  },

  // ── Debug ──────────────────────────────────────────────────────────────────
  // Usage: {{json someObject}} — renders JSON in the email for debugging
  json(obj) {
    return JSON.stringify(obj, null, 2);
  },

  // ── Repeat ─────────────────────────────────────────────────────────────────
  times(n, options) {
    let result = '';
    for (let i = 0; i < n; i++) result += options.fn(i);
    return result;
  },

  // ── Index (0-based) inside #each ───────────────────────────────────────────
  // Usage: {{add @index 1}} → 1, 2, 3 …
  // (no helper needed — Handlebars provides @index natively)

  // ── VTEX-specific ──────────────────────────────────────────────────────────
  // Format order status label
  orderStatusLabel(status) {
    const map = {
      'payment-pending':        'Paiement en attente',
      'payment-approved':       'Paiement approuvé',
      'ready-for-handling':     'En préparation',
      'handling':               'En cours de traitement',
      'invoiced':               'Expédiée',
      'order-completed':        'Livrée',
      'canceled':               'Annulée',
      'cancellation-requested': 'Annulation en cours',
    };
    return map[status] || status;
  },

  // Join address into a single string
  formatAddress(address) {
    if (!address) return '';
    const parts = [
      address.street,
      address.number,
      address.complement,
      address.city,
      address.postalCode,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  },

  // Mask card number: "•••• 4242"
  maskCard(lastDigits) {
    return lastDigits ? `•••• ${lastDigits}` : '';
  },

  // ── VTEX block helpers ─────────────────────────────────────────────────────
  // {{#compare a 'op' b}}...{{else}}...{{/compare}}
  compare(a, operator, b, options) {
    const ops = {
      '==':  a == b,
      '===': a === b,
      '!=':  a != b,
      '!==': a !== b,
      '>':   Number(a) > Number(b),
      '<':   Number(a) < Number(b),
      '>=':  Number(a) >= Number(b),
      '<=':  Number(a) <= Number(b),
    };
    const result = Object.prototype.hasOwnProperty.call(ops, operator) ? ops[operator] : false;
    return result ? options.fn(this) : options.inverse(this);
  },

  // {{#math index '+' 1}}{{/math}} — inline arithmetic
  math(a, operator, b, options) {
    const n = { '+': +a + +b, '-': +a - +b, '*': +a * +b, '/': +b !== 0 ? +a / +b : 0 };
    return n[operator] !== undefined ? String(n[operator]) : '';
  },

  // {{#group arr by="prop"}}...{{/group}} — iterate over grouped sub-arrays
  group(arr, options) {
    const by = options.hash && options.hash.by;
    if (!Array.isArray(arr)) return options.inverse(this);
    if (!by) return options.fn(arr);
    const seen = [];
    const groups = [];
    arr.forEach(item => {
      const key = item[by];
      if (!seen.includes(key)) { seen.push(key); groups.push([]); }
      groups[seen.indexOf(key)].push(item);
    });
    return groups.map(g => options.fn(g)).join('');
  },

  // {{#richShippingData shippingData}}...{{/richShippingData}}
  richShippingData(data, options) {
    return options.fn(data || {});
  },
};
