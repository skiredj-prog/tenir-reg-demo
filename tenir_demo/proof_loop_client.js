/* Read-only presentation of the report projection and its signed field sources. */
'use strict';
let proofLoopViewState = {operationId:null,stepId:null,sourceSequence:null,sourcePointer:null};
let proofLoopInstance = 0;
let proofLoopInitialNavigationApplied = false;

function renderProofLoop(container, selectedRecord, loopModel, language, evidenceRecords, navigation={}) {
  const english = language === 'en';
  const say = (fr,en) => english ? en : fr;
  const translated = value => typeof value === 'string' ? value : value && (value[english?'en':'fr'] || value.fr || value.en) || '';
  const create = (tag,text,className) => {
    const element = document.createElement(tag);
    if(text !== undefined) element.textContent = text;
    if(className) element.className = className;
    return element;
  };
  const focus = element => {if(element && typeof element.focus === 'function') element.focus();};
  const operationId = loopModel.operation_id;
  const stages = loopModel.stages;
  const records = new Map((evidenceRecords || [selectedRecord]).map(record => [record.payload.sequence,record]));
  const instanceId = 'proof-loop-'+(++proofLoopInstance);
  const statusNames = {
    DOCUMENTARY:say('Contexte documentaire','Documentary context'),
    RECORDED:say('Données enregistrées','Recorded data'),
    MISSING:say('Observation manquante','Missing observation'),
    INVALID:say('Observation invalide','Invalid observation'),
    EXPIRED:say('Observation expirée','Expired observation'),
    BLOCKED:say('Bloqué avant envoi','Blocked before dispatch'),
    HELD:say('En attente avant envoi','Held before dispatch'),
    UNCONFIRMED:say('Issue non confirmée','Unconfirmed outcome'),
    CONFIRMED:say('Confirmé','Confirmed')
  };
  if(proofLoopViewState.operationId !== operationId) {
    proofLoopViewState = {operationId,stepId:stages[0] && stages[0].id,sourceSequence:null,sourcePointer:null};
  }
  if(!stages.some(stage => stage.id === proofLoopViewState.stepId)) proofLoopViewState.stepId = stages[0] && stages[0].id;
  if(!proofLoopInitialNavigationApplied) {
    proofLoopInitialNavigationApplied = true;
    const initial = navigation && navigation.initialState;
    const stage = initial && initial.operationId === operationId && stages.find(item => item.id === initial.stepId);
    if(stage) {
      proofLoopViewState.stepId = stage.id;
      const source = (stage.sources || []).find(item => item.record_sequence === initial.sourceSequence && item.pointer === initial.sourcePointer);
      if(source && resolveSource(source).found) {
        proofLoopViewState.sourceSequence = source.record_sequence;
        proofLoopViewState.sourcePointer = source.pointer;
      }
    }
  }
  const notifyNavigation = () => {
    if(navigation && typeof navigation.onChange === 'function') navigation.onChange({
      operationId:proofLoopViewState.operationId,stepId:proofLoopViewState.stepId,
      sourceSequence:proofLoopViewState.sourceSequence,sourcePointer:proofLoopViewState.sourcePointer
    });
  };
  container.replaceChildren();
  container.className = 'proof-loop';
  const heading = create('h3',say('Suivre la boucle de preuve','Follow the evidence loop'),'proof-loop-heading');
  heading.setAttribute('id',instanceId+'-heading');
  container.setAttribute('aria-labelledby',instanceId+'-heading');
  const introduction = create('p',say('Choisissez une étape pour lire son explication et ouvrir les champs qui lui servent de sources. Les explications du rapport restent distinctes des données enregistrées.','Choose a step to read its explanation and open the fields used as sources. Report explanations remain separate from recorded data.'),'proof-loop-intro');
  const workspace = create('div',undefined,'proof-loop-workspace');
  const stepNavigation = create('nav',undefined,'proof-loop-navigation');
  stepNavigation.setAttribute('aria-label',say('Étapes de la boucle de preuve','Evidence loop steps'));
  const list = create('ol',undefined,'proof-loop-steps');
  const detail = create('section',undefined,'proof-loop-detail');
  detail.setAttribute('id',instanceId+'-detail');
  detail.setAttribute('role','region');
  detail.setAttribute('aria-labelledby',instanceId+'-step-heading');
  const announcement = create('p','','proof-loop-announcement');
  announcement.setAttribute('role','status');
  announcement.setAttribute('aria-live','polite');
  announcement.setAttribute('aria-atomic','true');
  const stepButtons = [];
  stages.forEach((stage,index) => {
    const item = create('li'),button = create('button');
    button.type = 'button';
    button.setAttribute('data-loop-step',stage.id);
    button.setAttribute('aria-controls',instanceId+'-detail');
    button.setAttribute('aria-pressed','false');
    const number = create('span',String(index+1).padStart(2,'0'),'proof-step-number');
    number.setAttribute('aria-hidden','true');
    const title = create('span',translated(stage.title),'proof-step-name');
    const status = create('span',statusNames[stage.status] || stage.status,'proof-step-status');
    status.setAttribute('data-loop-status',stage.status);
    button.append(number,title,status);
    button.addEventListener('click',()=>selectStage(stage.id,true));
    item.append(button);list.append(item);stepButtons.push(button);
  });
  stepNavigation.append(list);workspace.append(stepNavigation,detail);container.append(heading,introduction,announcement,workspace);

  function resolveSource(source) {
    if(!Number.isInteger(source.record_sequence) || source.record_sequence <= 0) return {found:false,record:null};
    const record = records.get(source.record_sequence);
    if(!record || record.payload.operation_id !== operationId) return {found:false,record:null};
    const pointer = source.pointer;
    const prefix = source.kind === 'SIGNED_PAYLOAD' ? '/payload' : source.kind === 'ENVELOPE_METADATA' ? '/integrity' : null;
    if(!prefix || typeof pointer !== 'string' || !(pointer === prefix || pointer.startsWith(prefix+'/')) || /~(?:[^01]|$)/.test(pointer)) return {found:false,record};
    let value = record;
    for(const encoded of pointer.slice(1).split('/')) {
      const key = encoded.replace(/~1/g,'/').replace(/~0/g,'~');
      if(value === null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value,key)) return {found:false,record};
      if(Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(key)) return {found:false,record};
      value = value[key];
    }
    return {found:true,record,value};
  }

  function selectStage(stageId,moveFocus=false) {
    proofLoopViewState.stepId = stageId;
    proofLoopViewState.sourceSequence = null;
    proofLoopViewState.sourcePointer = null;
    renderStage(moveFocus);
    notifyNavigation();
  }

  function renderStage(moveFocus=false) {
    const index = stages.findIndex(stage => stage.id === proofLoopViewState.stepId);
    const stage = stages[index];
    if(!stage) return;
    stepButtons.forEach((button,position)=>button.setAttribute('aria-pressed',String(position === index)));
    detail.replaceChildren();
    const progress = create('p',say('Étape ','Step ')+(index+1)+say(' sur ',' of ')+stages.length,'proof-step-progress');
    const title = create('h4',translated(stage.title),'proof-detail-title');
    title.setAttribute('id',instanceId+'-step-heading');title.setAttribute('tabindex','-1');
    const status = create('p',statusNames[stage.status] || stage.status,'proof-detail-status');
    status.setAttribute('data-loop-status',stage.status);
    const descriptionLabel = create('p',say('Explication du rapport · hors EvidenceRecord','Report explanation · outside the EvidenceRecord'),'proof-documentary-label');
    const description = create('p',translated(stage.description),'proof-step-description');
    detail.append(progress,title,status,descriptionLabel,description);
    if(stage.status === 'DOCUMENTARY') detail.append(create('p',stage.id === 'question' ? say('Cette étape est un contexte de lecture. Les champs ci-dessous peuvent l’éclairer ; ils ne constituent pas une question formelle signée.','This step provides reading context. The fields below may inform it; they do not constitute a formal signed question.') : say('Cette restitution est une annotation du rapport. Les champs ci-dessous documentent l’opération ; ils ne signent pas les recommandations du rapport.','This restitution is a report annotation. The fields below document the operation; they do not sign the report’s recommendations.'),'proof-documentary-note'));
    const sourcesHeading = create('h5',say('Ouvrir une source','Open a source'),'proof-sources-heading');
    const sources = create('div',undefined,'proof-loop-sources');
    const inspector = create('section',undefined,'proof-source-inspector');
    inspector.setAttribute('id',instanceId+'-source');
    inspector.setAttribute('role','region');
    inspector.setAttribute('aria-labelledby',instanceId+'-source-heading');
    inspector.hidden = true;
    const sourceButtons = [];
    function openSource(source,moveSourceFocus=false,notify=true) {
      proofLoopViewState.sourceSequence = source.record_sequence;
      proofLoopViewState.sourcePointer = source.pointer;
      sourceButtons.forEach(([button,item])=>button.setAttribute('aria-expanded',String(item.record_sequence === source.record_sequence && item.pointer === source.pointer)));
      const resolved = resolveSource(source);
      inspector.hidden = false;inspector.replaceChildren();
      const sourceTitle = create('h5',say('Source : ','Source: ')+translated(source.label));
      sourceTitle.setAttribute('id',instanceId+'-source-heading');sourceTitle.setAttribute('tabindex','-1');
      const kind = create('p',!resolved.found ? say('Source indisponible','Source unavailable') : source.kind === 'SIGNED_PAYLOAD' ? say('Champ du payload signé','Field in the signed payload') : say('Métadonnée de signature','Signature metadata'),'proof-source-kind');
      kind.setAttribute('data-source-kind',resolved.found ? source.kind : 'UNAVAILABLE');
      const context = create('p',undefined,'proof-source-context');
      context.textContent = (resolved.record ? resolved.record.payload.operation_id : operationId)+' · '+say('Preuve #','Evidence #')+source.record_sequence;
      const pointer = create('code',source.pointer === '' ? say('(racine du record)','(record root)') : source.pointer,'proof-source-path');
      pointer.setAttribute('data-source-path',source.pointer);
      const value = create('pre',resolved.found ? JSON.stringify(resolved.value,null,2) : say('Le record, le chemin ou le type de source ne correspond pas aux données de cette opération. Aucune valeur n’est présentée.','The record, path or source type does not match this operation’s data. No value is displayed.'),'proof-source-value');
      value.setAttribute('data-source-value','');
      const close = create('button',say('Fermer la source','Close source'),'proof-source-close');close.type='button';
      close.addEventListener('click',()=>{
        inspector.hidden = true;proofLoopViewState.sourceSequence = null;proofLoopViewState.sourcePointer = null;
        sourceButtons.forEach(([button])=>button.setAttribute('aria-expanded','false'));
        const trigger = sourceButtons.find(([,item])=>item.record_sequence === source.record_sequence && item.pointer === source.pointer);
        if(trigger) focus(trigger[0]);
        notifyNavigation();
      });
      inspector.append(sourceTitle,kind,context,pointer,value);
      if(resolved.record && resolved.record.integrity) inspector.append(create('p',say('Empreinte du payload : ','Payload fingerprint: ')+resolved.record.integrity.payload_sha256,'proof-source-fingerprint'));
      inspector.append(create('p',resolved.found ? say('Valeur copiée sans transformation depuis le record. La vérification du dossier est disponible dans « Vérifier les preuves ».','Value copied unchanged from the record. Dossier verification is available under “Verify the evidence”.') : say('Cette source ne permet pas de présenter un champ signé pour cette étape. Consultez le dossier et sa vérification.','This source cannot present a signed field for this step. Inspect the dossier and its verification.'),'proof-source-note'));
      const verification = create('a',say('Vérifier les preuves','Verify the evidence'),'proof-verification-link');verification.setAttribute('href','#preuves');
      inspector.append(verification,close);
      if(moveSourceFocus) focus(sourceTitle);
      if(notify) notifyNavigation();
    }
    (stage.sources || []).forEach(source => {
      const available = resolveSource(source).found;
      const button = create('button',undefined,'proof-source-button');button.type='button';
      button.setAttribute('data-source-pointer',source.pointer);
      button.setAttribute('data-source-sequence',String(source.record_sequence));
      button.setAttribute('data-source-kind',available ? source.kind : 'UNAVAILABLE');
      button.setAttribute('data-source-status',available ? 'AVAILABLE' : 'UNAVAILABLE');
      button.setAttribute('aria-controls',instanceId+'-source');button.setAttribute('aria-expanded','false');
      button.append(create('span',translated(source.label),'proof-source-label'));
      button.append(create('span',(!available ? say('Source indisponible','Source unavailable') : source.kind === 'SIGNED_PAYLOAD' ? say('Champ du payload signé','Field in the signed payload') : say('Métadonnée de signature','Signature metadata'))+' · #'+source.record_sequence,'proof-source-caption'));
      button.append(create('code',source.pointer === '' ? say('(racine du record)','(record root)') : source.pointer));
      button.addEventListener('click',()=>openSource(source,true));
      sourceButtons.push([button,source]);sources.append(button);
    });
    detail.append(sourcesHeading,sources);
    if(!sourceButtons.length) detail.append(create('p',say('Aucun champ signé n’est rattaché à cette annotation documentaire.','No signed field is attached to this documentary annotation.'),'proof-documentary-note'));
    detail.append(inspector);
    const actions = create('div',undefined,'proof-step-actions');
    if(index > 0) {
      const previous = create('button',say('← Étape précédente','← Previous step'));previous.type='button';previous.setAttribute('data-loop-action','previous');
      previous.addEventListener('click',()=>selectStage(stages[index-1].id,true));actions.append(previous);
    }
    if(index < stages.length-1) {
      const next = create('button',say('Étape suivante →','Next step →'));next.type='button';next.setAttribute('data-loop-action','next');
      next.addEventListener('click',()=>selectStage(stages[index+1].id,true));actions.append(next);
    } else {
      const end = create('a',say('Vérifier les preuves →','Verify the evidence →'));end.setAttribute('href','#preuves');actions.append(end);
    }
    detail.append(actions);
    const savedSource = (stage.sources || []).find(source=>source.record_sequence === proofLoopViewState.sourceSequence && source.pointer === proofLoopViewState.sourcePointer);
    if(savedSource) openSource(savedSource,false,false);
    else {proofLoopViewState.sourceSequence = null;proofLoopViewState.sourcePointer = null;}
    announcement.textContent = say('Étape ','Step ')+(index+1)+' / '+stages.length+' : '+translated(stage.title)+' · '+(statusNames[stage.status] || stage.status);
    if(moveFocus) focus(title);
  }

  renderStage();
  notifyNavigation();
  if(loopModel.timeline && loopModel.timeline.length) {
    const timeline = create('details',undefined,'proof-loop-timeline');
    const summary = create('summary',say('Voir les événements de cette opération','View this operation’s events'));
    const events = create('ol');
    loopModel.timeline.forEach(event=>{
      const item = create('li');
      item.append(create('span',say('Preuve #','Evidence #')+event.record_sequence));
      item.append(create('code',[event.event,event.verdict,event.operation_state].join(' · ')));events.append(item);
    });
    timeline.append(summary,events);container.append(timeline);
  }
}
