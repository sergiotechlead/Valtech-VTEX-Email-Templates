'use strict';

// Build script — compiles all email templates with their JSON data
// and writes rendered HTML files to dist/
//
// Usage: node build.js
//        node build.js confirm-email   (build only one template)

const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const helpers = require('./helpers/email');
Object.entries(helpers).forEach(([name, fn]) => Handlebars.registerHelper(name, fn));

// Load partials
const partialsDir = path.join(ROOT, 'templates/partials');
if (fs.existsSync(partialsDir)) {
  for (const file of fs.readdirSync(partialsDir)) {
    if (file.endsWith('.hbs')) {
      const name = path.basename(file, '.hbs');
      Handlebars.registerPartial(name, fs.readFileSync(path.join(partialsDir, file), 'utf8'));
    }
  }
}

// Discover templates
const filter = process.argv[2]; // optional: build only one template
const templatesDir = path.join(ROOT, 'templates');
const names = fs.readdirSync(templatesDir).filter(n => {
  const full = path.join(templatesDir, n);
  return fs.statSync(full).isDirectory() && n !== 'partials' && (!filter || n === filter);
});

if (!fs.existsSync(DIST)) fs.mkdirSync(DIST);

let built = 0;
let failed = 0;

for (const name of names) {
  const tplPath = path.join(ROOT, 'templates', name, 'template.hbs');
  const dataPath = path.join(ROOT, 'data', `${name}.json`);
  const outPath = path.join(DIST, `${name}.html`);

  if (!fs.existsSync(tplPath)) {
    console.warn(`  [SKIP]  ${name} — template.hbs not found`);
    continue;
  }

  try {
    const src = fs.readFileSync(tplPath, 'utf8');
    const data = fs.existsSync(dataPath)
      ? JSON.parse(fs.readFileSync(dataPath, 'utf8'))
      : {};

    const html = Handlebars.compile(src)(data);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`  [OK]    ${name} → dist/${name}.html`);
    built++;
  } catch (err) {
    console.error(`  [ERROR] ${name} — ${err.message}`);
    failed++;
  }
}

console.log(`\nBuild complete: ${built} compiled, ${failed} failed → dist/`);
