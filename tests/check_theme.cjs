// Exercise the actual page scripts and shared appearance controls offline.
// This checks functional theme integration and palette contrast, not visual layout.
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


const expectedScript = fs.readFileSync(path.join(root, 'tenir_demo/theme_client.js'), 'utf8');
const expectedStyle = fs.readFileSync(path.join(root, 'tenir_demo/theme.css'), 'utf8');
const protectedFiles = ['evidence.json', 'receipt.json'].map(name => path.join(root, 'output', name));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originalFiles = protectedFiles.map(digest);
const sourceModel = page => page.document.getElementById('signed-model')?.textContent
  || page.document.getElementById('configurator-model')?.textContent || '';
function checkTheme(page, theme, language) {
  assert.equal(page.document.documentElement.getAttribute('data-theme'), theme);
  const control = page.get('theme-toggle');
  assert.equal(control.tagName, 'BUTTON');
  assert.equal(control.getAttribute('type'), 'button');
  assert.equal(control.getAttribute('aria-pressed'), null, 'The next-action button must not announce a contradictory pressed state');
  assert.equal(control.textContent, language === 'en' ? (theme === 'light' ? 'Dark mode' : 'Light mode') : (theme === 'light' ? 'Mode sombre' : 'Mode clair'));
  assert.ok(control.getAttribute('aria-label').includes(control.textContent.toLowerCase()));
}
function switchLanguage(page, locale) {
  const separate = page.document.getElementById('language-' + locale);
  if (separate) separate.click();
  else if (page.document.documentElement.lang !== locale) page.get('language-toggle').click();
  assert.equal(page.document.documentElement.lang, locale);
}
for (const [filename, html] of Object.entries(pages)) {
  assert.equal(html.match(/<script id="tenir-theme-script">([\s\S]*?)<\/script>/)?.[1]?.replace(/\r\n/g, '\n'), expectedScript.replace(/\r\n/g, '\n'), `The ${filename} appearance script must use the common source`);
  assert.equal(html.match(/<style id="tenir-theme-style">([\s\S]*?)<\/style>/)?.[1]?.replace(/\r\n/g, '\n'), expectedStyle.replace(/\r\n/g, '\n'), `The ${filename} palette must use the common source`);
  assert.equal((html.match(/id="theme-toggle"/g) || []).length, 1, 'One theme action per page');
  const shared = session();
  let page = openPage(filename, shared);
  const model = sourceModel(page);
  checkTheme(page, 'dark', 'fr');
  page.get('theme-toggle').click();
  checkTheme(page, 'light', 'fr');
  assert.equal(shared.localStorage.getItem('tenir-reg-theme'), 'light');
  switchLanguage(page, 'en');
  checkTheme(page, 'light', 'en');
  assert.equal(sourceModel(page), model, 'Appearance and language must preserve embedded signed/source data');
  page = openPage(filename, shared);
  checkTheme(page, 'light', 'en');
  page.get('theme-toggle').click();
  checkTheme(page, 'dark', 'en');
  switchLanguage(page, 'fr');
  checkTheme(page, 'dark', 'fr');
  assert.equal(sourceModel(page), model);
  shared.localStorage.setItem('tenir-reg-theme', 'invalid-preference');
  checkTheme(openPage(filename, shared), 'dark', 'fr');
  const denied = openPage(filename, session(true));
  checkTheme(denied, 'dark', 'fr');
  denied.get('theme-toggle').click();
  switchLanguage(denied, 'en');
  checkTheme(denied, 'light', 'en');
  denied.get('theme-toggle').click();
  checkTheme(denied, 'dark', 'en');
  assert.equal(sourceModel(denied), model);
}
const shared = session();
const first = openPage('index.html', shared);
first.get('theme-toggle').click();
switchLanguage(first, 'en');
checkTheme(openPage('configurator.html', shared), 'light', 'en');
checkTheme(openPage('report.html', shared), 'light', 'en');

function luminance(hex) {
  const components = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * components[0] + 0.7152 * components[1] + 0.0722 * components[2];
}
function contrast(first, second) { const a = luminance(first), b = luminance(second); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
for (const mode of ['dark', 'light']) {
  const body = expectedStyle.match(new RegExp('(?::root,)?' + ':root\\[data-theme=' + mode + '\\]\\{([^}]+)\\}'))?.[1];
  assert.ok(body, 'Each theme must explicitly declare its palette');
  const palette = Object.fromEntries([...body.matchAll(/--([a-z-]+):(#(?:[0-9a-f]{6}))/gi)].map(([, key, value]) => [key, value]));
  for (const [foreground, background] of [['text','bg'],['text','panel'],['text','panel-soft'],['text','code'],['muted','bg'],['muted','panel'],['muted','selected'],['accent','bg'],['accent','panel'],['accent-text','accent'],['green','valid-soft'],['red','error-soft'],['amber','warn-soft']]) {
    const ratio = contrast(palette[foreground], palette[background]);
    assert.ok(ratio >= 4.5, `${mode}: ${foreground} on ${background} needs 4.5:1 text contrast; found ${ratio.toFixed(2)}`);
  }
}
assert.ok(/\.theme-toggle\{[^}]*min-height:44px/.test(expectedStyle), 'Theme action needs a touch target of at least 44px');
assert.ok(!/@import|url\(/i.test(expectedStyle), 'Shared appearance must work without external fonts or assets');
for (let index = 0; index < protectedFiles.length; index++) assert.equal(digest(protectedFiles[index]), originalFiles[index], 'Theme changes must never rewrite signed artifacts');
console.log('PASS: shared brand/theme assets, actual three-page scripts, persistence, guarded storage, FR/EN actions, palette text contrast and unchanged signed data. Browser layout not assessed.');
