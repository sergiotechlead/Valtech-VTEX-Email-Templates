'use strict';

const express = require('express');
const { engine } = require('express-handlebars');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

// ── Email Helpers ─────────────────────────────────────────────────────────────
const helpers = require('./helpers/email');
Object.entries(helpers).forEach(([name, fn]) => Handlebars.registerHelper(name, fn));

// ── Email Partials ────────────────────────────────────────────────────────────
function loadEmailPartials() {
  const dir = path.join(ROOT, 'templates/partials');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.hbs')) {
      const name = path.basename(file, '.hbs');
      Handlebars.registerPartial(name, fs.readFileSync(path.join(dir, file), 'utf8'));
    }
  }
}
loadEmailPartials();

// ── Template Discovery ────────────────────────────────────────────────────────
const TEMPLATE_META = {
  '01-vtexcommerce-new-order':                          { label: 'New Order',               description: 'Merci pour votre commande' },
  '02-vtexcommerce-payment-approved':                   { label: 'Payment Approved',        description: 'Votre paiement a été confirmé' },
  '03-vtexcommerce-order-invoiced':                     { label: 'Order Invoiced',          description: 'Votre facture est disponible' },
  '04-vtexcommerce-order-shipped':                      { label: 'Order Shipped',           description: 'Votre commande est en route' },
  '05-vtexcommerce-shipping-update':                    { label: 'Shipping Update',         description: 'Une mise à jour sur votre livraison' },
  '06-vtexcommerce-order-shipping-finished':            { label: 'Order Delivered',         description: 'Votre commande a été livrée' },
  '07-vtexcommerce-order-cancelled':                    { label: 'Order Cancelled',         description: 'Votre commande a été annulée' },
  '08-vtexcommerce-payment-denied':                     { label: 'Payment Denied',          description: 'Un problème avec votre paiement' },
  '09-vtexcommerce-order-refunded':                     { label: 'Order Refunded',          description: 'Votre remboursement est en cours' },
  '10-vtexcommerce-replace-order':                      { label: 'Replace Order',           description: 'Votre nouvelle commande est confirmée' },
  '11-vtexcommerce-order-shipped-with-cancel-request':  { label: 'Shipped + Cancel',        description: 'Votre commande est en route – Annulation en cours' },
  '12-portal-avise-me':                                 { label: 'Back in Stock',           description: 'L\'article que vous attendiez est de retour' },
  '13-vtexid_check_email':                              { label: 'Email Verification',      description: 'Confirmez votre adresse e-mail' },
  '14-order-invoice-custom':                            { label: 'Invoice',                 description: 'Votre facture est prête' },
  '15-oms-order-report':                                { label: 'Orders Report',           description: 'Rapport de commandes disponible' },
  '16-vtex-payment-report':                             { label: 'VTEX Payment Report',     description: 'Rapport de paiement VTEX disponible' },
  '17-vtex-payment-status-update':                      { label: 'Payment Status Update',   description: 'Mise à jour du statut de paiement' },
  '18-vtexcommerce-order-change-payment':               { label: 'Payment Change',          description: 'Modification du paiement de votre commande' },
  '19-vtexcommerce-payment-pending':                    { label: 'Payment Pending',         description: 'En attente de votre paiement' },
  '20-vtexcommerce-subscriptions-payment-not-approved': { label: 'Subscription Payment Failed', description: 'Paiement de l\'abonnement non approuvé' },
  '21-report-report-finished':                          { label: 'Report Finished',             description: 'Votre rapport est disponible' },
};

function getTemplates(activeName = null) {
  const dir = path.join(ROOT, 'templates');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.hbs'))
    .map(file => {
      const name = path.basename(file, '.hbs');
      const meta = TEMPLATE_META[name] || {};
      return {
        name,
        label: meta.label || name.replace(/^\d+-/, '').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
        description: meta.description || '',
        hasData: fs.existsSync(path.join(ROOT, 'data', 'vtex', `${name}.json`)),
        active: name === activeName,
      };
    });
}

// ── Email Rendering ───────────────────────────────────────────────────────────
function renderEmail(name, overrideData = null) {
  const tplPath = path.join(ROOT, 'templates', `${name}.hbs`);
  const dataPath = path.join(ROOT, 'data', 'vtex', `${name}.json`);

  if (!fs.existsSync(tplPath)) throw new Error(`Template "${name}" not found`);

  const src = fs.readFileSync(tplPath, 'utf8');
  const compile = Handlebars.compile(src);

  let data = {};
  if (overrideData && typeof overrideData === 'object') {
    data = overrideData;
  } else if (fs.existsSync(dataPath)) {
    data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }

  return { html: compile(data), data };
}

// ── Express Setup ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(ROOT, 'public')));

app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: path.join(ROOT, 'views/layouts'),
}));
app.set('view engine', 'hbs');
app.set('views', path.join(ROOT, 'views'));

// ── SSE Live Reload ───────────────────────────────────────────────────────────
const sseClients = new Set();

app.get('/sse', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('data: connected\n\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

function broadcast(msg) {
  for (const res of sseClients) res.write(`data: ${msg}\n\n`);
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.render('index', {
    pageTitle: 'Home',
    templates: getTemplates(),
  });
});

app.get('/preview/:name', (req, res) => {
  const { name } = req.params;
  try {
    const { data } = renderEmail(name);

    if ('raw' in req.query) {
      const { html } = renderEmail(name);
      return res.type('html').send(html);
    }

    const templates = getTemplates(name);
    const current = templates.findIndex(t => t.name === name);
    const prev = templates[current - 1] || null;
    const next = templates[current + 1] || null;
    const meta = TEMPLATE_META[name] || {};
    const label = meta.label || name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

    res.render('preview', {
      pageTitle: label,
      currentTemplate: name,
      name,
      label,
      templates,
      prev,
      next,
      jsonData: JSON.stringify(data, null, 2),
    });
  } catch (err) {
    res.status(404).render('error', {
      pageTitle: 'Error',
      templates: getTemplates(),
      message: err.message,
    });
  }
});

app.post('/render/:name', (req, res) => {
  try {
    const { html } = renderEmail(req.params.name, req.body);
    res.json({ html });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/download/:name', (req, res) => {
  try {
    const { html } = renderEmail(req.params.name);
    res.set('Content-Disposition', `attachment; filename="${req.params.name}.html"`);
    res.type('html').send(html);
  } catch (err) {
    res.status(404).send(err.message);
  }
});

// ── File Watcher ──────────────────────────────────────────────────────────────
chokidar.watch(
  ['templates', 'data/vtex', 'views'].map(d => path.join(ROOT, d)),
  { ignoreInitial: true }
).on('all', (event, filePath) => {
  const rel = path.relative(ROOT, filePath);
  console.log(`  [${event}] ${rel}`);
  if (rel.startsWith('templates/partials')) loadEmailPartials();
  broadcast('reload');
});

// ── Start ─────────────────────────────────────────────────────────────────────
function startServer(port) {
  const server = app.listen(port, () => {
    console.log('\n────────────────────────────────────────────');
    console.log('  VTEX Email Templates — Preview Server');
    console.log(`  http://localhost:${port}`);
    console.log('────────────────────────────────────────────');
    console.log('  Watching: templates/  data/  views/');
    console.log('────────────────────────────────────────────\n');
  });
  server.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.log(`  Port ${port} in use, trying ${port + 1}…`);
      startServer(port + 1);
    } else {
      throw err;
    }
  });
}

startServer(PORT);
