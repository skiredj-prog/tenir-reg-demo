// Exercise the generated pages together, through DOM controls and actual links.
// This checks navigation/state contracts without a browser or network access.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const directory = path.resolve(process.argv[2] || 'output');
const pages = Object.fromEntries(['configurator.html', 'report.html'].map(name => [name, fs.readFileSync(path.join(directory, name), 'utf8')]));
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
  assert.ok(Object.hasOwn(pages, filename), 'Navigation must stay within the two local application pages');
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

const configModel = JSON.parse(pages['configurator.html'].match(/<script type="application\/json" id="configurator-model">([\s\S]*?)<\/script>/)[1]);
const reportModel = JSON.parse(pages['report.html'].match(/<script type="application\/json" id="signed-model">([\s\S]*?)<\/script>/)[1]);
const fields = Object.keys(configModel.axes);
const runtime = configModel.runtime_configuration;
const selection = page => Object.fromEntries(fields.map(field => [field, page.get('field-'+field).value]));
const initial = page => JSON.parse(page.get('initial-config').textContent);
const selectedStep = page => fields.findIndex(field => !page.get('panel-'+field).hidden);
function choose(page, configuration) {
  for (const field of fields) { page.get('field-'+field).value = configuration[field]; page.get('field-'+field).dispatchEvent({type: 'change'}); }
}
function configId(configuration) {
  return configModel.configurations.find(entry => fields.every(field => entry.configuration[field] === configuration[field])).id;
}
function checkOrigin(page, origin) {
  assert.equal(page.get('return-to-context').hidden, false, `Return action must be visible for ${origin}`);
  assert.equal(page.get('return-to-context').getAttribute('data-origin'), origin);
}
function plainNumber(element) { return Number(element.textContent.replace(/[\s,\u00a0\u202f]/g, '')); }
function checkSnapshot(page, index) {
  const record = reportModel.operations[index], payload = record.payload;
  for (const field of ['consumed', 'reserved']) assert.equal(plainNumber(page.get(field)), payload.budget_after[field], `Header ${field} must match selected evidence ${payload.operation_id}`);
  assert.equal(plainNumber(page.get('available')), reportModel.final_budget.available, 'The separately labelled final balance remains the dossier final balance');
  assert.equal(plainNumber(page.get('calls')), payload.provider_journal.length, 'Header calls must match the selected cumulative provider journal');
  assert.equal(page.get('scenarios').children[index].getAttribute('aria-pressed'), 'true');
  assert.ok(page.get('detail').textContent.includes(payload.operation_id));
  assert.equal(page.get('signed-model').textContent, pages['report.html'].match(/<script type="application\/json" id="signed-model">([\s\S]*?)<\/script>/)[1], 'Navigation and presentation must preserve the embedded signed data');
}

// Initial state restoration must not manufacture a scroll destination or autofocus.
for (const deniedStorage of [false, true]) {
  const entrySession = session(deniedStorage);
  for (const suffix of ['', '?'+new URLSearchParams({cfg:configId(runtime),step:'3'})]) {
    let entry = openPage('configurator.html'+suffix, entrySession);
    assert.equal(new URL(entry.url()).hash, '', 'A direct entry without a fragment stays at the top');
    assert.equal(entry.document.activeElement, null, 'Initial restoration must not move focus');
    assert.deepEqual(selection(entry), runtime, 'Initial state is still restored without a fragment');
    assert.equal(selectedStep(entry), suffix ? 2 : 0, 'Explicit step state is restored without creating an anchor');
    entry = openPage(entry.url(), entrySession);
    assert.equal(new URL(entry.url()).hash, '', 'Reload preserves an empty fragment, including when storage is denied');
    assert.equal(entry.document.activeElement, null, 'Reload must not autofocus a restored field');
  }
  for (const fragment of ['#workspace', '#rules-scope', '#reference-alignment']) {
    let entry = openPage('configurator.html?step=2'+fragment, entrySession);
    assert.equal(new URL(entry.url()).hash, fragment, 'An explicit entry anchor must survive initialization');
    assert.equal(entry.get('rules-scope').hidden, fragment !== '#rules-scope', 'The rules anchor still selects the rules view');
    assert.equal(selectedStep(entry), 1);
    assert.equal(entry.document.activeElement, null, 'An explicit anchor does not manufacture focus');
    entry = openPage(entry.url(), entrySession);
    assert.equal(new URL(entry.url()).hash, fragment, 'Reload preserves an explicitly requested anchor');
  }
  const navigation = openPage('configurator.html', session(deniedStorage));
  navigation.get('next-step').click();
  assert.equal(new URL(navigation.url()).hash, '#workspace', 'A user step action writes a concrete workspace destination');
  assert.equal(navigation.document.activeElement, navigation.get('field-DEDUP_LAYER'));
  navigation.get('journey-rules').click();
  assert.equal(new URL(navigation.url()).hash, '#rules-scope', 'A user rules action still selects its destination');
  assert.equal(navigation.document.activeElement, navigation.get('rules-heading'));
  navigation.get('journey-config').click();
  assert.equal(new URL(navigation.url()).hash, '#workspace', 'Returning to configuration remains explicit');
}

// Rules -> edit -> return preserves both a correction's origin and the current step.
const shared = session();
let config = openPage('configurator.html', shared);
assert.equal(config.get('return-to-context').hidden, true, 'No contextual return is shown on an initial visit');
const rejected = {HOST_SCOPE: 'mono-process', DEDUP_LAYER: 'distributed-consensus-registry', CONCURRENCY: 'distributed-consensus', UNCERTAINTY: 'fail-open'};
choose(config, rejected);
config.get('suggestions').querySelector('button[data-target-id]').click();
choose(config, runtime);
assert.deepEqual(initial(config), rejected, 'Returning to the runtime profile keeps the captured pre-correction selection');
config.get('step-2').click();
config.get('journey-rules').click();
config.get('scope-config-summary').querySelector('button[data-edit-field="CONCURRENCY"]').click();
assert.equal(config.get('workspace').hidden, false);
assert.equal(selectedStep(config), 2);
checkOrigin(config, 'rules');
const frenchReturn = config.get('return-to-context').textContent;
config.get(config.document.documentElement.getAttribute('lang')==='fr'?'language-en':'language-fr').click();
assert.notEqual(config.get('return-to-context').textContent, frenchReturn, 'The contextual action must translate');
assert.deepEqual(selection(config), runtime);
assert.deepEqual(initial(config), rejected);
checkOrigin(config, 'rules');
config = openPage(config.url(), shared);
assert.equal(selectedStep(config), 2, 'Reload keeps the field currently being edited');
checkOrigin(config, 'rules');
config.get('return-to-context').click();
assert.equal(config.get('rules-scope').hidden, false, 'Return action restores the rules view');
assert.equal(config.get('workspace').hidden, true);
assert.deepEqual(selection(config), runtime);
assert.deepEqual(initial(config), rejected);
config.get('back-to-config').click();
checkOrigin(config, 'rules');
config.get('return-to-context').click();
assert.equal(config.get('rules-scope').hidden, false);

// Follow the actual demo links; the selected signed snapshot survives the round trip.
config.get('back-to-config').click();
config.get('step-3').click();
const demoHref = config.get('journey-demo').href;
assert.ok(demoHref, 'Verified runtime profile exposes an actual demo link');
let report = openPage(new URL(demoHref, config.url()).href, shared);
report.get('scenarios').children[3].click();
checkSnapshot(report, 3);
report.get('scenarios').children[0].click();
checkSnapshot(report, 0);
report.get('scenarios').children[2].click();
checkSnapshot(report, 2);
report.get('language-fr').click();
checkSnapshot(report, 2);
const editHref = report.get('report-to-config').href;
const editUrl = new URL(editHref, report.url());
assert.equal(editUrl.searchParams.get('return'), 'demo');
assert.equal(editUrl.searchParams.get('scenario'), reportModel.operations[2].payload.operation_id);
assert.equal(editUrl.searchParams.get('cfg'), configId(runtime));
assert.equal(editUrl.searchParams.get('initial'), configId(rejected));
assert.equal(editUrl.searchParams.get('captured'), '1');
assert.equal(editUrl.searchParams.get('step'), '4');
config = openPage(editUrl.href, shared);
checkOrigin(config, 'demo');
assert.deepEqual(selection(config), runtime);
assert.deepEqual(initial(config), rejected);
assert.equal(selectedStep(config), 3);
config.get('step-1').click();
assert.equal(new URL(config.get('return-to-context').href, config.url()).searchParams.get('step'), '2', 'The resume link follows subsequent edits of the current step');
config.get(config.document.documentElement.getAttribute('lang')==='fr'?'language-en':'language-fr').click();
checkOrigin(config, 'demo');
const resumeHref = config.get('return-to-context').href;
assert.equal(new URL(resumeHref, config.url()).searchParams.get('scenario'), reportModel.operations[2].payload.operation_id);
report = openPage(new URL(resumeHref, config.url()).href, shared);
checkSnapshot(report, 2);
report = openPage(report.url(), shared);
checkSnapshot(report, 2);

// Explicit links work when local-file storage is denied, and override older drafts.
const params = new URLSearchParams({return: 'demo', scenario: reportModel.operations[1].payload.operation_id, cfg: configId(runtime), step: '3', initial: configId(rejected), captured: '1'});
const denied = session(true);
config = openPage('configurator.html?'+params, denied);
checkOrigin(config, 'demo');
assert.deepEqual(selection(config), runtime);
assert.deepEqual(initial(config), rejected);
assert.equal(selectedStep(config), 2);
config.get(config.document.documentElement.getAttribute('lang')==='fr'?'language-en':'language-fr').click();
report = openPage(new URL(config.get('return-to-context').href, config.url()).href, denied);
checkSnapshot(report, 1);
config = openPage(new URL(report.get('report-to-config').href, report.url()).href, denied);
assert.deepEqual(selection(config), runtime);
assert.deepEqual(initial(config), rejected);
assert.equal(selectedStep(config), 2);
checkOrigin(config, 'demo');
config.get('journey-rules').click();
config.get('scope-config-summary').querySelector('button[data-edit-field="HOST_SCOPE"]').click();
config = openPage(config.url(), denied);
checkOrigin(config, 'demo');
assert.equal(selectedStep(config), 0);
assert.deepEqual(initial(config), rejected);
config.get('return-to-context').click();
report=openPage(config.url(),denied);
checkSnapshot(report,1);
const override = new URLSearchParams(params); override.set('cfg', configId(rejected)); override.set('step', '1');
config = openPage('configurator.html?'+override, shared);
assert.deepEqual(selection(config), rejected, 'An explicit shared link takes precedence over the saved current selection');
assert.equal(selectedStep(config), 0);

// Completing the wizard, adopting a local profile and undoing it must work without storage.
let recovery=openPage('configurator.html',denied);
const outside=configModel.configurations.find(entry=>entry.admissible&&!entry.runtime_supported).configuration;
choose(recovery,outside);
recovery.get('step-3').click();
recovery.get('next-step').click();
assert.equal(recovery.get('rules-scope').hidden,false,'Final wizard action opens a useful summary');
assert.equal(recovery.get('rules-use-local').hidden,false);
recovery.get('rules-use-local').click();
assert.deepEqual(selection(recovery),runtime);
assert.deepEqual(initial(recovery),outside);
recovery=openPage(recovery.url(),denied);
assert.equal(recovery.get('change-feedback').hidden,false,'Undo is recoverable from the URL without storage');
report=openPage(new URL(recovery.get('demo-link').href,recovery.url()).href,denied);
recovery=openPage(new URL(report.get('report-to-config').href,report.url()).href,denied);
recovery.get('undo-change').click();
assert.deepEqual(selection(recovery),outside,'Undo survives the report/configurator round trip');
assert.equal(recovery.get('demo-link').getAttribute('href'),null);
recovery.get('header-config-link').click();
assert.deepEqual(selection(recovery),outside,'The active header link does not reset an unsupported selection');
report=openPage(new URL(recovery.get('header-demo-link').href,recovery.url()).href,denied);
assert.equal(report.get('profile-context').hidden,false,'The local archive explicitly distinguishes the explored profile');
assert.ok(report.get('executed-profile').textContent.includes('mono-process'));

// An explicit configuration link never inherits an unrelated cached undo state.
const cached=session();
recovery=openPage('configurator.html',cached);choose(recovery,outside);recovery.get('use-local-profile').click();
assert.equal(recovery.get('change-feedback').hidden,false);
recovery=openPage('configurator.html?cfg='+configId(outside),cached);
assert.equal(recovery.get('change-feedback').hidden,true);

// Untrusted return destinations/configurations cannot become executable navigation.
for (const destination of ['https://example.invalid/phish', '//example.invalid/phish', 'javascript:alert(1)']) {
  const query = new URLSearchParams({return: destination, cfg: 'cfg-not-in-catalogue', initial: '{}', step: '999', scenario: 'not-a-signed-operation'});
  const invalid = openPage('configurator.html?'+query, session());
  assert.deepEqual(selection(invalid), runtime);
  assert.equal(selectedStep(invalid), 0);
  assert.equal(invalid.get('return-to-context').hidden, true, 'Only the known demo context may be restored from a query');
  assert.ok(!invalid.get('return-to-context').href.includes(destination));
}
console.log('PASS: initial top entry and explicit anchors, contextual rules/demo return, signed snapshot counters, selection/origin/step restoration, reload, FR/EN and storage-denied URL fallback. Browser layout not assessed.');
