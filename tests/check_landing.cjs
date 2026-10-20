// Exercise the real landing-page script offline. Browser layout is not assessed.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const pagePath = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
const root = path.dirname(pagePath);
const html = fs.readFileSync(pagePath, 'utf8');
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attrs = text => Object.fromEntries([...text.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
  .map(([, name, double, single, bare]) => [name, decode(double ?? single ?? bare ?? '')]));
const tags = [...html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)].map(([, name, attributes]) => ({name: name.toLowerCase(), attributes: attrs(attributes)}));
const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(source, 'The landing page needs an executable inline script');
assert.ok(!/@@[A-Z_]+@@/.test(html), 'No generation markers may remain');

class Element {
  constructor(name = 'div') { this.tagName = name.toUpperCase(); this.children = []; this.attributes = {}; this.events = {}; this.text = ''; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map(child => typeof child === 'string' ? child : child.textContent).join(' '); }
  set lang(value) { this.setAttribute('lang', value); }
  get lang() { return this.getAttribute('lang'); }
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.append(item); return item; }
  replaceChildren(...items) { this.text = ''; this.children = items; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, callback) { (this.events[name] ||= []).push(callback); }
  click() { for (const callback of this.events.click || []) callback({target: this, currentTarget: this, preventDefault() {}}); }
  focus() { this.focused = true; }
}
function storage(initial, denied = false) {
  const values = new Map(initial ? [['tenir-reg-language', initial]] : []);
  return {
    getItem(key) { if (denied) throw new Error('Storage unavailable for this file origin'); return values.get(key) ?? null; },
    setItem(key, value) { if (denied) throw new Error('Storage unavailable for this file origin'); values.set(key, value); },
  };
}
function boot(localStorage = storage()) {
  const elements = new Map(), bilingual = [];
  for (const {name, attributes} of tags) {
    const element = new Element(name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (attributes.id) elements.set(attributes.id, element);
    if (Object.hasOwn(attributes, 'data-fr') && Object.hasOwn(attributes, 'data-en')) bilingual.push(element);
  }
  const document = {
    documentElement: new Element('html'),
    getElementById(id) { return elements.get(id) || null; },
    createElement(name) { return new Element(name); },
    querySelectorAll(selector) { assert.equal(selector, '[data-fr][data-en]'); return bilingual; },
  };
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = attrs(script[1]);
    if (attributes.id && elements.has(attributes.id)) elements.get(attributes.id).textContent = script[2];
  }
  const context = vm.createContext({document, localStorage});
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = attrs(script[1]);
    if (attributes.type !== 'application/json' && !attributes.src) {
      new vm.Script(script[2], {filename: attributes.id || 'landing.js'}).runInContext(context, {timeout: 3000});
    }
  }
  return {document, elements, bilingual, context};
}
function get(state, id) { return state.document.getElementById(id); }
function checkLanguage(state, language) {
  assert.equal(state.document.documentElement.lang, language);
  for (const locale of ['fr', 'en']) assert.equal(get(state, 'language-' + locale).getAttribute('aria-pressed'), String(locale === language));
  for (const element of state.bilingual) assert.equal(element.textContent, element.getAttribute('data-' + language));
}
function checkLocalTarget(href) {
  assert.ok(href && href !== '#', 'Navigation must have a concrete destination');
  assert.ok(!/^javascript:/i.test(href), 'Navigation must use ordinary links');
  if (/^(https?:|mailto:|tel:)/i.test(href)) return;
  const [relative, fragment] = href.split('#');
  const target = relative ? path.resolve(root, decodeURIComponent(relative.split('?')[0])) : pagePath;
  assert.ok(fs.existsSync(target), `Missing navigation target: ${href}`);
  if (fragment) {
    const destination = fs.readFileSync(target, 'utf8');
    assert.ok([...destination.matchAll(/\bid=["']([^"']+)["']/g)].some(([, id]) => id === decodeURIComponent(fragment)), `Missing navigation fragment: ${href}`);
  }
}
const evidenceFiles = ['output/evidence.json', 'output/receipt.json'];
const fingerprint = name => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const evidenceBefore = Object.fromEntries(evidenceFiles.map(name => [name, fingerprint(name)]));

const layers = [
  {fr: 'Règle métier', en: 'Business rule', status: 'CONTEXT'},
  {fr: 'Contrainte réglementaire', en: 'Regulatory constraint', status: 'CONTEXT'},
  {fr: 'Acte de médiation', en: 'Act of mediation', status: 'GUIDED_CONTEXT'},
  {fr: 'Standard REG Core & REG+', en: 'REG Core & REG+ standard', status: 'ILLUSTRATED_SUBSET'},
  {fr: 'Runtime TENIR-Gov', en: 'TENIR-Gov runtime', status: 'LOCAL_DEMO'},
];
const detailFields = ['role', 'actor', 'artifact', 'demo', 'status'];
function checkLayer(state, index, language) {
  for (let position = 0; position < layers.length; position++) {
    const button = get(state, `layer-${position + 1}`);
    assert.equal(button.getAttribute('aria-pressed'), String(position === index), 'Layer selection must be exclusive');
    assert.equal(button.getAttribute('aria-controls'), 'layer-detail');
    assert.equal(button.getAttribute('data-level'), String(position));
  }
  assert.ok(get(state, 'layer-detail-title').textContent.includes(layers[index][language]), `Missing ${language} layer title: ${index}`);
  assert.equal(get(state, 'layer-detail-status').getAttribute('data-status'), layers[index].status, `Incorrect demonstrated scope for level ${index}`);
  for (const field of detailFields) assert.ok(get(state, 'layer-detail-' + field).textContent.trim().length > 0, `Missing layer ${index} ${field}`);
}

const home = boot();
checkLanguage(home, 'fr');
checkLayer(home, 4, 'fr');
const originalLayers = vm.runInContext('JSON.stringify(layers)', home.context);
assert.equal(JSON.parse(originalLayers).length, 5);
for (let index = 0; index < layers.length; index++) {
  get(home, `layer-${index + 1}`).click();
  assert.equal(get(home, 'layer-detail').open, true, 'Selecting a layer must reveal its adjacent explanation');
  checkLayer(home, index, 'fr');
  const frenchRole = get(home, 'layer-detail-role').textContent;
  const frenchDemo = get(home, 'layer-detail-demo').textContent;
  get(home, 'language-en').click();
  checkLanguage(home, 'en');
  checkLayer(home, index, 'en');
  assert.notEqual(get(home, 'layer-detail-role').textContent, frenchRole, 'The selected layer role needs an English explanation');
  assert.notEqual(get(home, 'layer-detail-demo').textContent, frenchDemo, 'The local demonstration mapping needs an English explanation');
  assert.equal(vm.runInContext('JSON.stringify(layers)', home.context), originalLayers, 'Translations must not rewrite the architecture source');
  get(home, 'language-fr').click();
  checkLanguage(home, 'fr');
  checkLayer(home, index, 'fr');
  assert.equal(get(home, 'layer-detail-role').textContent, frenchRole);
  assert.equal(get(home, 'layer-detail-demo').textContent, frenchDemo);
}

const entryRoutes = {
  'entry-configurator': 'output/configurator.html',
  'entry-example': 'output/report.html?scenario=autorisation#parcours',
  'journey-configurator': 'output/configurator.html',
  'journey-scenarios': 'output/report.html?scenario=autorisation#parcours',
  'journey-evidence': 'output/report.html?scenario=autorisation#preuves',
  'entry-rules': 'output/configurator.html#rules-scope',
  'entry-report': 'output/report.html#preuves',
};
for (const [id, href] of Object.entries(entryRoutes)) assert.equal(get(home, id).getAttribute('href'), href, `Incorrect product route: ${id}`);
assert.ok(html.indexOf('id="journey"') < html.indexOf('id="utility"'), 'The three-step first visit path must precede expert exploration');
assert.ok(html.indexOf('id="layer-detail"') < html.indexOf('id="journey"'), 'Layer explanations must stay beside the five-layer framework');
assert.ok(/<ol class="journey-steps">/.test(html), 'The recommended sequence must have an ordered list');
assert.ok(tags.some(({name, attributes}) => name === 'a' && attributes['aria-current'] === 'page' && attributes.href === 'index.html'), 'Shared task navigation must identify the current page');
const executed = JSON.parse(fs.readFileSync(path.join(root, 'output/evidence.json'), 'utf8')).operations;
assert.ok(Object.hasOwn(executed, 'autorisation'), 'The introductory example must select an executed signed operation');
assert.ok(home.bilingual.some(element => /déjà exécutés/.test(element.getAttribute('data-fr')) && /already executed/.test(element.getAttribute('data-en'))), 'The first-visit context must explain that scenarios are already executed');
assert.ok(/@media\(prefers-reduced-motion:reduce\)/.test(html), 'Motion must honor the reduced-motion preference');
for (const {name, attributes} of tags) {
  if (name === 'a') checkLocalTarget(attributes.href);
  if (name === 'button') {
    assert.equal(attributes.type, 'button', 'Landing controls must declare their button type');
    assert.ok(attributes.id, 'Each custom landing control needs a stable identity');
    assert.ok(get(home, attributes.id).events.click?.length > 0, `Decorative button without a click action: ${attributes.id}`);
  }
}

const english = boot(storage('en'));
checkLanguage(english, 'en');
checkLayer(english, 4, 'en');
checkLanguage(boot(storage('invalid-preference')), 'fr');
const denied = boot(storage(null, true));
checkLanguage(denied, 'fr');
get(denied, 'layer-3').click();
get(denied, 'language-en').click();
checkLanguage(denied, 'en');
checkLayer(denied, 2, 'en');
get(denied, 'language-fr').click();
checkLayer(denied, 2, 'fr');
for (const name of evidenceFiles) assert.equal(fingerprint(name), evidenceBefore[name], `Landing interactions must not modify signed evidence: ${name}`);
console.log('PASS: guided first-visit path, explicit executed scenarios, adjacent five-layer details, FR/EN state, concrete task navigation and unchanged signed evidence. Browser layout not assessed.');
