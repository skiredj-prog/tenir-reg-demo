'use strict';
const model = JSON.parse(document.getElementById('configurator-model').textContent);
const fields = Object.keys(model.axes);
const fieldLabels = {fr:{HOST_SCOPE:'Périmètre',DEDUP_LAYER:'Déduplication',CONCURRENCY:'Concurrence',UNCERTAINTY:'Incertitude'},
  en:{HOST_SCOPE:'Scope',DEDUP_LAYER:'Deduplication',CONCURRENCY:'Concurrency',UNCERTAINTY:'Uncertainty'}};
const questions = {fr:["Où votre système s'exécute-t-il ?","Comment éviter les envois en double ?","Comment coordonner les demandes ?","Que faire face à l'incertitude ?"],
  en:['Where does your system run?','How do you prevent duplicate dispatches?','How do you coordinate requests?','How do you handle uncertainty?']};
const ruleEnglish = JSON.parse(document.getElementById('configurator-rule-translations').textContent);
let language = 'fr';
try{if(typeof localStorage !== 'undefined' && localStorage.getItem('tenir-reg-language') === 'en')language='en';}catch{}
const ui = (fr,en) => language === 'en' ? en : fr;
const fieldName = field => fieldLabels[language][field];
const byId = new Map(model.configurations.map(entry => [entry.id,entry]));
const configKey = configuration => fields.map(field => configuration[field]).join('|');
const entries = new Map(model.configurations.map(entry => [configKey(entry.configuration),entry]));
const el = id => document.getElementById(id);
const copy = value => JSON.parse(JSON.stringify(value));
function valueLabel(field,value) {
  const option=el('field-'+field).querySelector('option[value="'+value+'"]');
  return option ? option.textContent.split(' · ')[0] : value;
}
function renderStepFeedback(entry=entries.get(configKey(current))) {
  const affected=entry.violations.filter(item=>item.fields.includes(fields[step]));
  el('step-feedback').setAttribute('data-valid',String(!affected.length));
  el('step-feedback').textContent=affected.length ? ui('À revoir : ','Review needed: ')+affected.map(item=>item.clause_id).join(', ')+ui('. Les explications sont sous ce choix ; vous pouvez continuer pour lire le bilan.','. Explanations are below this choice; you can continue to review the summary.') : ui('Ce choix ne déclenche aucune incompatibilité structurelle.','This choice triggers no structural incompatibility.');
}
function applyConfiguration(configuration) {
  if(configKey(configuration)===configKey(current))return;
  undoConfiguration=copy(current);
  if(!capturedInitial){initial=copy(current);capturedInitial=true;}
  current=copy(configuration);render();
}
let current = copy(model.runtime_configuration), initial = copy(current), capturedInitial = false, step = 0;
let activeView = 'configuration', returnContext = null, lastScenario = null;
let undoConfiguration = null;
const navigationLocation = typeof location !== 'undefined' ? location : {pathname:'',search:'',hash:''};
const navigationDirectory = (navigationLocation.pathname || '').replace(/[^/]*$/,'');
const navigationStorageKey = 'tenir-reg-config:'+navigationDirectory;
const knownScenarios = model.demo.operation_ids || [];

function configurationId(configuration) {return entries.get(configKey(configuration)).id;}
function navigationState() {
  return {cfg:configurationId(current),initial:configurationId(initial),step:step+1,captured:capturedInitial?'1':'0',
    origin:returnContext ? returnContext.type : null,scenario:lastScenario,
    undo:undoConfiguration ? configurationId(undoConfiguration) : null};
}
function stateQuery(scenario = lastScenario, origin = null) {
  const state=navigationState();
  const pairs=[['cfg',state.cfg],['step',String(state.step)],['initial',state.initial],['captured',state.captured]];
  if(scenario && knownScenarios.includes(scenario))pairs.unshift(['scenario',scenario]);
  if(origin)pairs.unshift(['return',origin]);
  if(state.undo)pairs.push(['undo',state.undo]);
  return pairs.map(([key,value])=>encodeURIComponent(key)+'='+encodeURIComponent(value)).join('&');
}
function reportHref(fragment = '') {return (model.demo.report_href || 'report.html')+'?'+stateQuery()+fragment;}
function refreshNavigationLinks() {
  const entry=entries.get(configKey(current));
  const available=entry.runtime_supported && model.demo.available;
  for(const [id,fragment] of [['journey-demo','#parcours'],['journey-evidence','#preuves'],['demo-link','']]) {
    const link=el(id);
    link.setAttribute('aria-disabled',String(!available));
    if(available){link.setAttribute('href',reportHref(fragment));link.removeAttribute('tabindex');}
    else{link.removeAttribute('href');link.setAttribute('tabindex','-1');}
    link.setAttribute('title',available ? ui('Consulter les scénarios déjà exécutés du profil local','View previously executed local-profile scenarios') : ui('La démonstration est disponible uniquement pour le profil local vérifié','The demo is available only for the verified local profile'));
  }
  if(model.demo.available){el('header-demo-link').setAttribute('href',reportHref());el('header-demo-link').removeAttribute('aria-disabled');el('header-demo-link').removeAttribute('tabindex');}
  else{el('header-demo-link').removeAttribute('href');el('header-demo-link').setAttribute('aria-disabled','true');el('header-demo-link').setAttribute('tabindex','-1');}
  el('header-demo-label').textContent=entry.runtime_supported ? ui('Scénarios & preuves','Scenarios & evidence') : ui('Scénarios du profil local','Local-profile scenarios');
  el('header-demo-link').setAttribute('title',ui('Consulter les traces déjà exécutées du profil local ; votre sélection est conservée','View previously executed local-profile traces; your selection is preserved'));
  el('rules-demo-link').hidden=!available;
  if(available)el('rules-demo-link').setAttribute('href',reportHref('#parcours'));
  else el('rules-demo-link').removeAttribute('href');
  renderContextReturn();
}
function saveNavigation() {
  const state=navigationState();
  try{if(typeof sessionStorage !== 'undefined')sessionStorage.setItem(navigationStorageKey,JSON.stringify(state));}catch{}
  try{if(typeof history !== 'undefined' && typeof history.replaceState === 'function' && navigationLocation.pathname)
    history.replaceState(null,'','configurator.html?'+stateQuery(lastScenario,returnContext && returnContext.type)+(activeView==='rules'?'#rules-scope':'#workspace'));}catch{}
}
function restoreNavigation() {
  let saved=null;
  try{if(typeof sessionStorage !== 'undefined')saved=JSON.parse(sessionStorage.getItem(navigationStorageKey)||'null');}catch{}
  function accept(state, fromQuery = false) {
    if(!state || typeof state!=='object')return;
    if(typeof state.cfg==='string' && byId.has(state.cfg))current=copy(byId.get(state.cfg).configuration);
    if(typeof state.initial==='string' && byId.has(state.initial))initial=copy(byId.get(state.initial).configuration);
    const candidate=String(state.step);
    if(/^[1-4]$/.test(candidate))step=Number(candidate)-1;
    if(state.captured==='0'||state.captured==='1')capturedInitial=state.captured==='1';
    if(typeof state.undo==='string' && byId.has(state.undo))undoConfiguration=copy(byId.get(state.undo).configuration);
    if(knownScenarios.includes(state.scenario))lastScenario=state.scenario;
    const origin=fromQuery ? state.return : state.origin;
    if(origin==='rules')returnContext={type:'rules'};
    else if(origin==='demo' && knownScenarios.includes(state.scenario))returnContext={type:'demo',scenario:state.scenario};
  }
  accept(saved);
  try{
    if(typeof URLSearchParams!=='undefined'){
      const params=new URLSearchParams(navigationLocation.search||'');
      const query=Object.fromEntries(['cfg','initial','step','captured','return','scenario','undo'].filter(key=>params.has(key)).map(key=>[key,params.get(key)]));
      // Un lien explicite ne reprend pas une origine de retour restée dans le cache.
      if(params.has('return'))returnContext=null;
      if(params.has('cfg'))undoConfiguration=null;
      accept(query,true);
    }
  }catch{}
}
function renderContextReturn() {
  const visible=activeView==='configuration' && returnContext!==null;
  el('return-context-bar').hidden=!visible;
  const link=el('return-to-context');link.hidden=!visible;
  if(!visible){link.removeAttribute('href');return;}
  link.setAttribute('data-origin',returnContext.type);
  if(returnContext.type==='rules'){
    link.textContent=ui('← Revenir aux règles et au périmètre','← Return to rules and scope');
    link.setAttribute('href','#rules-scope');
    el('return-context-note').textContent=ui('Vos modifications et votre configuration avant correction sont conservées.','Your changes and pre-correction configuration are preserved.');
  }else{
    link.textContent=ui('← Reprendre la démo consultée','← Resume the previous demo');
    link.setAttribute('href',model.demo.report_href+'?'+stateQuery(returnContext.scenario)+'#parcours');
    el('return-context-note').textContent=ui('Retrouver le scénario ','Resume scenario ')+returnContext.scenario+ui('. Le rapport reste celui du profil local exécuté.','. The report still represents the executed local profile.');
  }
}

function showView(view, moveFocus = false) {
  const rulesView = view === 'rules';
  if(!rulesView && activeView==='rules' && (!returnContext || returnContext.type!=='demo'))returnContext={type:'rules'};
  activeView=rulesView?'rules':'configuration';
  el('workspace').hidden = rulesView;
  el('rules-scope').hidden = !rulesView;
  el('journey-config').setAttribute('aria-pressed',String(!rulesView));
  el('journey-rules').setAttribute('aria-pressed',String(rulesView));
  el('skip-content').setAttribute('href',rulesView?'#rules-heading':'#workspace');
  if(moveFocus) (rulesView ? el('rules-heading') : el('field-'+fields[step])).focus();
  refreshNavigationLinks();saveNavigation();
}
function editField(field) {
  showView('configuration');
  goStep(fields.indexOf(field),true);
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if(text !== undefined) element.textContent = text;
  if(className) element.className = className;
  return element;
}
function goStep(index, moveFocus = false) {
  step = Math.max(0,Math.min(fields.length-1,index));
  fields.forEach((field,i) => {
    el('panel-'+field).hidden = i !== step;
    el('step-'+i).setAttribute('aria-current',i === step ? 'step' : 'false');
  });
  el('step-title').textContent = questions[language][step];
  el('step-progress').textContent = ui('Étape ','Step ')+(step+1)+ui(' sur 4',' of 4');
  el('previous-step').disabled = step === 0;
  el('next-step').disabled = false;
  el('next-step').textContent=step===fields.length-1 ? ui('Examiner ma configuration →','Review my configuration →') : ui('Continuer →','Continue →');
  renderStepFeedback();
  if(moveFocus) el('field-'+fields[step]).focus();
  refreshNavigationLinks();
  saveNavigation();
}
function render() {
  const entry = entries.get(configKey(current));
  if(!entry) throw new Error('Configuration absente du catalogue interne');
  fields.forEach(field => {
    el('field-'+field).value = current[field];
    const invalid = entry.highlighted_fields.includes(field);
    el('field-'+field).setAttribute('aria-invalid',String(invalid));
    el('panel-'+field).setAttribute('aria-invalid',String(invalid));
    const error=el('error-'+field);
    error.hidden=!invalid;
    error.textContent=invalid ? entry.violations.filter(item=>item.fields.includes(field)).map(item=>item.clause_id+' · '+ui(item.message,ruleEnglish[item.clause_id])).join(' ') : '';
    el('field-'+field).setAttribute('aria-describedby','hint-'+field+(invalid?' error-'+field:''));
  });
  renderStepFeedback(entry);
  el('journey-help').textContent=entry.runtime_supported ? ui('Votre parcours : examiner les règles, comparer quatre scénarios déjà exécutés, puis lire leur preuve.','Your path: review the rules, compare four previously executed scenarios, then read their evidence.') : ui('Vous explorez une autre architecture. Corrigez les incompatibilités ou exportez votre choix ; le profil local reste disponible pour découvrir les scénarios.','You are exploring another architecture. Correct incompatibilities or export your choice; the local profile remains available to explore scenarios.');
  el('validity-box').setAttribute('data-valid',String(entry.admissible));
  el('validity-status').textContent = entry.admissible ? ui('Admissible structurellement','Structurally admissible') : ui('Configuration à corriger','Configuration needs correction');
  el('validity-status').setAttribute('data-status',entry.admissible ? 'admissible' : 'rejected');
  el('validity-explanation').textContent = entry.admissible ? ui('Aucune violation des sept clauses internes pour cette sélection.','No violations of the seven internal clauses for this selection.') : entry.violations.length+ui(' clause(s) expliquent cette incompatibilité.',' clause(s) explain this incompatibility.');
  el('violation-list').replaceChildren();
  entry.violations.forEach(violation => {
    const item = node('li');
    item.setAttribute('data-clause-id',violation.clause_id);
    item.append(node('strong',violation.clause_id),node('p',ui(violation.message,ruleEnglish[violation.clause_id])));
    const involved = node('div',undefined,'violation-fields');
    violation.fields.forEach(field => {
      const jump = node('button',field+' = '+current[field],'field-link');
      jump.type = 'button'; jump.addEventListener('click',()=>{goStep(fields.indexOf(field));el('field-'+field).focus();});
      involved.append(jump);
    });
    item.append(involved); el('violation-list').append(item);
  });
  el('corrections-section').hidden = entry.admissible;
  el('suggestions-count').textContent = entry.suggestions.length+' option(s)';
  el('suggestions').replaceChildren();
  entry.suggestions.forEach(suggestion => {
    const article = node('article',undefined,'suggestion');
    article.append(node('p',suggestion.changes.map(change => fieldName(change.field)+' : '+change.from+' → '+change.to).join('\n')));
    article.append(node('small',suggestion.distance+ui(' champ(s) modifié(s) · résultat admissible',' field(s) changed · admissible result')));
    const apply = node('button',ui('Appliquer cette correction →','Apply this correction →')); apply.type='button';
    apply.setAttribute('data-target-id',suggestion.target_id);
    apply.addEventListener('click',()=>{
      applyConfiguration(byId.get(suggestion.target_id).configuration);
      el('validity-status').focus();
    });
    article.append(apply);el('suggestions').append(article);
  });
  el('selection-summary').replaceChildren();
  fields.forEach((field,index) => {
    const chip = node('button',undefined,'selection-chip');chip.type='button';
    chip.setAttribute('data-invalid',String(entry.highlighted_fields.includes(field)));
    chip.append(node('span',fieldName(field)),node('strong',valueLabel(field,current[field])),node('small',current[field]));
    chip.addEventListener('click',()=>goStep(index,true));el('selection-summary').append(chip);
  });
  el('current-config').textContent = JSON.stringify(current,null,2);
  el('initial-config').textContent = JSON.stringify(initial,null,2);
  el('change-summary').textContent = capturedInitial ? fields.filter(field=>initial[field]!==current[field]).length+ui(' champ(s) diffère(nt) du choix avant correction.',' field(s) differ from the pre-correction choice.') : ui('Aucune suggestion appliquée pour le moment.','No suggestion has been applied yet.');
  el('runtime-status').textContent = entry.runtime_supported ? ui('Profil pris en charge','Supported profile') : ui('Non pris en charge par ce prototype','Not supported by this prototype');
  el('runtime-status').setAttribute('data-status',entry.runtime_supported ? 'supported' : 'unsupported');
  el('guarantees-status').textContent = entry.guarantees_status === 'LOCAL_DEMO_TESTED' ? ui('Recette locale testée · voir les preuves','Local tests passed · see evidence') : ui('Non démontrées pour cette configuration','Not demonstrated for this configuration');
  el('guarantees-status').setAttribute('data-status',entry.guarantees_status);
  el('invariants-status').textContent = ui('Guides reçus · applicabilité non intégrée','Guides received · applicability not integrated');
  const demoAvailable = entry.runtime_supported && model.demo.available;
  el('local-profile-recovery').hidden=entry.runtime_supported;
  el('demo-profile-preview').textContent=ui('Changements proposés : ','Proposed changes: ')+fields.filter(field=>current[field]!==model.runtime_configuration[field]).map(field=>fieldName(field)+' : '+valueLabel(field,current[field])+' → '+valueLabel(field,model.runtime_configuration[field])).join(' ; ')+ui('. Vous pourrez annuler ce changement.','. You can undo this change.');
  el('change-feedback').hidden=undoConfiguration===null;
  if(undoConfiguration)el('change-message').textContent=ui('Sélection mise à jour. ','Selection updated. ')+fields.filter(field=>undoConfiguration[field]!==current[field]).map(field=>fieldName(field)+' : '+valueLabel(field,undoConfiguration[field])+' → '+valueLabel(field,current[field])).join(' ; ');
  refreshNavigationLinks();
  el('demo-explanation').textContent = demoAvailable ? ui('Cette sélection correspond au profil des quatre scénarios signés, vérifiés lors de la génération.','This selection matches the profile of the four signed scenarios verified during generation.') : entry.runtime_supported ? ui('Le profil est compatible. Générez les preuves avec .\\run.ps1 all pour ouvrir sa démonstration.','The profile is compatible. Generate evidence with .\\run.ps1 all to open its demo.') : ui('La démonstration disponible utilise mono-process, local-registry, thread-lock et fail-closed. Votre sélection n’a pas été exécutée.','The available demo uses mono-process, local-registry, thread-lock and fail-closed. Your selection has not been executed.');
  el('export-status').textContent='';
  renderRules(entry);
  renderContextReturn();saveNavigation();
}
function renderRules(entry) {
  const ready=entry.runtime_supported && model.demo.available;
  el('rules-next-title').textContent=ready ? ui('Votre profil est prêt pour la lecture des scénarios','Your profile is ready to explore scenarios') : !entry.admissible ? ui('Cette sélection demande une correction','This selection needs a correction') : entry.runtime_supported ? ui('Le dossier de preuve doit être régénéré','The evidence dossier must be regenerated') : ui('Architecture admissible, hors du moteur local','Admissible architecture, outside the local engine');
  el('rules-next-copy').textContent=ready ? ui('Poursuivez avec une autorisation, un blocage, une attente et une issue inconnue. Les sept résultats détaillés restent ci-dessous.','Continue with an authorization, a block, a hold and an unknown outcome. All seven detailed results remain below.') : !entry.admissible ? ui('Les clauses concernées et les corrections sont expliquées dans la configuration. Votre choix reste exportable.','Affected clauses and corrections are explained in configuration. Your choice can still be exported.') : entry.runtime_supported ? ui('Les preuves locales sont indisponibles. Régénérez le dossier avant de consulter les scénarios.','Local evidence is unavailable. Regenerate the dossier before exploring scenarios.') : ui('Les sept clauses acceptent ce choix, mais ce prototype ne l’exécute pas. Conservez-le pour votre export ou adoptez explicitement le profil de la démo.','The seven clauses accept this choice, but this prototype does not execute it. Keep it for export or explicitly use the demo profile.');
  el('rules-fix').hidden=entry.admissible;
  el('rules-use-local').hidden=entry.runtime_supported;
  const counts = {SATISFIED:0,VIOLATED:0,NOT_APPLICABLE:0};
  const labels = {SATISFIED:ui('Satisfaite','Satisfied'),VIOLATED:ui('Violée','Violated'),NOT_APPLICABLE:ui('Non applicable','Not applicable')};
  el('rule-results').replaceChildren();
  entry.rule_results.forEach(result => {
    counts[result.status]++;
    const card = node('article',undefined,'rule-card');
    card.setAttribute('data-clause-id',result.clause_id);
    card.setAttribute('data-rule-status',result.status);
    const heading = node('div',undefined,'rule-card-heading');
    const status = node('span',labels[result.status],'rule-status');
    status.setAttribute('data-rule-status',result.status);
    heading.append(node('strong',result.clause_id),status);
    card.append(heading,node('p',ui(result.message,ruleEnglish[result.clause_id])));
    card.append(node('p',ui('Condition : ','Condition: ')+result.condition.field+' = '+result.condition.value+ui(' · sélection : ',' · selected: ')+result.condition.actual,'rule-expression'));
    card.append(node('p',ui('Valeur attendue : ','Required value: ')+result.requirement.field+' ∈ ['+result.requirement.allowed.join(', ')+']'+ui(' · sélection : ',' · selected: ')+result.requirement.actual,'rule-expression'));
    const edits = node('div',undefined,'rule-edit-fields');
    [...new Set(result.fields)].forEach(field => {
      const edit = node('button',ui('Modifier ','Edit ')+fieldName(field),'secondary');edit.type='button';
      edit.setAttribute('data-edit-field',field);edit.addEventListener('click',()=>editField(field));edits.append(edit);
    });
    card.append(edits);el('rule-results').append(card);
  });
  el('rules-summary').textContent = counts.SATISFIED+ui(' satisfaite(s) · ',' satisfied · ')+counts.VIOLATED+ui(' violée(s) · ',' violated · ')+counts.NOT_APPLICABLE+ui(' non applicable(s)',' not applicable');
  el('scope-config-summary').replaceChildren();
  fields.forEach(field => {
    const edit = node('button',undefined,'selection-chip');edit.type='button';
    edit.setAttribute('data-edit-field',field);
    edit.setAttribute('data-invalid',String(entry.highlighted_fields.includes(field)));
    edit.append(node('span',fieldName(field)),node('strong',valueLabel(field,current[field])),node('small',current[field]));
    edit.addEventListener('click',()=>editField(field));el('scope-config-summary').append(edit);
  });
  const scopes = {
    'mono-process':ui("Un seul processus coordonne les demandes. Les règles imposent thread-lock ; le registre local de la démo reste en mémoire dans ce processus.","One process coordinates requests. The rules require thread-lock; the demo's local registry remains in that process's memory."),
    'mono-host':ui("Plusieurs processus partagent un hôte. Les règles demandent file-lock ou distributed-transaction. Leur exécution n'est pas implémentée par ce prototype.","Multiple processes share one host. The rules require file-lock or distributed-transaction. Their execution is not implemented by this prototype."),
    'multi-host':ui("Plusieurs hôtes nécessitent une coordination distribuée selon les clauses. Un registre local ne suffit pas pour ce périmètre ; le runtime local ne l'exécute pas.","Multiple hosts require distributed coordination under these clauses. A local registry is insufficient for this scope; the local runtime does not execute it.")
  };
  el('scope-description').textContent=scopes[current.HOST_SCOPE];
  el('scope-validity').textContent=entry.admissible ? ui('Admissible structurellement','Structurally admissible') : ui('Configuration à corriger','Configuration needs correction');
  el('scope-runtime').textContent=entry.runtime_supported ? ui('Profil local pris en charge','Local profile supported') : ui('Exécution non implémentée','Execution not implemented');
}
fields.forEach((field,index) => {
  el('field-'+field).addEventListener('change',event=>{current[field]=event.target.value;undoConfiguration=null;render();});
  el('step-'+index).addEventListener('click',()=>goStep(index,true));
});
el('previous-step').addEventListener('click',()=>goStep(step-1,true));
el('next-step').addEventListener('click',()=>step===fields.length-1 ? showView('rules',true) : goStep(step+1,true));
el('journey-config').addEventListener('click',()=>showView('configuration',true));
el('header-config-link').addEventListener('click',event=>{event.preventDefault();showView('configuration',true);});
el('journey-rules').addEventListener('click',()=>showView('rules',true));
el('review-rules').addEventListener('click',()=>showView('rules',true));
el('back-to-config').addEventListener('click',()=>showView('configuration',true));
el('return-to-context').addEventListener('click',event=>{
  if(returnContext && returnContext.type==='rules'){event.preventDefault();showView('rules',true);}
});
el('reset-config').addEventListener('click',()=>{current=copy(model.runtime_configuration);initial=copy(current);capturedInitial=false;undoConfiguration=null;goStep(0,true);render();});
el('use-local-profile').addEventListener('click',()=>{applyConfiguration(model.runtime_configuration);el('validity-status').focus();});
el('rules-use-local').addEventListener('click',()=>{applyConfiguration(model.runtime_configuration);showView('configuration',true);});
el('rules-fix').addEventListener('click',()=>editField(entries.get(configKey(current)).highlighted_fields[0]));
el('undo-change').addEventListener('click',()=>{if(undoConfiguration){current=copy(undoConfiguration);undoConfiguration=null;render();el('validity-status').focus();}});
el('export-config').addEventListener('click',()=>{
  const entry=entries.get(configKey(current));
  const draft={schema:model.draft_schema,configuration:copy(current),initial_configuration:copy(initial),provenance:copy(model.provenance),
    structural_validation:{admissible:entry.admissible,violations:copy(entry.violations),runtime_supported:entry.runtime_supported},
    signature_status:'UNSIGNED',unsigned:true,execution:{state:'NOT_EXECUTED',demonstrated_guarantees:'NOT_ASSESSED_FOR_THIS_DRAFT'}};
  const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)+'\n'],{type:'application/json'}));
  const download=node('a');download.setAttribute('href',url);download.setAttribute('download','tenir-reg-configuration.json');
  document.body.append(download);download.click();download.remove();URL.revokeObjectURL(url);
  el('export-status').textContent=ui('Brouillon JSON exporté. Aucune exécution et aucune signature ajoutée.','JSON draft exported. No execution and no signature added.');
});
function applyLanguage() {
  document.documentElement.setAttribute('lang',language);
  for(const element of document.querySelectorAll('[data-fr][data-en]'))element.textContent=element.getAttribute('data-'+language);
  for(const attribute of ['aria-label','title'])for(const element of document.querySelectorAll('[data-fr-'+attribute+'][data-en-'+attribute+']'))element.setAttribute(attribute,element.getAttribute('data-'+language+'-'+attribute));
  el('language-controls').setAttribute('aria-label',ui('Langue','Language'));
  for(const locale of ['fr','en'])el('language-'+locale).setAttribute('aria-pressed',String(locale===language));
}
for(const locale of ['fr','en'])el('language-'+locale).addEventListener('click',()=>{
  language=locale;
  try{if(typeof localStorage!=='undefined')localStorage.setItem('tenir-reg-language',language);}catch{}
  applyLanguage();goStep(step);render();
});
el('rules-version').textContent=model.provenance.rules_version;
el('provenance-detail').textContent=JSON.stringify(model.provenance,null,2);
function renderRuleReferences() {
  el('rules-list').replaceChildren();
  model.rules.forEach(rule=>{const item=node('li');item.append(node('strong',rule.clause_id+' · '),node('span',ui(rule.desc,ruleEnglish[rule.clause_id])));el('rules-list').append(item);});
}
for(const locale of ['fr','en'])el('language-'+locale).addEventListener('click',renderRuleReferences);
restoreNavigation();
applyLanguage();renderRuleReferences();
showView(typeof location !== 'undefined' && location.hash === '#rules-scope' ? 'rules' : 'configuration');
goStep(step);render();
