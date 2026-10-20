// Exécute le JavaScript du configurateur généré dans un DOM minimal, sans réseau.
// Ce contrôle porte sur les interactions et les données ; il ne valide pas le rendu visuel.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const html = fs.readFileSync(process.argv[2] || 'output/configurator.html', 'utf8');
assert.ok(!/@@[A-Z_]+@@/.test(html), 'Le HTML généré ne doit pas contenir de marqueur de modèle');
assert.ok(!html.includes('data-template-only'), 'Le résultat généré ne doit pas rediriger vers lui-même');
const root = path.resolve(__dirname, '..');
const axes = JSON.parse(fs.readFileSync(path.join(root, 'references/axes.json'), 'utf8'));
const rules = JSON.parse(fs.readFileSync(path.join(root, 'references/rules.json'), 'utf8'));
const fixtures = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/structure.json'), 'utf8'));
const fields = Object.keys(axes);
const anchorClicks = [];
const decode = text => text.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.childNodes = [];
    this.attributes = {};
    this.events = {};
    this.style = {};
    this.dataset = {};
    this.parentNode = null;
    this.text = '';
    this._value = '';
    this.hidden = false;
    this.disabled = false;
    this.classList = {
      add: (...values) => this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...values])].join(' '),
      remove: (...values) => this.className = this.className.split(/\s+/).filter(value => !values.includes(value)).join(' '),
      contains: value => this.className.split(/\s+/).includes(value),
      toggle: (value, force) => {
        const add = force === undefined ? !this.classList.contains(value) : force;
        this.classList[add ? 'add' : 'remove'](value);
        return add;
      },
    };
  }
  get id() { return this.attributes.id || ''; }
  set id(value) { this.attributes.id = String(value); }
  get className() { return this.attributes.class || ''; }
  set className(value) { this.attributes.class = String(value); }
  get href() { return this.attributes.href || ''; }
  set href(value) { this.attributes.href = String(value); }
  get download() { return this.attributes.download || ''; }
  set download(value) { this.attributes.download = String(value); }
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
      if (!(item instanceof Element)) { const textNode = new Element('#text'); textNode.text = String(item); item = textNode; }
      item.parentNode = this;
      this.childNodes.push(item);
    }
  }
  appendChild(item) { this.append(item); return item; }
  replaceChildren(...items) { this.childNodes = []; this.text = ''; this.append(...items); }
  remove() {
    if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(child => child !== this);
    this.parentNode = null;
  }
  setAttribute(key, value) {
    this.attributes[key] = String(value);
    if (key === 'value') this.value = value;
    if (key === 'disabled') this.disabled = true;
    if (key === 'hidden') this.hidden = true;
    if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
  }
  getAttribute(key) { return this.attributes[key] ?? null; }
  hasAttribute(key) { return Object.hasOwn(this.attributes, key); }
  removeAttribute(key) {
    delete this.attributes[key];
    if (key === 'disabled') this.disabled = false;
    if (key === 'hidden') this.hidden = false;
  }
  addEventListener(type, callback) { (this.events[type] ||= []).push(callback); }
  dispatchEvent(event) {
    event.target ||= this;
    event.currentTarget = this;
    event.preventDefault ||= () => { event.defaultPrevented = true; };
    for (const callback of this.events[event.type] || []) callback(event);
    if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  click() {
    if (this.disabled) return;
    if (this.tagName === 'A') anchorClicks.push({href: this.href, download: this.download});
    this.dispatchEvent({type: 'click'});
  }
  focus() { document.activeElement = this; }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(value => this.matches(value.trim()));
    const attrMatches = [...selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)];
    const clean = selector.replace(/\[[^\]]+\]/g, '');
    const id = clean.match(/#([\w-]+)/)?.[1];
    const cls = clean.match(/\.([\w-]+)/)?.[1];
    const tag = clean.match(/^[a-z][\w-]*/i)?.[0];
    return (!id || this.id === id) && (!cls || this.classList.contains(cls)) && (!tag || this.tagName === tag.toUpperCase())
      && attrMatches.every(([, key, value]) => this.hasAttribute(key) && (value === undefined || this.getAttribute(key) === value));
  }
  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches(selector)) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
}

const document = new Element('document');
document.createElement = name => new Element(name);
document.getElementById = id => document.querySelector(`#${id}`);
document.createTextNode = text => { const node = new Element('#text'); node.text = String(text); return node; };
const stack = [document];
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
for (const token of html.matchAll(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<\/?[^>]+>|[^<]+/gi)) {
  const raw = token[0];
  if (raw.startsWith('<!--') || raw.startsWith('<!')) continue;
  if (raw.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
  if (!raw.startsWith('<')) { const textNode = document.createTextNode(decode(raw)); stack.at(-1).append(textNode); continue; }
  const match = raw.match(/^<([\w-]+)\b([^>]*)>/);
  if (!match) continue;
  const [, name, attrs] = match;
  const element = document.createElement(name);
  for (const attr of attrs.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) element.setAttribute(attr[1], decode(attr[2] ?? attr[3] ?? attr[4] ?? ''));
  stack.at(-1).append(element);
  if (name === 'script' || name === 'style') element.textContent = raw.slice(match[0].length, raw.lastIndexOf('</'));
  else if (!voidTags.has(name) && !raw.endsWith('/>')) stack.push(element);
}
document.body = document.querySelector('body');
document.documentElement = document.querySelector('html');
// Les identifiants du gabarit restent en place ; les cartes dynamiques n'en ont pas.
// Conserver ces références évite un parcours de tout le DOM à chaque rendu.
const fixedElements = new Map(document.querySelectorAll('[id]').map(element => [element.id, element]));
document.getElementById = id => fixedElements.get(id) || document.querySelector(`#${id}`);
document.activeElement = null;
for (const select of document.querySelectorAll('select')) select.value = select.options.find(option => option.hasAttribute('selected'))?.value ?? select.options[0]?.value ?? '';
const get = id => { const element = document.getElementById(id); assert.ok(element, `Élément absent : ${id}`); return element; };
const model = JSON.parse(get('configurator-model').textContent);
const blobs = [];
class BlobStub {
  constructor(parts, options) { this.parts = parts; this.type = options?.type || ''; blobs.push(this); }
}
const context = {document, console, Blob: BlobStub,
  URL: {createObjectURL: () => 'blob:configurator-test', revokeObjectURL() {}},
  setTimeout: callback => { callback(); return 1; }, clearTimeout() {},
  Event: class { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } },
};
context.window = context;
new vm.Script(get('configurator-script').textContent, {filename: 'generated-configurator.js'}).runInNewContext(context, {timeout: 3000});
assert.equal(document.activeElement, null, 'Le chargement initial ne doit pas déplacer le focus');

const oracle = config => rules.filter(rule => config[rule.cf] === rule.cv && !rule.av.includes(config[rule.rf])).map(rule => rule.clause_id);
const selection = () => Object.fromEntries(fields.map(field => [field, get(`field-${field}`).value]));
function choose(config) {
  for (const field of fields) {
    get(`field-${field}`).value = config[field];
    get(`field-${field}`).dispatchEvent({type: 'change'});
  }
}
function configurations() {
  let result = [{}];
  for (const field of fields) result = result.flatMap(config => axes[field].map(value => ({...config, [field]: value})));
  return result;
}

assert.equal(model.schema, 'demo-configurator/v1');
assert.equal(model.draft_schema, 'demo-configuration-draft/v1');
assert.equal(model.signature_status, 'UNSIGNED');
assert.equal(model.unsigned, true);
assert.deepEqual(model.axes, axes);
assert.deepEqual(model.rules, rules);
assert.equal(model.provenance.external_catalogue, 'STRUCTURAL_MATCH');
assert.equal(model.provenance.invariants, 'STATIC_REVIEW_PARTIAL_SCOPE');
assert.equal(model.provenance.alignment_target.version, '5.7');
assert.equal(model.provenance.alignment_target.status, 'BASE_CONFIRMED_PROMOTION_PLANNED');
assert.equal(model.provenance.alignment_target.base_version, '5.6.1');
assert.equal(model.provenance.alignment_target.execution_compatibility, 'NOT_VERIFIED');
assert.ok(model.provenance.rules_version);
for (const key of ['rules_sha256', 'axes_sha256']) assert.match(model.provenance[key], /^[a-f0-9]{64}$/);
// Les références n'utilisent que des objets, tableaux et chaînes : ce tri des clés
// donne leur forme JSON canonique et permet de contrôler la provenance sans Python.
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
  : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  : JSON.stringify(value);
const hash = value => crypto.createHash('sha256').update(canonical(value), 'utf8').digest('hex');
assert.equal(model.provenance.rules_sha256, hash(rules));
assert.equal(model.provenance.axes_sha256, hash(axes));
assert.equal(model.configurations.length, 144);
assert.equal(new Set(model.configurations.map(config => config.id)).size, 144);
assert.equal(new Set(model.configurations.map(config => JSON.stringify(config.configuration))).size, 144);
assert.equal(model.statistics.total, 144);
assert.equal(model.statistics.admissible, 42);
assert.equal(model.statistics.rejected, 102);

const configKey = config => fields.map(field => config[field]).join('|');
const bySelection = new Map(model.configurations.map(entry => [configKey(entry.configuration), entry]));
const byId = new Map(model.configurations.map(entry => [entry.id, entry]));
const valid = configurations().filter(config => oracle(config).length === 0);
const distance = (left, right) => fields.filter(field => left[field] !== right[field]).length;
const isRuntime = config => fields.every(field => config[field] === model.runtime_configuration[field]);
const ruleResults = config => rules.map(rule => ({
  clause_id: rule.clause_id, rule_id: rule.rule_id, message: rule.desc, fields: [rule.cf, rule.rf],
  condition: {field: rule.cf, value: rule.cv, actual: config[rule.cf]},
  requirement: {field: rule.rf, allowed: rule.av, actual: config[rule.rf]},
  status: config[rule.cf] !== rule.cv ? 'NOT_APPLICABLE' : rule.av.includes(config[rule.rf]) ? 'SATISFIED' : 'VIOLATED',
}));
const statusLabels = {SATISFIED: 'Satisfaite', VIOLATED: 'Violée', NOT_APPLICABLE: 'Non applicable'};
function assertJourneyView(view) {
  const configuration = view === 'configuration';
  assert.equal(get('workspace').hidden, !configuration, 'La vue configuration doit suivre le choix du parcours');
  assert.equal(get('rules-scope').hidden, configuration, 'La vue des règles doit être réellement affichée');
  assert.equal(get('journey-config').getAttribute('aria-pressed'), String(configuration));
  assert.equal(get('journey-rules').getAttribute('aria-pressed'), String(!configuration));
}
const violationsShown = () => get('violation-list').querySelectorAll('li[data-clause-id]').map(item => {
  const clause = item.getAttribute('data-clause-id');
  assert.ok(item.textContent.includes(clause), `Identifiant de clause absent du texte : ${clause}`);
  return clause;
});
assert.equal(valid.length, 42);
assert.equal(model.configurations.filter(config => config.runtime_supported).length, 1);
assertJourneyView('configuration');
assert.equal(get('rules-heading').getAttribute('tabindex'), '-1');
assert.equal(get('rules-summary').getAttribute('role'), 'status');

for (const config of configurations()) {
  const entry = bySelection.get(configKey(config));
  assert.ok(entry, `Configuration absente du modèle : ${configKey(config)}`);
  const expected = oracle(config);
  assert.equal(entry.admissible, expected.length === 0);
  assert.deepEqual(entry.violations.map(violation => violation.clause_id), expected);
  const expectedRules = ruleResults(config);
  assert.deepEqual(entry.rule_results, expectedRules, `Évaluation explicite des sept règles : ${configKey(config)}`);
  const implicated = [...new Set(rules.filter(rule => expected.includes(rule.clause_id)).flatMap(rule => [rule.cf, rule.rf]))].sort();
  assert.deepEqual([...entry.highlighted_fields].sort(), implicated);
  assert.equal(entry.runtime_supported, isRuntime(config));
  assert.equal(entry.guarantees_status, isRuntime(config) && model.demo.available ? 'LOCAL_DEMO_TESTED' : 'NOT_DEMONSTRATED');
  const targets = new Set();
  for (const suggestion of entry.suggestions) {
    const target = byId.get(suggestion.target_id);
    assert.ok(target?.admissible, `Suggestion non admissible depuis ${entry.id}`);
    assert.ok(!targets.has(suggestion.target_id), 'Suggestion en doublon');
    targets.add(suggestion.target_id);
    const actualDistance = distance(config, target.configuration);
    assert.equal(suggestion.distance, actualDistance);
    assert.equal(suggestion.distance, Math.min(...valid.map(candidate => distance(config, candidate))));
    const changes = fields.filter(field => config[field] !== target.configuration[field])
      .map(field => ({field, from: config[field], to: target.configuration[field]}));
    assert.deepEqual(suggestion.changes, changes);
  }
  if (expected.length) assert.ok(entry.suggestions.length > 0, 'Chaque rejet exige une correction explicite');
  if (expected.length) {
    const minimum = Math.min(...valid.map(candidate => distance(config, candidate)));
    const nearest = valid.filter(candidate => distance(config, candidate) === minimum).map(candidate => bySelection.get(configKey(candidate)).id).sort();
    assert.deepEqual([...targets].sort(), nearest, 'Toutes les corrections à distance minimale doivent être proposées');
  }

  choose(config);
  assert.deepEqual(selection(), config);
  assert.deepEqual([...new Set(violationsShown())].sort(), [...expected].sort(), `Clauses affichées pour ${configKey(config)}`);
  for (const field of fields) {
    assert.equal(get(`field-${field}`).getAttribute('aria-invalid'), String(implicated.includes(field)), `Mise en évidence de ${field}`);
    assert.equal(get(`panel-${field}`).getAttribute('aria-invalid'), String(implicated.includes(field)), `Groupe impliqué : ${field}`);
    assert.equal(get(`error-${field}`).hidden,!implicated.includes(field));
    assert.equal(get(`field-${field}`).getAttribute('aria-describedby').includes(`error-${field}`),implicated.includes(field));
    if(implicated.includes(field))for(const clause of expectedRules.filter(rule=>rule.status==='VIOLATED'&&rule.fields.includes(field)))assert.ok(get(`error-${field}`).textContent.includes(clause.clause_id));
  }
  assert.equal(get('validity-status').getAttribute('data-status'), expected.length ? 'rejected' : 'admissible');
  assert.equal(get('runtime-status').getAttribute('data-status'), isRuntime(config) ? 'supported' : 'unsupported');
  assert.equal(get('guarantees-status').getAttribute('data-status'), entry.guarantees_status);
  assert.ok(get('validity-status').textContent.length > 0);
  assert.ok(get('runtime-status').textContent.length > 0);
  assert.ok(get('guarantees-status').textContent.length > 0);
  const currentVisible = get('current-config').textContent;
  for (const field of fields) assert.ok(currentVisible.includes(config[field]), `Valeur courante absente : ${field}`);
  const correctionButtons = get('suggestions').querySelectorAll('button[data-target-id]');
  assert.equal(correctionButtons.length, entry.suggestions.length);
  for (const button of correctionButtons) assert.ok(targets.has(button.getAttribute('data-target-id')));
  const actionable = isRuntime(config) && model.demo.available;
  if(actionable){
    const destination=new URL(get('demo-link').getAttribute('href'),'https://demo.test/output/');
    assert.equal(destination.pathname,'/output/report.html');
    assert.equal(destination.searchParams.get('cfg'),entry.id);
    assert.equal(destination.searchParams.get('step'),String(fields.findIndex((_,index)=>get('step-'+index).getAttribute('aria-current')==='step')+1));
  }else assert.equal(get('demo-link').getAttribute('href'),null);
  assert.equal(get('demo-link').getAttribute('aria-disabled'), String(!actionable));
  for (const [id, fragment] of [['journey-demo', 'parcours'], ['journey-evidence', 'preuves']]) {
    if(actionable){
      const destination=new URL(get(id).getAttribute('href'),'https://demo.test/output/');
      assert.equal(destination.pathname,'/output/report.html');
      assert.equal(destination.hash,'#'+fragment);
      assert.equal(destination.searchParams.get('cfg'),entry.id);
    }else assert.equal(get(id).getAttribute('href'),null);
    assert.equal(get(id).getAttribute('aria-disabled'), String(!actionable));
    if (!actionable) assert.equal(get(id).getAttribute('tabindex'), '-1');
  }

  // L'étape 02 doit ouvrir une lecture réelle de la sélection et de toutes les règles.
  const snapshot = get('initial-config').textContent;
  get('journey-rules').click();
  assertJourneyView('rules');
  assert.equal(document.activeElement, get('rules-heading'));
  assert.deepEqual(selection(), config, 'Consulter les règles ne doit pas remplacer la sélection');
  const summary = get('scope-config-summary');
  const summaryButtons = summary.querySelectorAll('button[data-edit-field]');
  assert.equal(summaryButtons.length, 4);
  for (const field of fields) {
    assert.ok(summary.textContent.includes(config[field]), `Périmètre retenu absent : ${field}`);
    assert.ok(summaryButtons.some(button => button.getAttribute('data-edit-field') === field));
  }
  assert.ok(get('scope-description').textContent.length > 0);
  assert.ok(get('rules-summary').textContent.length > 0);
  const counts = Object.fromEntries(Object.keys(statusLabels).map(status => [status, expectedRules.filter(result => result.status === status).length]));
  assert.ok(get('rules-summary').textContent.includes(`${counts.SATISFIED} satisfaite(s)`));
  assert.ok(get('rules-summary').textContent.includes(`${counts.VIOLATED} violée(s)`));
  assert.ok(get('rules-summary').textContent.includes(`${counts.NOT_APPLICABLE} non applicable(s)`));
  const cards = get('rule-results').querySelectorAll('article[data-clause-id]');
  assert.equal(cards.length, 7);
  for (const result of expectedRules) {
    const card = cards.find(item => item.getAttribute('data-clause-id') === result.clause_id);
    assert.ok(card, `Carte absente : ${result.clause_id}`);
    assert.equal(card.getAttribute('data-rule-status'), result.status, `Statut affiché de ${result.clause_id}`);
    assert.ok(card.textContent.includes(statusLabels[result.status]), `Statut lisible de ${result.clause_id} : ${result.status}`);
    for (const value of [result.clause_id, result.message, result.condition.value, result.condition.actual, result.requirement.actual, ...result.requirement.allowed]) {
      assert.ok(card.textContent.includes(value), `Donnée de règle absente : ${result.clause_id} / ${value}`);
    }
    const editFields = card.querySelectorAll('button[data-edit-field]').map(button => button.getAttribute('data-edit-field')).sort();
    assert.deepEqual(editFields, [...new Set(result.fields)].sort());
  }
  get('journey-config').click();
  assertJourneyView('configuration');
  assert.deepEqual(selection(), config);
  assert.equal(get('initial-config').textContent, snapshot, 'La consultation doit préserver le point de départ');
}

// Chaque règle et chaque champ de la vue 02 doivent ramener à un contrôle utilisable.
choose(model.runtime_configuration);
for (const field of fields) {
  get('journey-rules').click();
  const edit = get('scope-config-summary').querySelectorAll('button[data-edit-field]').find(button => button.getAttribute('data-edit-field') === field);
  edit.click();
  assertJourneyView('configuration');
  assert.equal(get(`panel-${field}`).hidden, false);
  assert.equal(document.activeElement, get(`field-${field}`));
  assert.deepEqual(selection(), model.runtime_configuration);
}
for (const rule of rules) {
  for (const field of [...new Set([rule.cf, rule.rf])]) {
    get('journey-rules').click();
    const card = get('rule-results').querySelectorAll('article[data-clause-id]').find(item => item.getAttribute('data-clause-id') === rule.clause_id);
    const edit = card.querySelectorAll('button[data-edit-field]').find(button => button.getAttribute('data-edit-field') === field);
    edit.click();
    assertJourneyView('configuration');
    assert.equal(get(`panel-${field}`).hidden, false);
    assert.equal(document.activeElement, get(`field-${field}`));
    assert.deepEqual(selection(), model.runtime_configuration);
  }
}
get('step-3').click();
get('review-rules').click();
assertJourneyView('rules');
assert.equal(document.activeElement, get('rules-heading'));
get('back-to-config').click();
assertJourneyView('configuration');
assert.equal(document.activeElement, get('field-UNCERTAINTY'));
assert.equal(get('panel-UNCERTAINTY').hidden, false);
assert.deepEqual(selection(), model.runtime_configuration);

// Les fixtures nommées fixent les cas cumulant des clauses, indépendamment de l'énumération.
for (const fixture of fixtures) {
  const config = {HOST_SCOPE: fixture.host, DEDUP_LAYER: fixture.dedup, CONCURRENCY: fixture.concurrency, UNCERTAINTY: 'fail-closed'};
  choose(config);
  assert.deepEqual([...new Set(violationsShown())].sort(), [...fixture.expected].sort(), fixture.name);
}

// Parcours clavier natif : les boutons pilotent les quatre étapes sans changer la configuration.
get('reset-config').click();
assert.equal(get('previous-step').disabled, true);
for (let step = 0; step < 4; step++) {
  assert.ok(get('step-progress').textContent.includes(`${step + 1}`));
  assert.ok(get('step-progress').textContent.includes('4'));
  for (let panel = 0; panel < 4; panel++) assert.equal(get(`panel-${fields[panel]}`).hidden, panel !== step);
  if (step < 3) {
    get('next-step').click();
    assert.equal(document.activeElement, get(`field-${fields[step + 1]}`), 'Continuer doit amener le clavier au nouveau choix');
  }
}
assert.equal(get('next-step').disabled, false, 'La dernière étape doit proposer une sortie du parcours');
assert.match(get('next-step').textContent,/Examiner/);
get('next-step').click();
assertJourneyView('rules');
assert.equal(get('rules-demo-link').hidden,false);
assert.equal(document.activeElement,get('rules-heading'));
get('back-to-config').click();
get('previous-step').click();
assert.equal(get(`panel-${fields[2]}`).hidden, false);
assert.equal(document.activeElement, get(`field-${fields[2]}`));
get('step-0').click();
assert.equal(get(`panel-${fields[0]}`).hidden, false);
assert.equal(document.activeElement, get(`field-${fields[0]}`));

// Une correction reste un choix ; son application garde le point de départ auditable.
get('reset-config').click();
const rejected = {HOST_SCOPE: 'mono-process', DEDUP_LAYER: 'distributed-consensus-registry', CONCURRENCY: 'distributed-consensus', UNCERTAINTY: 'fail-open'};
choose(rejected);
const beforeCorrection = {...selection()};
assert.deepEqual(beforeCorrection, rejected);
const fieldLink = get('violation-list').querySelector('button');
fieldLink.click();
const linkedField = fields.find(field => fieldLink.textContent.startsWith(field));
assert.equal(document.activeElement, get(`field-${linkedField}`));
assert.equal(get(`panel-${linkedField}`).hidden, false);
const correction = get('suggestions').querySelector('button[data-target-id]');
assert.ok(correction);
const selectedTarget = byId.get(correction.getAttribute('data-target-id'));
correction.click();
assert.deepEqual(selection(), selectedTarget.configuration);
assert.equal(get('change-feedback').hidden,false);
get('undo-change').click();
assert.deepEqual(selection(),beforeCorrection,'Annuler une correction doit rétablir le choix précédent');
assert.equal(get('change-feedback').hidden,true);
get('suggestions').querySelector(`button[data-target-id="${selectedTarget.id}"]`).click();
assert.equal(document.activeElement, get('validity-status'), 'Appliquer une correction doit conserver une cible de focus présente');
const initial = JSON.parse(get('initial-config').textContent);
assert.deepEqual(initial, beforeCorrection);
const frozenInitial = get('initial-config').textContent;
// La traduction change la présentation sans réécrire les règles ni la sélection.
get('step-2').click();
const frenchStepTitle = get('step-title').textContent;
const originalModelText = get('configurator-model').textContent;
get('journey-rules').click();
assertJourneyView('rules');
assert.equal(document.documentElement.getAttribute('lang'), 'fr');
assert.equal(get('language-fr').getAttribute('aria-pressed'), 'true');
get(document.documentElement.getAttribute('lang')==='fr'?'language-en':'language-fr').click();
assert.equal(document.documentElement.getAttribute('lang'), 'en');
assert.equal(get('language-en').getAttribute('aria-pressed'), 'true');
assertJourneyView('rules');
assert.deepEqual(selection(), selectedTarget.configuration);
assert.equal(get('initial-config').textContent, frozenInitial);
assert.equal(get('configurator-model').textContent, originalModelText, 'La traduction doit conserver les règles source intégrées');
assert.equal(get('panel-CONCURRENCY').hidden, false);
assert.notEqual(get('step-title').textContent, frenchStepTitle);
const englishStatusLabels = {SATISFIED: 'Satisfied', VIOLATED: 'Violated', NOT_APPLICABLE: 'Not applicable'};
for (const card of get('rule-results').querySelectorAll('article[data-clause-id]')) {
  const status = card.getAttribute('data-rule-status');
  assert.ok(card.textContent.includes(englishStatusLabels[status]), `Statut de règle en anglais : ${status}`);
  const sourceRule = rules.find(rule => rule.clause_id === card.getAttribute('data-clause-id'));
  assert.ok(!card.textContent.includes(sourceRule.desc), `L'explication de ${sourceRule.clause_id} doit être traduite en anglais`);
}
const translatedStatic = document.querySelectorAll('[data-fr][data-en]');
assert.ok(translatedStatic.length > 0, 'Les textes statiques doivent disposer de traductions');
for (const element of translatedStatic) assert.equal(element.textContent, element.getAttribute('data-en'));
get(document.documentElement.getAttribute('lang')==='fr'?'language-en':'language-fr').click();
assert.equal(document.documentElement.getAttribute('lang'), 'fr');
assert.equal(get('language-fr').getAttribute('aria-pressed'), 'true');
assert.equal(get('step-title').textContent, frenchStepTitle);
assertJourneyView('rules');
assert.equal(get('initial-config').textContent, frozenInitial);
assert.deepEqual(selection(), selectedTarget.configuration);
get('journey-rules').click();
get('journey-config').click();
assert.equal(get('initial-config').textContent, frozenInitial);
assert.deepEqual(selection(), selectedTarget.configuration);
choose({...rejected, UNCERTAINTY: 'human-escalation'});
get('suggestions').querySelector('button[data-target-id]').click();
assert.equal(get('initial-config').textContent, frozenInitial, 'Les corrections suivantes doivent conserver le premier point de départ');
choose(model.runtime_configuration);
assert.equal(get('initial-config').textContent, frozenInitial, 'La configuration initiale doit résister aux changements suivants');

// Le téléchargement est un brouillon lié aux règles, jamais une preuve d'exécution signée.
get('export-config').click();
assert.equal(blobs.length, 1);
assert.equal(blobs[0].type, 'application/json');
assert.equal(anchorClicks.length, 1);
assert.match(anchorClicks[0].download, /\.json$/);
const draft = JSON.parse(blobs[0].parts.join(''));
assert.equal(draft.schema, 'demo-configuration-draft/v1');
assert.equal(draft.signature_status, 'UNSIGNED');
assert.equal(draft.unsigned, true);
assert.ok(!Object.hasOwn(draft, 'signature'));
assert.deepEqual(draft.configuration, model.runtime_configuration);
assert.deepEqual(draft.initial_configuration, beforeCorrection);
assert.deepEqual(draft.provenance, model.provenance);
assert.equal(draft.structural_validation.admissible, true);
assert.deepEqual(draft.structural_validation.violations, []);
assert.equal(draft.structural_validation.runtime_supported, true);
assert.equal(draft.execution.state, 'NOT_EXECUTED');
assert.equal(draft.execution.demonstrated_guarantees, 'NOT_ASSESSED_FOR_THIS_DRAFT');

get('reset-config').click();
assert.deepEqual(selection(), model.runtime_configuration);
assert.deepEqual(JSON.parse(get('initial-config').textContent), model.runtime_configuration);
choose(rejected);
get('export-config').click();
const rejectedDraft = JSON.parse(blobs.at(-1).parts.join(''));
assert.deepEqual(rejectedDraft.configuration, rejected);
assert.equal(rejectedDraft.structural_validation.admissible, false);
assert.equal(rejectedDraft.structural_validation.runtime_supported, false);
assert.deepEqual(rejectedDraft.structural_validation.violations.map(violation => violation.clause_id), oracle(rejected));
assert.equal(rejectedDraft.signature_status, 'UNSIGNED');
assert.equal(rejectedDraft.execution.state, 'NOT_EXECUTED');
assert.ok(get('invariants-status').textContent.includes('périmètre partiel'));

// Une architecture admissible hors runtime offre un retour explicite et réversible au profil local.
get('reset-config').click();
const outside=valid.find(config=>!isRuntime(config));
choose(outside);
assert.equal(get('local-profile-recovery').hidden,false);
get('journey-rules').click();
assert.equal(get('rules-use-local').hidden,false);
assert.equal(get('rules-demo-link').hidden,true);
get('rules-use-local').click();
assertJourneyView('configuration');
assert.deepEqual(selection(),model.runtime_configuration);
assert.deepEqual(JSON.parse(get('initial-config').textContent),outside);
get('undo-change').click();
assert.deepEqual(selection(),outside);
get('use-local-profile').click();
get('field-UNCERTAINTY').value='human-escalation';
get('field-UNCERTAINTY').dispatchEvent({type:'change'});
assert.equal(get('change-feedback').hidden,true,'Une modification manuelle remplace le contexte du changement automatique');
get('header-config-link').click();
assertJourneyView('configuration');
assert.equal(get('skip-content').getAttribute('href'),'#workspace');
get('journey-rules').click();
assert.equal(get('skip-content').getAttribute('href'),'#rules-heading');

// Sans dossier vérifié, même le profil pris en charge ne donne accès à aucune preuve.
// Le scénario est injecté seulement en mémoire dans le même script réellement généré.
const unavailable = JSON.parse(JSON.stringify(model));
unavailable.demo = {...unavailable.demo, available: false, report_href: null, status: 'UNAVAILABLE', verification: null};
for (const entry of unavailable.configurations) entry.guarantees_status = 'NOT_DEMONSTRATED';
get('configurator-model').textContent = JSON.stringify(unavailable);
for (const element of [document, ...document.querySelectorAll('*')]) element.events = {};
document.activeElement = null;
const unavailableContext = {...context};
unavailableContext.window = unavailableContext;
new vm.Script(get('configurator-script').textContent, {filename: 'generated-configurator-without-evidence.js'}).runInNewContext(unavailableContext, {timeout: 3000});
assert.equal(document.activeElement, null);
assert.deepEqual(selection(), model.runtime_configuration);
assert.equal(get('runtime-status').getAttribute('data-status'), 'supported');
assert.equal(get('guarantees-status').getAttribute('data-status'), 'NOT_DEMONSTRATED');
assert.equal(get('demo-link').getAttribute('href'), null);
assert.equal(get('demo-link').getAttribute('aria-disabled'), 'true');
assert.equal(get('demo-link').getAttribute('tabindex'), '-1');
for (const id of ['journey-demo', 'journey-evidence']) {
  assert.equal(get(id).getAttribute('href'), null);
  assert.equal(get(id).getAttribute('aria-disabled'), 'true');
  assert.equal(get(id).getAttribute('tabindex'), '-1');
}
get('journey-rules').click();
assertJourneyView('rules');
assert.equal(document.activeElement, get('rules-heading'));
console.log('PASS : 144 configurations, 1 008 statuts de règle, vue règles/périmètre, corrections minimales, navigation clavier, export non signé et liens de preuve vérifiés. Rendu visuel non évalué.');
