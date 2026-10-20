// Execute the generated report and landing scripts without network access.
// This checks behavior and bilingual text; browser layout is not assessed.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(process.argv[2] || 'output/report.html', 'utf8');
const decode = value => value.replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

class Element {
  constructor() { this.children = []; this.attributes = {}; this.events = {}; this.style = {}; this.text = ''; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(' '); }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.text = ''; this.children = items; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  addEventListener(key, callback) { this.events[key] = callback; }
  focus() { this.focused = true; }
}
function mockDocument(page) {
  const elements = new Map(), bilingual = [];
  for (const [, attributes] of page.matchAll(/<[a-z][\w-]*\b([^>]*)>/gi)) {
    const parsed = Object.fromEntries([...attributes.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decode(value)]));
    if (!parsed.id && !(Object.hasOwn(parsed, 'data-fr') && Object.hasOwn(parsed, 'data-en'))) continue;
    const element = new Element();
    for (const [key, value] of Object.entries(parsed)) element.setAttribute(key, value);
    if (parsed.id) elements.set(parsed.id, element);
    if (Object.hasOwn(parsed, 'data-fr') && Object.hasOwn(parsed, 'data-en')) bilingual.push(element);
  }
  const document = {
    documentElement: {lang: 'fr'},
    getElementById(id) { assert.ok(elements.has(id), `Missing element: ${id}`); return elements.get(id); },
    createElement() { return new Element(); },
    querySelectorAll(selector) { assert.equal(selector, '[data-fr][data-en]'); return bilingual; },
  };
  return {document, elements, bilingual};
}
function storage(initial, throws = false) {
  const values = new Map(initial ? [['tenir-reg-language', initial]] : []);
  return {
    getItem(key) { if (throws) throw new Error('file origin storage unavailable'); return values.get(key) ?? null; },
    setItem(key, value) { if (throws) throw new Error('file origin storage unavailable'); values.set(key, value); },
    values,
  };
}
function checkStaticLanguage(state, language) {
  assert.equal(state.document.documentElement.lang, language);
  assert.equal(state.elements.get('language-'+language).getAttribute('aria-pressed'), 'true');
  assert.equal(state.elements.get('language-'+(language === 'fr' ? 'en' : 'fr')).getAttribute('aria-pressed'), 'false');
  for (const element of state.bilingual) assert.equal(element.textContent, element.getAttribute('data-'+language));
}

const embedded = html.match(/<script type="application\/json" id="signed-model">([\s\S]*?)<\/script>/)[1];
const source = html.match(/<\/script><script>([\s\S]*?)<\/script>/)[1];
const expected = JSON.parse(embedded);
const defaultReportUrl = 'file:///C:/demo/output/report.html';
const reportStorageKey = 'tenir-reg-report:/C:/demo/output/';
function reportState(localStorage = storage(), options = {}) {
  const state = mockDocument(html);
  state.elements.get('signed-model').textContent = embedded;
  state.location = new URL(options.url || defaultReportUrl);
  state.sessionStorage = options.sessionStorage || storage();
  state.replacements = [];
  const environment = {document: state.document, localStorage};
  if (!options.missingNavigation) Object.assign(environment, {
    URLSearchParams,
    location: state.location,
    history: {replaceState(value, unused, href) {
      if (options.deniedHistory) throw new Error('History unavailable for local file');
      state.replacements.push(href);
      state.location.href = new URL(href, state.location.href).href;
    }},
    sessionStorage: state.sessionStorage,
  });
  state.context = vm.createContext(environment);
  new vm.Script(source, {filename: 'generated-report.js'}).runInContext(state.context, {timeout: 2000});
  return state;
}
const state = reportState(), elements = state.elements;
assert.ok(html.includes('id="preuves"'), 'The evidence section keeps its navigation target');
assert.ok(html.includes('class="skip-link" href="#parcours"'), 'Keyboard users can skip directly to the scenario selector');
assert.ok(html.includes('id="audit-details"><summary>'), 'Technical tests, rules and scope start collapsed');
assert.ok(!/id="audit-details"[^>]*\bopen\b/.test(html), 'Technical detail does not dominate the primary journey');
assert.ok(html.includes('prefers-reduced-motion:reduce'), 'Motion respects the operating system preference');
assert.ok(html.includes('min-height:44px'), 'Interactive controls have an explicit minimum target height');
assert.equal(elements.get('detail').getAttribute('role'), 'region');
assert.equal(elements.get('detail').getAttribute('aria-labelledby'), 'scenario-title');
assert.equal(elements.get('detail').getAttribute('aria-live'), null, 'A whole signed record is not announced on selection');
assert.equal(elements.get('selection-announcement').getAttribute('aria-live'), 'polite');
assert.equal(elements.get('scenarios').getAttribute('role'), 'group');
assert.equal(elements.get('scenarios').getAttribute('aria-describedby'), 'scenario-help');
assert.equal(expected.operations.length, 4);
checkStaticLanguage(state, 'fr');
assert.ok(elements.get('scenarios').children[0].textContent.includes('Autorisation'));
function checkSnapshot(target, index, language) {
  const payload = expected.operations[index].payload;
  const locale = language === 'en' ? 'en-GB' : 'fr-FR';
  for (const field of ['consumed', 'reserved']) {
    assert.equal(target.elements.get(field).textContent, payload.budget_after[field].toLocaleString(locale),
      `Header ${field} must reflect the selected signed event`);
  }
  assert.equal(target.elements.get('calls').textContent, payload.provider_journal.length.toLocaleString(locale));
  assert.equal(target.elements.get('available').textContent, expected.final_budget.available.toLocaleString(locale),
    'Available budget remains explicitly labelled as the final budget');
  const counterContext = target.elements.get('counter-context').textContent;
  for (const value of [payload.operation_id, '#'+payload.sequence, new Date(payload.reference_time*1000).toISOString(),
                       language === 'en' ? 'Source: signed trace' : 'Source : trace signée']) {
    assert.ok(counterContext.includes(value), `Missing signed counter context: ${value}`);
  }
}
function checkEvidence(index) {
  const buttons = elements.get('scenarios').children;
  assert.equal(buttons.length, 4);
  buttons[index].events.click();
  buttons.forEach((button, position) => assert.equal(button.getAttribute('aria-pressed'), String(index === position)));
  buttons.forEach(button => assert.equal(button.getAttribute('aria-controls'), 'detail'));
  const record = expected.operations[index], detail = elements.get('detail');
  for (const value of [record.payload.operation_id, record.payload.decision.verdict,
                       record.payload.operation_state, record.integrity.payload_sha256]) {
    assert.ok(detail.textContent.includes(value), `Missing displayed evidence: ${value}`);
  }
  const rawRecord = detail.children.at(-1).children[1].textContent;
  assert.deepEqual(JSON.parse(rawRecord), record, 'Raw signed data must never be translated');
  assert.equal(elements.get('signed-model').textContent, embedded);
  assert.equal(vm.runInContext('JSON.stringify(model)', state.context), JSON.stringify(expected));
  checkSnapshot(state, index, state.document.documentElement.lang);
  assert.equal(state.location.searchParams.get('scenario'), record.payload.operation_id);
  assert.equal(state.sessionStorage.values.get(reportStorageKey), record.payload.operation_id);
  const link = new URL(elements.get('report-to-config').getAttribute('href'), state.location.href);
  assert.equal(link.pathname, '/C:/demo/output/configurator.html');
  assert.equal(link.searchParams.get('return'), 'demo');
  assert.equal(link.searchParams.get('scenario'), record.payload.operation_id);
  const language = state.document.documentElement.lang;
  assert.ok(detail.textContent.includes(language === 'en' ? 'Decision before dispatch' : 'Décision avant envoi'));
  assert.ok(detail.textContent.includes(language === 'en' ? 'Simulator outcome' : 'Résultat du simulateur'));
  assert.ok(elements.get('selection-announcement').textContent.includes(`${index+1} / 4`));
  const actions = detail.children.find(child => child.className === 'scenario-actions');
  assert.ok(actions, 'Each scenario exposes a concrete next step');
  const next = actions.children.find(child => child.getAttribute('data-action') === 'next-scenario');
  if (index < 3) assert.ok(next, 'The guided journey can continue to the next scenario');
  else {
    assert.equal(next, undefined, 'The final scenario ends the guided sequence');
    assert.ok(detail.textContent.includes(language === 'en' ? 'End of the guided journey' : 'Fin du parcours guidé'));
    assert.ok(actions.children.some(child => child.getAttribute('href') === '#preuves'));
    assert.ok(actions.children.some(child => child.getAttribute('href')?.startsWith('configurator.html?')));
  }
}
assert.deepEqual(expected.operations.map(record => record.payload.provider_journal.length), [1,1,1,2]);
assert.deepEqual(expected.operations.map(record => record.payload.budget_after.reserved), [0,0,0,10000]);
checkSnapshot(state, 0, 'fr');
for (let index = 0; index < 3; index++) {
  const actions = elements.get('detail').children.find(child => child.className === 'scenario-actions');
  actions.children.find(child => child.getAttribute('data-action') === 'next-scenario').events.click();
  checkSnapshot(state, index+1, 'fr');
  const heading = elements.get('detail').children[0];
  assert.equal(heading.getAttribute('id'), 'scenario-title');
  assert.equal(heading.getAttribute('tabindex'), '-1');
  assert.equal(heading.focused, true, 'Guided next moves keyboard focus to the new scenario heading');
}
assert.ok(elements.get('detail').textContent.includes('avant toute relance'), 'UNKNOWN explains the necessary check before a retry');
assert.ok(elements.get('detail').textContent.includes('historique reste PASS'), 'UNKNOWN preserves the authorization/execution distinction');
expected.operations.forEach((record, index) => checkEvidence(index));
checkEvidence(3);
checkEvidence(3);
assert.equal(elements.get('calls').textContent, '2', 'Selecting a scenario again never accumulates simulator calls');
elements.get('language-en').events.click();
checkStaticLanguage(state, 'en');
assert.ok(elements.get('scenarios').children[0].textContent.includes('Authorization'));
assert.equal(elements.get('scenarios').children[3].getAttribute('aria-pressed'), 'true', 'Language change keeps the selected scenario');
checkSnapshot(state, 3, 'en');
expected.operations.forEach((record, index) => {
  checkEvidence(index);
  assert.ok(elements.get('detail').textContent.includes('Evidence #'));
  assert.ok(elements.get('detail').textContent.includes('Inspect the signed record'));
});
assert.equal(elements.get('calls').textContent, '2');
assert.equal(elements.get('reserved').textContent, '10,000');
elements.get('language-fr').events.click();
checkStaticLanguage(state, 'fr');
assert.equal(elements.get('reserved').textContent.replace(/\s/g, ''), '10000');
checkStaticLanguage(reportState(storage('en')), 'en');
const denied = reportState(storage(null, true));
checkStaticLanguage(denied, 'fr');
denied.elements.get('language-en').events.click();
checkStaticLanguage(denied, 'en');

const savedSelection = storage();
savedSelection.values.set(reportStorageKey, expected.operations[2].payload.operation_id);
const restoredSelection = reportState(storage(), {sessionStorage: savedSelection});
checkSnapshot(restoredSelection, 2, 'fr');
assert.equal(restoredSelection.elements.get('scenarios').children[2].getAttribute('aria-pressed'), 'true');
const querySelection = reportState(storage(), {sessionStorage: savedSelection,
  url: defaultReportUrl+'?scenario='+expected.operations[1].payload.operation_id});
checkSnapshot(querySelection, 1, 'fr');
assert.equal(querySelection.elements.get('scenarios').children[1].getAttribute('aria-pressed'), 'true', 'Query selection takes precedence over session');
const malformedSelection = reportState(storage(), {sessionStorage: savedSelection,
  url: defaultReportUrl+'?scenario=does-not-exist'});
checkSnapshot(malformedSelection, 1, 'fr');
const anotherDossier = reportState(storage(), {sessionStorage: savedSelection,
  url: 'file:///C:/another-dossier/output/report.html'});
checkSnapshot(anotherDossier, 0, 'fr');
assert.equal(savedSelection.values.get('tenir-reg-report:/C:/another-dossier/output/'), expected.operations[0].payload.operation_id);

const cfg = 'cfg-6c7c0203b97c7282', initial = 'cfg-f47ac6d50be239a6';
const undo = 'cfg-1234567890abcdef';
const navigation = reportState(storage(), {url: defaultReportUrl+`?scenario=blocage&cfg=${cfg}&step=3&initial=${initial}&captured=1&undo=${undo}#preuves`});
navigation.elements.get('scenarios').children[3].events.click();
const backLink = new URL(navigation.elements.get('report-to-config').getAttribute('href'), navigation.location.href);
for (const [key, value] of Object.entries({return:'demo',scenario:expected.operations[3].payload.operation_id,cfg,step:'3',initial,captured:'1',undo})) {
  assert.equal(backLink.searchParams.get(key), value, `Report/config round trip preserves ${key}`);
}
assert.equal(navigation.location.hash, '#preuves', 'Scenario selection preserves the current section');
assert.equal(navigation.location.searchParams.get('cfg'), cfg);
for (const value of Object.values(expected.operations[0].payload.profile.configuration)) assert.ok(elements.get('executed-profile').textContent.includes(value));
assert.equal(elements.get('profile-context').hidden, true, 'No mismatch notice appears on a direct report visit');
const matchingProfile = reportState(storage(), {url: defaultReportUrl+'?cfg='+expected.runtime_configuration_id});
assert.equal(matchingProfile.elements.get('profile-context').hidden, true, 'The executed profile does not show a mismatch notice');
const differentProfile = reportState(storage(), {url: defaultReportUrl+'?cfg=cfg-0000000000000000'});
assert.equal(differentProfile.elements.get('profile-context').hidden, false, 'A preserved alternate selection is distinguished from the executed profile');
assert.ok(differentProfile.elements.get('profile-context').textContent.includes('uniquement le profil local'));
differentProfile.elements.get('language-en').events.click();
assert.ok(differentProfile.elements.get('profile-context').textContent.includes('only to the local profile'));
const filteredNavigation = reportState(storage(), {url: defaultReportUrl+'?cfg=invalid&step=5&initial=https%3A%2F%2Fexample.org&captured=true&return=https%3A%2F%2Fexample.org'});
const filteredBackLink = new URL(filteredNavigation.elements.get('report-to-config').getAttribute('href'), defaultReportUrl);
assert.deepEqual([...filteredBackLink.searchParams.keys()], ['return','scenario','loop'], 'Only validated configuration and current loop state are forwarded');
assert.equal(filteredBackLink.searchParams.get('loop'),'question');

const deniedNavigation = reportState(storage(null,true), {sessionStorage:storage(null,true),deniedHistory:true});
deniedNavigation.elements.get('scenarios').children[3].events.click();
deniedNavigation.elements.get('language-en').events.click();
checkSnapshot(deniedNavigation, 3, 'en');
const absentNavigation = reportState(storage(), {missingNavigation:true});
absentNavigation.elements.get('scenarios').children[1].events.click();
checkSnapshot(absentNavigation, 1, 'fr');
assert.equal(absentNavigation.elements.get('report-to-config').getAttribute('href'), 'configurator.html?return=demo&scenario=blocage');

const landing = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const landingScript = landing.match(/<script>([\s\S]*?)<\/script>/)[1];
function landingState(localStorage = storage()) {
  const state = mockDocument(landing);
  new vm.Script(landingScript, {filename: 'landing.js'}).runInNewContext({document: state.document, localStorage}, {timeout: 2000});
  return state;
}
const home = landingState();
checkStaticLanguage(home, 'fr');
home.elements.get('language-en').events.click();
checkStaticLanguage(home, 'en');
home.elements.get('language-fr').events.click();
checkStaticLanguage(home, 'fr');
checkStaticLanguage(landingState(storage('en')), 'en');
const homeDenied = landingState(storage(null, true));
homeDenied.elements.get('language-en').events.click();
checkStaticLanguage(homeDenied, 'en');
console.log('PASS: guided happy path and exception explanations, decision/execution separation, contextual return and undo, selected signed counters, executed-profile notice, keyboard focus, progressive audit disclosure, FR/EN and unchanged signed data. Browser layout not assessed.');
