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
  if (path.basename(target) === 'report.html') {
    const report = fs.readFileSync(target, 'utf8');
    const model = JSON.parse(report.match(/<script type="application\/json" id="signed-model">([\s\S]*?)<\/script>/)[1]);
    const parameters = new URL(href, 'https://local.invalid/').searchParams;
    const scenario = parameters.get('scenario'), step = parameters.get('loop');
    if (scenario) assert.ok(model.operations.some(record => record.payload.operation_id === scenario), `Unknown signed scenario: ${href}`);
    if (step) assert.ok(scenario && model.proof_loops[scenario]?.stages.some(stage => stage.id === step), `Unknown evidence-loop step: ${href}`);
  }
  if (fragment) {
    const destination = fs.readFileSync(target, 'utf8');
    const staticTarget = [...destination.matchAll(/\bid=["']([^"']+)["']/g)].some(([, id]) => id === decodeURIComponent(fragment));
    const renderedProofLoop = fragment === 'proof-loop' && path.basename(target) === 'report.html'
      && /setAttribute\(\s*['"]id['"]\s*,\s*['"]proof-loop['"]\s*\)/.test(destination);
    assert.ok(staticTarget || renderedProofLoop, `Missing navigation fragment: ${href}`);
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
  assert.equal(get(home, 'layer-detail-title').focused, true, 'Keyboard activation must reach the selected explanation');
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
  'journey-evidence': 'output/report.html?scenario=issue-inconnue&loop=execution#proof-loop',
  'usecase-unknown-action': 'output/report.html?scenario=issue-inconnue&loop=execution#proof-loop',
  'entry-rules': 'output/configurator.html#rules-scope',
  'entry-report': 'output/report.html#preuves',
};
for (const [id, href] of Object.entries(entryRoutes)) assert.equal(get(home, id).getAttribute('href'), href, `Incorrect product route: ${id}`);
assert.ok(html.indexOf('id="usecase-unknown"') < html.indexOf('id="journey"'), 'The recorded incident must introduce the guided workflow');
assert.ok(html.indexOf('id="quick-start"') < html.indexOf('id="architecture-context"'), 'Architecture is optional context after the practical guide');
assert.equal(get(home, 'architecture').tagName, 'SUMMARY', 'The workshop anchor must lead to the native context control');
assert.ok(!Object.hasOwn(get(home, 'architecture-context').attributes, 'open'), 'Architecture detail should be optional on first visit');
assert.ok(/<ol class="journey-steps">/.test(html), 'The recommended sequence must have an ordered list');
assert.ok(tags.some(({name, attributes}) => name === 'a' && attributes['aria-current'] === 'page' && attributes.href === 'index.html'), 'Shared task navigation must identify the current page');
const bundle = JSON.parse(fs.readFileSync(path.join(root, 'output/evidence.json'), 'utf8'));
const snapshot = tags.find(({attributes}) => attributes['data-incident-operation']);
assert.ok(snapshot, 'The incident summary must identify its fixed recorded operation');
const operationId = snapshot.attributes['data-incident-operation'];
const record = bundle.records.find(record => record.payload.sequence === Number(snapshot.attributes['data-incident-record-sequence']));
assert.equal(record?.payload.operation_id, operationId, 'Incident facts must come from the named signed operation');
const incident = record.payload;
const expectedFacts = {verdict: incident.decision.verdict, outcome: incident.operation_state,
  reserved: incident.budget_after.reserved, calls: incident.provider_journal.filter(entry => entry.operation_id === operationId).length};
for (const [field, value] of Object.entries(expectedFacts)) {
  const fact = tags.find(({attributes}) => attributes['data-incident-field'] === field);
  assert.equal(fact?.attributes['data-value'], String(value), `Incorrect recorded incident fact: ${field}`);
  const rendered = html.match(new RegExp('<dd[^>]*data-incident-field="' + field + '"[^>]*>([^<]+)'));
  assert.equal(decode(rendered?.[1] || '').replace(/\s/g, ''), String(value), `Visible incident fact differs from its source: ${field}`);
}
assert.notEqual(expectedFacts.calls, incident.provider_journal.length, 'The incident call count must have operation scope rather than cumulative scope');
const primary = tags.filter(({name, attributes}) => name === 'a' && (attributes.class || '').split(/\s+/).includes('primary'));
assert.equal(primary.length, 1, 'The first visit needs one primary incident action');
assert.equal(primary[0].attributes.id, 'usecase-unknown-action');
const sourceLink = new URL(get(home, 'incident-source').getAttribute('href'), 'https://local.invalid/');
const reportModel = JSON.parse(fs.readFileSync(path.join(root, 'output/report.html'), 'utf8').match(/<script type="application\/json" id="signed-model">([\s\S]*?)<\/script>/)[1]);
assert.ok(reportModel.proof_loops[operationId].stages.find(stage => stage.id === sourceLink.searchParams.get('loop')).sources
  .some(source => source.record_sequence === Number(sourceLink.searchParams.get('source_seq')) && source.pointer === sourceLink.searchParams.get('source_ptr')), 'The fixed incident source must be available in its signed scenario stage');
assert.ok(home.bilingual.some(element => /déjà exécutés/.test(element.getAttribute('data-fr')) && /already executed/.test(element.getAttribute('data-en'))), 'The first-visit context must explain that scenarios are already executed');
assert.ok(/@media\(prefers-reduced-motion:reduce\)/.test(html), 'Motion must honor the reduced-motion preference');
// Use-case entry points must explain a useful outcome and lead to available functions.
const useCases = [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)]
  .map(([, attributes, body]) => ({attributes: attrs(attributes), body})).filter(card => card.attributes['data-use-case']);
const translated = (fragment, context) => {
  const wording = [...fragment.matchAll(/<[a-z][^>]*>/gi)].map(match => attrs(match[0]));
  assert.ok(wording.some(item => item['data-fr']?.trim() && item['data-en']?.trim() && item['data-fr'] !== item['data-en']), `Missing usable FR/EN explanation: ${context}`);
};
for (const purpose of ['architecture','refusal','unknown','evidence','workshop','integration']) {
  const card = useCases.find(card => card.attributes['data-use-case'] === purpose);
  assert.ok(card, `Missing entry point for ${purpose}`);
  for (const role of ['audience','benefit','result']) {
    const explanation = [...card.body.matchAll(/<(?:p|span)\b([^>]*)>/gi)]
      .find(([, attributes]) => (attrs(attributes).class || '').split(/\s+/).includes('use-case-' + role));
    assert.ok(explanation, `The ${purpose} entry must explain its ${role}`);
    translated(explanation[0], `${purpose} ${role}`);
  }
  const guide = card.body.match(/<details\b[^>]*>([\s\S]*?)<\/details>/i);
  assert.ok(guide && /<summary\b/.test(guide[1]) && /<ol\b/.test(guide[1]), `The ${purpose} entry needs a native, ordered how-to`);
  translated(guide[1], `${purpose} how-to`);
  if (purpose !== 'unknown') {
    const summary = guide[1].match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1];
    for (const role of ['benefit', 'result']) assert.ok(summary?.includes('use-case-' + role), `The ${purpose} value must remain visible before opening instructions`);
    assert.ok(!/\bopen(?:\s|>|=)/i.test(card.body.match(/<details\b[^>]*>/i)[0]), `The ${purpose} instructions should be optional at first visit`);
  }
  const action = [...card.body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .find(([, attributes]) => (attrs(attributes).class || '').split(/\s+/).includes('use-case-action'));
  assert.ok(action, `The ${purpose} entry needs an actionable destination`);
  assert.ok(!/^https?:/i.test(attrs(action[1]).href), 'Use-case actions should open a function in this local demonstration');
  checkLocalTarget(attrs(action[1]).href);
}
assert.equal(get(home, 'entry-use-cases').getAttribute('href'), '#use-cases');
assert.ok(get(home, 'quick-start'), 'The short getting-started guide must have a stable destination');
assert.equal(get(home, 'readme-link').getAttribute('href'), 'README.md');
assert.equal(get(home, 'worksheet-link').getAttribute('href'), 'DIAGNOSTIC_ATELIER.md', 'The manual diagnostic must have a concrete worksheet');

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
console.log('PASS: recorded UNKNOWN incident and operation-scoped facts, six bilingual uses, signed source destinations, quick-start/manual worksheet, optional five-layer context, actual language/theme controls and unchanged signed evidence. Browser layout not assessed.');
