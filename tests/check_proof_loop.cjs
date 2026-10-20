// Exercise the complete generated proof-loop experience offline.
// Source values are checked against the exact signed envelopes, not re-evaluated.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const directory = path.resolve(process.argv[2] || 'output');
const pages = Object.fromEntries(['report.html', 'configurator.html'].map(name => [name, fs.readFileSync(path.join(directory, name), 'utf8')]));
const base = 'file:///C:/tenir/output/';
const decode = text => text.replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

function storage(denied = false) {
  const values = new Map();
  return {
    getItem(key) { if (denied) throw new Error('Storage unavailable for this local file'); return values.get(key) ?? null; },
    setItem(key, value) { if (denied) throw new Error('Storage unavailable for this local file'); values.set(key, String(value)); },
    removeItem(key) { if (denied) throw new Error('Storage unavailable for this local file'); values.delete(key); },
    clear() { values.clear(); },
  };
}
function session(denied = false) { return {sessionStorage: storage(denied), localStorage: storage(denied)}; }

function openPage(href, shared = session()) {
  let currentUrl = new URL(href, base);
  const filename = currentUrl.pathname.split('/').at(-1);
  assert.ok(Object.hasOwn(pages, filename), 'Context navigation must remain in the local product pages');
  let document;
  class Element {
    constructor(tagName = 'div') {
      this.tagName = tagName.toUpperCase(); this.childNodes = []; this.attributes = {}; this.events = {};
      this.style = {}; this.dataset = {}; this.parentNode = null; this.text = ''; this._value = '';
      this.hidden = false; this.disabled = false;
      this.classList = {
        contains: value => this.className.split(/\s+/).includes(value),
        add: (...values) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...values])].join(' '); },
        remove: (...values) => { this.className = this.className.split(/\s+/).filter(value => !values.includes(value)).join(' '); },
        toggle: (value, force) => { const add = force === undefined ? !this.classList.contains(value) : force; this.classList[add ? 'add' : 'remove'](value); return add; },
      };
    }
    get id() { return this.attributes.id || ''; }
    set id(value) { this.attributes.id = String(value); }
    get className() { return this.attributes.class || ''; }
    set className(value) { this.attributes.class = String(value); }
    get href() { return this.attributes.href || ''; }
    set href(value) { this.attributes.href = String(value); }
    get lang() { return this.attributes.lang || ''; }
    set lang(value) { this.attributes.lang = String(value); }
    get children() { return this.childNodes.filter(child => child.tagName !== '#TEXT'); }
    get textContent() { return this.text + this.childNodes.map(child => child.textContent).join(''); }
    set textContent(value) { this.text = String(value); this.childNodes = []; }
    get innerText() { return this.textContent; }
    set innerText(value) { this.textContent = value; }
    get options() { return this.children.filter(child => child.tagName === 'OPTION'); }
    get value() { return this._value; }
    set value(value) { this._value = String(value); }
    append(...items) {
      for (let item of items) {
        if (!(item instanceof Element)) { const node = new Element('#text'); node.text = String(item); item = node; }
        item.parentNode = this; this.childNodes.push(item);
      }
    }
    appendChild(item) { this.append(item); return item; }
    replaceChildren(...items) { this.childNodes = []; this.text = ''; this.append(...items); }
    remove() { if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(child => child !== this); this.parentNode = null; }
    setAttribute(key, value) {
      this.attributes[key] = String(value);
      if (key === 'value') this.value = value;
      if (key === 'hidden') this.hidden = true;
      if (key === 'disabled') this.disabled = true;
      if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    }
    getAttribute(key) { return this.attributes[key] ?? null; }
    hasAttribute(key) { return Object.hasOwn(this.attributes, key); }
    removeAttribute(key) { delete this.attributes[key]; if (key === 'hidden') this.hidden = false; if (key === 'disabled') this.disabled = false; }
    addEventListener(type, callback) { (this.events[type] ||= []).push(callback); }
    dispatchEvent(event) {
      event.target ||= this; event.currentTarget = this;
      event.preventDefault ||= () => { event.defaultPrevented = true; };
      for (const callback of this.events[event.type] || []) callback(event);
      if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
      return !event.defaultPrevented;
    }
    click() {
      if (this.disabled) return;
      const allowed = this.dispatchEvent({type: 'click', bubbles: true});
      if (allowed && this.tagName === 'A' && this.href) currentUrl = new URL(this.href, currentUrl);
    }
    focus() { document.activeElement = this; }
    scrollIntoView() {}
    matches(selector) {
      if (selector.includes(',')) return selector.split(',').some(value => this.matches(value.trim()));
      const attributes = [...selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)];
      const clean = selector.replace(/\[[^\]]+\]/g, '');
      const id = clean.match(/#([\w-]+)/)?.[1], cls = clean.match(/\.([\w-]+)/)?.[1], tag = clean.match(/^[a-z][\w-]*/i)?.[0];
      return (!id || this.id === id) && (!cls || this.classList.contains(cls)) && (!tag || this.tagName === tag.toUpperCase())
        && attributes.every(([, key, value]) => this.hasAttribute(key) && (value === undefined || this.getAttribute(key) === value));
    }
    querySelectorAll(selector) {
      const found = [];
      for (const child of this.children) { if (child.matches(selector)) found.push(child); found.push(...child.querySelectorAll(selector)); }
      return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
  }
  document = new Element('document');
  document.createElement = name => new Element(name);
  document.createTextNode = text => { const node = new Element('#text'); node.text = String(text); return node; };
  document.getElementById = id => document.querySelector(`#${id}`);
  const stack = [document], voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  for (const token of pages[filename].matchAll(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<\/?[^>]+>|[^<]+/gi)) {
    const raw = token[0];
    if (raw.startsWith('<!--') || raw.startsWith('<!')) continue;
    if (raw.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
    if (!raw.startsWith('<')) { stack.at(-1).append(document.createTextNode(decode(raw))); continue; }
    const match = raw.match(/^<([\w-]+)\b([^>]*)>/);
    if (!match) continue;
    const [, name, attrs] = match, element = document.createElement(name);
    for (const attr of attrs.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) element.setAttribute(attr[1], decode(attr[2] ?? attr[3] ?? attr[4] ?? ''));
    stack.at(-1).append(element);
    if (name === 'script' || name === 'style') element.textContent = raw.slice(match[0].length, raw.lastIndexOf('</'));
    else if (!voidTags.has(name) && !raw.endsWith('/>')) stack.push(element);
  }
  document.body = document.querySelector('body'); document.documentElement = document.querySelector('html'); document.activeElement = null;
  const fixed = new Map(document.querySelectorAll('[id]').map(element => [element.id, element]));
  document.getElementById = id => fixed.get(id) || document.querySelector(`#${id}`);
  for (const select of document.querySelectorAll('select')) select.value = select.options.find(option => option.hasAttribute('selected'))?.value ?? select.options[0]?.value ?? '';
  const location = {};
  for (const key of ['href', 'search', 'hash', 'pathname', 'origin', 'protocol', 'host']) Object.defineProperty(location, key, {
    get: () => currentUrl[key], set: value => { if (key === 'href') currentUrl = new URL(value, currentUrl); else currentUrl[key] = value; },
  });
  location.assign = value => { currentUrl = new URL(value, currentUrl); };
  location.replace = location.assign;
  const history = {replaceState(_state, _title, value) { if (value != null) currentUrl = new URL(value, currentUrl); }, pushState(_state, _title, value) { if (value != null) currentUrl = new URL(value, currentUrl); }};
  const context = {document, location, history, URL, URLSearchParams, console, ...shared,
    Blob: class { constructor(parts, options) { this.parts = parts; this.type = options?.type || ''; } },
    setTimeout(callback) { callback(); return 1; }, clearTimeout() {}, addEventListener() {},
    Event: class { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } },
  };
  context.window = context; document.location = location;
  for (const script of document.querySelectorAll('script')) if (script.getAttribute('type') !== 'application/json' && !script.hasAttribute('src')) {
    new vm.Script(script.textContent, {filename: `${filename}-inline.js`}).runInNewContext(context, {timeout: 3000});
  }
  const get = id => { const element = document.getElementById(id); assert.ok(element, `Missing interactive control: ${id}`); return element; };
  return {document, get, shared, url: () => currentUrl.href};
}


const embedded = pages['report.html'].match(/<script type="application\/json" id="signed-model">([\s\S]*?)<\/script>/)[1];
const model = JSON.parse(embedded);
const dossier = JSON.parse(fs.readFileSync(path.join(directory, 'evidence.json'), 'utf8'));
assert.deepEqual(model.evidence_records, dossier.records, 'The inspector needs every exact signed envelope, including reservation records');
assert.deepEqual(Object.keys(model.proof_loops).sort(), Object.keys(dossier.operations).sort());
const protectedFiles = ['evidence.json', 'receipt.json'].map(name => path.join(directory, name));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const beforeFiles = protectedFiles.map(digest);
const stages = ['question','theoretical-model','observation-model','observation','interpretation','execution','knowledge','restitution'];
const expectedStates = {autorisation:'CONFIRMED',blocage:'BLOCKED',attente:'HELD','issue-inconnue':'UNCONFIRMED'};
function rawValue(source) {
  const matching = dossier.records.filter(record => record.payload.sequence === source.record_sequence);
  assert.equal(matching.length, 1, 'Every displayed path must identify one signed envelope');
  assert.ok(source.pointer.startsWith('/') && !/~(?:[^01]|$)/.test(source.pointer), 'Source pointers must use RFC6901');
  let value = matching[0];
  for (const encoded of source.pointer.slice(1).split('/')) {
    const key = encoded.replace(/~1/g, '/').replace(/~0/g, '~');
    assert.ok(value !== null && typeof value === 'object' && Object.hasOwn(value, key), 'Source pointer must resolve in the raw envelope');
    value = value[key];
  }
  return {record: matching[0], value};
}
const page = openPage('report.html?scenario=autorisation#parcours');
const loop = () => {const component=page.document.querySelector('.proof-loop'); assert.ok(component, 'Every scenario needs its evidence loop'); return component;};
const selectedStep = () => loop().querySelectorAll('button[data-loop-step]').find(button => button.getAttribute('aria-pressed') === 'true');
function sourceInspector(expected, language) {
  const inspector = loop().querySelector('.proof-source-inspector');
  assert.ok(inspector && !inspector.hidden, 'Opening a source must reveal an inspector');
  const actual = rawValue(expected);
  const pointer = inspector.querySelector('code[data-source-path]');
  assert.equal(pointer.getAttribute('data-source-path'), expected.pointer);
  assert.equal(pointer.textContent, expected.pointer);
  assert.equal(inspector.querySelector('pre[data-source-value]').textContent, JSON.stringify(actual.value, null, 2), 'The inspector must show the exact signed value, including null');
  const context = inspector.querySelector('.proof-source-context').textContent;
  assert.ok(context.includes(actual.record.payload.operation_id));
  assert.ok(context.includes('#' + expected.record_sequence));
  assert.ok(inspector.querySelector('.proof-source-fingerprint').textContent.includes(actual.record.integrity.payload_sha256));
  const kind = inspector.querySelector('.proof-source-kind');
  assert.equal(kind.getAttribute('data-source-kind'), expected.kind);
  assert.equal(kind.textContent, expected.kind === 'SIGNED_PAYLOAD'
    ? (language === 'en' ? 'Field in the signed payload' : 'Champ du payload signé')
    : (language === 'en' ? 'Signature metadata' : 'Métadonnée de signature'));
  assert.equal(inspector.querySelector('.proof-verification-link').getAttribute('href'), '#preuves');
  return inspector;
}
function assertScenario(index) {
  const record = model.operations[index], payload = record.payload;
  const scenarioButtons = page.get('scenarios').children;
  scenarioButtons.forEach((button, position) => assert.equal(button.getAttribute('aria-pressed'), String(position === index)));
  assert.equal(new URL(page.url()).searchParams.get('scenario'), payload.operation_id, 'Inspecting a stage must preserve the selected scenario');
  const number = id => Number(page.get(id).textContent.replace(/[^0-9]/g, ''));
  assert.equal(number('consumed'), payload.budget_after.consumed);
  assert.equal(number('reserved'), payload.budget_after.reserved);
  assert.equal(number('calls'), payload.provider_journal.length, 'Inspection must not create another simulator call');
  assert.equal(page.get('signed-model').textContent, embedded, 'Proof-loop, language and theme actions must never rewrite the embedded model');
}
let totalNodes = 0, totalSources = 0;
for (let index = 0; index < model.operations.length; index++) {
  const operationId = model.operations[index].payload.operation_id;
  page.get('scenarios').children[index].click();
  const projection = model.proof_loops[operationId];
  assert.deepEqual(projection.stages.map(stage => stage.id), stages);
  assert.equal(selectedStep().getAttribute('data-loop-step'), stages[0], 'Changing scenario resets to the beginning of its loop');
  assert.equal(loop().querySelector('.proof-source-inspector').hidden, true);
  assertScenario(index);
  for (const stage of projection.stages) {
    const node = loop().querySelector(`button[data-loop-step="${stage.id}"]`);
    assert.ok(node);
    assert.equal(node.tagName, 'BUTTON', 'Stages must use keyboard-native buttons');
    assert.equal(node.type || node.getAttribute('type'), 'button');
    const currentUrl = page.url();
    node.click();
    assert.equal(page.document.activeElement.className, 'proof-detail-title', 'Opening a stage must focus its detail heading');
    totalNodes++;
    const beforeNavigation = new URL(currentUrl), afterNavigation = new URL(page.url());
    const stableQuery = url => [...url.searchParams.entries()].filter(([key]) => !['loop','source_seq','source_ptr'].includes(key));
    assert.deepEqual(stableQuery(afterNavigation), stableQuery(beforeNavigation), 'Opening a stage may update only its proof navigation context');
    for (const part of ['protocol','host','pathname','hash']) assert.equal(afterNavigation[part], beforeNavigation[part]);
    assert.equal(afterNavigation.searchParams.get('loop'), stage.id);
    assert.equal(afterNavigation.searchParams.get('source_seq'), null);
    assert.equal(afterNavigation.searchParams.get('source_ptr'), null);
    const detail = loop().querySelector('.proof-loop-detail');
    assert.equal(loop().querySelectorAll('button[data-loop-step]').filter(button => button.getAttribute('aria-pressed') === 'true').length, 1);
    assert.equal(selectedStep().getAttribute('data-loop-step'), stage.id);
    assert.equal(detail.querySelector('.proof-detail-title').textContent, stage.title.fr);
    assert.equal(detail.querySelector('.proof-step-description').textContent, stage.description.fr);
    assert.equal(detail.querySelector('.proof-detail-status').getAttribute('data-loop-status'), stage.status);
    assert.equal(detail.querySelector('.proof-documentary-label').textContent, 'Explication du rapport · hors EvidenceRecord', 'Report wording must not be presented as signed record text');
    assert.equal(stage.explanation_kind, 'DOCUMENTARY');
    if (stage.id === 'execution') assert.equal(stage.status, expectedStates[operationId]);
    if (stage.id === 'question' || stage.id === 'restitution') {
      assert.equal(stage.status, 'DOCUMENTARY');
      assert.ok(detail.querySelector('.proof-documentary-note'));
      assert.ok(stage.sources.every(source => !source.pointer.includes('question_id')));
    }
    const sourceButtons = detail.querySelectorAll('button[data-source-pointer]');
    assert.equal(sourceButtons.length, stage.sources.length);
    for (let sourceIndex = 0; sourceIndex < stage.sources.length; sourceIndex++) {
      const source = stage.sources[sourceIndex], button = sourceButtons[sourceIndex];
      assert.equal(button.type || button.getAttribute('type'), 'button');
      assert.equal(button.getAttribute('data-source-pointer'), source.pointer);
      assert.equal(button.getAttribute('data-source-sequence'), String(source.record_sequence));
      assert.equal(button.getAttribute('data-source-kind'), source.kind);
      assert.equal(button.getAttribute('data-source-status'), 'AVAILABLE');
      const raw = rawValue(source);
      assert.equal(raw.record.payload.operation_id, operationId, 'Sources must not silently cross into another operation');
      button.click();
      totalSources++;
      assert.equal(button.getAttribute('aria-expanded'), 'true');
      sourceInspector(source, 'fr');
      assertScenario(index);
    }
    const lastSource = stage.sources.at(-1);
    page.get('language-en').click();
    assert.equal(selectedStep().getAttribute('data-loop-step'), stage.id, 'FR/EN must preserve the selected stage');
    assert.equal(loop().querySelector('.proof-step-description').textContent, stage.description.en);
    assert.equal(loop().querySelector('.proof-documentary-label').textContent, 'Report explanation · outside the EvidenceRecord');
    if (lastSource) sourceInspector(lastSource, 'en');
    const beforeTheme = page.document.documentElement.getAttribute('data-theme');
    page.get('theme-toggle').click();
    assert.notEqual(page.document.documentElement.getAttribute('data-theme'), beforeTheme);
    assert.equal(selectedStep().getAttribute('data-loop-step'), stage.id);
    if (lastSource) sourceInspector(lastSource, 'en');
    page.get('language-fr').click();
    assert.equal(selectedStep().getAttribute('data-loop-step'), stage.id);
    if (lastSource) sourceInspector(lastSource, 'fr');
    assertScenario(index);
  }
  const last = loop().querySelector('.proof-source-inspector');
  last.querySelector('.proof-source-close').click();
  assert.equal(last.hidden, true);
  assert.equal(page.document.activeElement.getAttribute('data-source-pointer'), projection.stages.at(-1).sources.at(-1).pointer, 'Closing a source must return focus to its trigger');
  loop().querySelector('button[data-loop-step="question"]').click();
  assert.equal(loop().querySelector('[data-loop-action="previous"]'), null);
  loop().querySelector('[data-loop-action="next"]').click();
  assert.equal(selectedStep().getAttribute('data-loop-step'), stages[1]);
  assert.equal(page.document.activeElement.className, 'proof-detail-title', 'Sequential navigation must focus the newly opened stage');
  loop().querySelector('[data-loop-action="previous"]').click();
  assert.equal(selectedStep().getAttribute('data-loop-step'), stages[0]);
}
// The NULL observation is a source value, not an omitted or invented signal.
page.get('scenarios').children[model.operations.findIndex(record => record.payload.operation_id === 'attente')].click();
loop().querySelector('button[data-loop-step="observation"]').click();
const missingSignal = loop().querySelector('button[data-source-pointer="/payload/request/signal"]');
missingSignal.click();
assert.equal(loop().querySelector('pre[data-source-value]').textContent, 'null');
assert.equal(loop().querySelector('.proof-detail-status').getAttribute('data-loop-status'), 'MISSING');
// Navigation context must survive reload and the configuration round trip without relying on storage.
const contextOperation = 'issue-inconnue';
const contextStage = 'interpretation';
const contextSource = model.proof_loops[contextOperation].stages.find(stage => stage.id === contextStage).sources.find(source => source.pointer === '/payload/budget_before');
function checkContext(instance, operationId, stageId, source = null) {
  const component = instance.document.querySelector('.proof-loop');
  assert.ok(component);
  const selected = component.querySelectorAll('button[data-loop-step]').find(button => button.getAttribute('aria-pressed') === 'true');
  assert.equal(selected.getAttribute('data-loop-step'), stageId);
  const inspector = component.querySelector('.proof-source-inspector');
  if (source) {
    assert.equal(inspector.hidden, false, 'The selected source must be restored with its stage');
    assert.equal(inspector.querySelector('code[data-source-path]').getAttribute('data-source-path'), source.pointer);
    assert.equal(inspector.querySelector('pre[data-source-value]').textContent, JSON.stringify(rawValue(source).value, null, 2));
    assert.ok(inspector.querySelector('.proof-source-context').textContent.includes(operationId));
  } else {
    assert.equal(inspector.hidden, true, 'An invalid or reset source must remain closed');
  }
  const expected = model.operations.find(record => record.payload.operation_id === operationId).payload;
  const number = id => Number(instance.get(id).textContent.replace(/[^0-9]/g, ''));
  assert.equal(number('consumed'), expected.budget_after.consumed);
  assert.equal(number('reserved'), expected.budget_after.reserved);
  assert.equal(number('calls'), expected.provider_journal.length);
  assert.equal(new URL(instance.url()).searchParams.get('scenario'), operationId);
  assert.equal(instance.get('signed-model').textContent, embedded);
}
for (const denied of [false, true]) {
  const shared = session(denied);
  const initial = openPage('report.html?scenario=' + contextOperation + '#parcours', shared);
  initial.document.querySelector(`button[data-loop-step="${contextStage}"]`).click();
  const sourceTrigger = initial.document.querySelectorAll('button[data-source-pointer]').find(button =>
    button.getAttribute('data-source-pointer') === contextSource.pointer && button.getAttribute('data-source-sequence') === String(contextSource.record_sequence));
  sourceTrigger.click();
  const contextUrl = initial.url();
  const parameters = new URL(contextUrl).searchParams;
  assert.equal(parameters.get('loop'), contextStage);
  assert.equal(parameters.get('source_seq'), String(contextSource.record_sequence));
  assert.equal(parameters.get('source_ptr'), contextSource.pointer);
  initial.get('language-en').click();
  checkContext(initial, contextOperation, contextStage, contextSource);
  const reloaded = openPage(contextUrl, shared);
  checkContext(reloaded, contextOperation, contextStage, contextSource);
  const toConfiguration = reloaded.get('report-to-config');
  toConfiguration.click();
  const configuration = openPage(reloaded.url(), shared);
  const returnLink = configuration.get('return-to-context');
  assert.equal(returnLink.hidden, false, 'Configuration must offer a contextual return');
  const returnParameters = new URL(returnLink.href, configuration.url()).searchParams;
  assert.equal(returnParameters.get('scenario'), contextOperation);
  assert.equal(returnParameters.get('loop'), contextStage);
  assert.equal(returnParameters.get('source_seq'), String(contextSource.record_sequence));
  assert.equal(returnParameters.get('source_ptr'), contextSource.pointer);
  returnLink.click();
  const returned = openPage(configuration.url(), shared);
  checkContext(returned, contextOperation, contextStage, contextSource);
  returned.get('language-en').click();
  checkContext(returned, contextOperation, contextStage, contextSource);
  returned.document.querySelector('.proof-source-close').click();
  checkContext(returned, contextOperation, contextStage);
  assert.equal(new URL(returned.url()).searchParams.get('source_seq'), null);
  assert.equal(new URL(returned.url()).searchParams.get('source_ptr'), null);
  const authorizationIndex = model.operations.findIndex(record => record.payload.operation_id === 'autorisation');
  returned.get('scenarios').children[authorizationIndex].click();
  checkContext(returned, 'autorisation', 'question');
  assert.equal(new URL(returned.url()).searchParams.get('source_ptr'), null, 'Changing scenario clears the previous source context');
  checkContext(openPage(returned.url(), shared), 'autorisation', 'question');
}
const authorizationSequence = dossier.records.find(record => record.payload.operation_id === 'autorisation').payload.sequence;
const foreignSourceSequence = dossier.records.find(record => record.payload.operation_id === 'blocage').payload.sequence;
const invalidContexts = [
  {loop:'javascript:alert(1)', source_seq:String(authorizationSequence), source_ptr:'/payload/budget_before', expected:'question'},
  {loop:'interpretation', source_seq:String(foreignSourceSequence), source_ptr:'/payload/decision/verdict', expected:'interpretation'},
  {loop:'interpretation', source_seq:String(authorizationSequence), source_ptr:'/integrity/signature', expected:'interpretation'},
  {loop:'interpretation', source_seq:'false', source_ptr:'/payload/budget_before', expected:'interpretation'},
  {loop:'interpretation', source_seq:String(authorizationSequence), source_ptr:'/payload/~2', expected:'interpretation'},
  {loop:'interpretation', source_ptr:'/payload/budget_before', expected:'interpretation'},
];
for (const {expected, ...context} of invalidContexts) {
  const parameters = new URLSearchParams({scenario:'autorisation', ...context});
  const invalid = openPage('report.html?' + parameters.toString(), session(true));
  checkContext(invalid, 'autorisation', expected);
  const normalized = new URL(invalid.url()).searchParams;
  assert.equal(normalized.get('loop'), expected);
  assert.equal(normalized.get('source_seq'), null);
  assert.equal(normalized.get('source_ptr'), null);
  const component = invalid.document.querySelector('.proof-loop');
  assert.ok(!component.querySelector('.proof-source-context'), 'Invalid query context must not open an unrelated source');
}
// Malformed presentation references must not disclose another operation or claim a signed value.
const originalPage = pages['report.html'];
const questionSource = model.proof_loops.autorisation.stages[0].sources[0];
const foreignSequence = dossier.records.find(record => record.payload.operation_id === 'blocage').payload.sequence;
const latestAuthorization = dossier.records.filter(record => record.payload.operation_id === 'autorisation').at(-1).payload.sequence;
const invalidSources = [
  {...questionSource, pointer:'/payload/absent'},
  {...questionSource, pointer:'/payload/~2'},
  {...questionSource, kind:'ENVELOPE_METADATA'},
  {...questionSource, record_sequence:foreignSequence},
  {...questionSource, record_sequence:999},
  {...questionSource, record_sequence:String(questionSource.record_sequence)},
  {...questionSource, record_sequence:latestAuthorization, pointer:'/payload/provider_journal/00'},
];
for (const invalidSource of invalidSources) {
  const altered = JSON.parse(embedded);
  altered.proof_loops.autorisation.stages[0].sources[0] = invalidSource;
  const alteredModel = JSON.stringify(altered);
  pages['report.html'] = originalPage.replace(embedded, alteredModel);
  const invalid = openPage('report.html?scenario=autorisation');
  const component = invalid.document.querySelector('.proof-loop');
  const trigger = component.querySelectorAll('button[data-source-pointer]')[0];
  assert.equal(trigger.getAttribute('data-source-status'), 'UNAVAILABLE');
  assert.equal(trigger.getAttribute('data-source-kind'), 'UNAVAILABLE');
  trigger.click();
  const inspector = component.querySelector('.proof-source-inspector');
  assert.equal(inspector.hidden, false);
  assert.equal(inspector.querySelector('.proof-source-kind').getAttribute('data-source-kind'), 'UNAVAILABLE');
  assert.equal(inspector.querySelector('.proof-source-kind').textContent, 'Source indisponible');
  assert.ok(inspector.querySelector('pre[data-source-value]').textContent.includes('Aucune valeur'));
  assert.ok(!inspector.querySelector('.proof-source-context').textContent.includes('blocage'), 'A foreign operation must not be presented as the selected operation source');
  assert.equal(invalid.get('signed-model').textContent, alteredModel, 'Rejecting a reference must preserve the supplied model');
}
pages['report.html'] = originalPage;
for (let index = 0; index < protectedFiles.length; index++) assert.equal(digest(protectedFiles[index]), beforeFiles[index], 'Inspection must never modify signed files');
console.log(`PASS: ${totalNodes} nodes, ${totalSources} exact sources, ${invalidSources.length} rejected references, reload/configuration context, guarded query restore, scenario reset, provenance, focus, FR/EN and theme. Browser layout not assessed.`);
