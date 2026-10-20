// Exercise the generated alignment disclosures through actual local page scripts.
// Static source context must remain separate from signed evidence and runtime claims.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const directory = path.resolve(process.argv[2] || 'output');
const root = path.resolve(__dirname, '..');
const pages = Object.fromEntries(['configurator.html', 'report.html'].map(name => [name, fs.readFileSync(path.join(directory, name), 'utf8')]));
pages['index.html'] = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
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
  assert.ok(Object.hasOwn(pages, filename), 'Only the local product pages may be opened');
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



const decodeModel = (filename, id) => JSON.parse(pages[filename].match(new RegExp('<script type="application/json" id="' + id + '">([\\s\\S]*?)</script>'))[1]);
const reportModel = decodeModel('report.html', 'signed-model');
const configurationModel = decodeModel('configurator.html', 'configurator-model');
assert.deepEqual(reportModel.alignment, configurationModel.alignment, 'Both journeys must display the same source diagnostic');
const alignment = reportModel.alignment;
assert.equal(alignment.schema, 'demo-reference-alignment/v1');
assert.equal(alignment.structural.status, 'STRUCTURAL_MATCH');
assert.equal(alignment.execution_compatibility, 'NOT_VERIFIED');
assert.equal(alignment.full_conformance, 'NOT_DEMONSTRATED');
assert.equal(alignment.remote_code_executed, false);
const protectedFiles = ['evidence.json','receipt.json','configuration-catalogue.json'].map(name => path.join(directory, name));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = protectedFiles.map(digest);
function embedded(instance, filename) { return instance.get(filename === 'report.html' ? 'signed-model' : 'configurator-model').textContent; }
function checkLanguage(panel, locale) {
  const bilingual = panel.querySelectorAll('[data-fr][data-en]');
  assert.ok(bilingual.length > 20, 'Source scope and detailed explanations need both languages');
  for (const text of bilingual) assert.equal(text.textContent, text.getAttribute('data-' + locale));
}
for (const filename of ['configurator.html','report.html']) {
  const query = filename === 'report.html' ? '?scenario=issue-inconnue' : '';
  const instance = openPage(filename + query + '#reference-alignment');
  const original = embedded(instance, filename);
  const panel = instance.get('reference-alignment');
  assert.equal(panel.tagName, 'SECTION');
  assert.equal(panel.getAttribute('aria-labelledby'), 'alignment-heading');
  assert.equal(panel.getAttribute('data-structural-status'), 'STRUCTURAL_MATCH');
  assert.equal(panel.getAttribute('data-execution-compatibility'), 'NOT_VERIFIED');
  assert.equal(panel.getAttribute('data-full-conformance'), 'NOT_DEMONSTRATED');
  assert.ok(panel.textContent.includes('144 configurations'));
  assert.ok(/1[ ,]?008/.test(panel.textContent));
  const disclosures = panel.querySelectorAll('details');
  assert.ok(disclosures.length >= 4, 'Contracts, invariants, harness and documentary differences need native disclosures');
  for (const details of disclosures) {
    assert.ok(details.querySelector('summary')?.textContent.trim(), 'Native disclosures need a labelled summary');
    details.open = true;
    assert.equal(details.open, true);
  }
  const pins = panel.querySelector('.alignment-pins');
  assert.ok(pins);
  const repositoryLinks = pins.querySelectorAll('a');
  assert.equal(repositoryLinks.length, 3);
  for (const source of alignment.sources) {
    assert.ok(/^[a-f0-9]{40}$/.test(source.pinned_commit));
    const expected = 'https://github.com/' + source.repository + '/tree/' + source.pinned_commit;
    assert.ok(repositoryLinks.some(link => link.href === expected), 'Each repository must link to its exact commit');
  }
  for (const contract of alignment.runtime_review.contracts) {
    assert.ok(panel.textContent.includes(contract.title.fr));
    assert.ok(panel.textContent.includes(contract.description.fr), 'Every contract difference must appear in the disclosure');
  }
  for (const invariant of alignment.runtime_review.invariants) {
    assert.ok(panel.textContent.includes(invariant.id));
    assert.ok(panel.textContent.includes(invariant.notes.fr));
  }
  for (const scenario of alignment.harness_review.scenarios) assert.ok(panel.textContent.includes(scenario.finding.fr));
  assert.equal(panel.querySelectorAll('[data-source-kind]').length, 0, 'Documentary alignment must not be presented as signed field content');
  const pinnedSourceLinks = panel.querySelectorAll('a').filter(link => link.href.includes('/blob/'));
  assert.ok(pinnedSourceLinks.length > 10);
  for (const link of pinnedSourceLinks) assert.ok(/\/blob\/[a-f0-9]{40}\//.test(link.href), 'Source links must never move with a branch');
  checkLanguage(panel, 'fr');
  const selection = filename === 'configurator.html'
    ? Object.fromEntries(Object.keys(configurationModel.axes).map(field => [field, instance.get('field-' + field).value]))
    : ['consumed','reserved','calls'].map(id => instance.get(id).textContent.replace(/[^0-9]/g, ''));
  instance.get('language-en').click();
  checkLanguage(panel, 'en');
  assert.equal(new URL(instance.url()).hash, '#reference-alignment', 'Language must preserve the opened alignment context');
  const oldTheme = instance.document.documentElement.getAttribute('data-theme');
  instance.get('theme-toggle').click();
  assert.notEqual(instance.document.documentElement.getAttribute('data-theme'), oldTheme);
  assert.equal(new URL(instance.url()).hash, '#reference-alignment', 'Theme must preserve the opened alignment context');
  instance.get('language-fr').click();
  checkLanguage(panel, 'fr');
  assert.equal(embedded(instance, filename), original, 'Alignment exploration must never rewrite evidence or the configuration model');
  for (const details of disclosures) assert.equal(details.open, true, 'Changing language or theme must preserve native disclosure state');
  if (filename === 'configurator.html') {
    assert.deepEqual(Object.fromEntries(Object.keys(configurationModel.axes).map(field => [field, instance.get('field-' + field).value])), selection);
    instance.get('journey-rules').click();
    assert.equal(new URL(instance.url()).hash, '#rules-scope');
    instance.get('journey-config').click();
    assert.equal(new URL(instance.url()).hash, '#workspace');
  } else {
    assert.deepEqual(['consumed','reserved','calls'].map(id => instance.get(id).textContent.replace(/[^0-9]/g, '')), selection);
    assert.equal(new URL(instance.url()).searchParams.get('scenario'), 'issue-inconnue');
  }
  const denied = openPage(filename + query + '#reference-alignment', session(true));
  denied.get('language-en').click();
  denied.get('theme-toggle').click();
  checkLanguage(denied.get('reference-alignment'), 'en');
  assert.equal(new URL(denied.url()).hash, '#reference-alignment');
}
for (let index = 0; index < protectedFiles.length; index++) assert.equal(digest(protectedFiles[index]), before[index], 'Alignment inspection must preserve sealed artifacts');
console.log('PASS: shared alignment model, native contract/invariant/harness disclosures, pinned sources, scoped claims, FR/EN/theme and deep-link continuity without signed-data mutation. Browser layout not assessed.');
