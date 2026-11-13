'use strict';
/* DEMO: link fittizi e salvataggio locale nel browser. Nessun backend. */
const SURVEY=window.BT_SURVEY;
const QUESTIONS=SURVEY.questions;
const QUESTION_MAP=Object.fromEntries(QUESTIONS.map(q=>[q.id,q]));
const app=document.getElementById('app');
const query=new URLSearchParams(location.search);
const demoSocios=window.BT_DEMO_SOCIOS||[];
const invitation=query.get('token')||'';
const socio=demoSocios.find(s=>s.token===invitation)||null;
const storeKey=socio?`BT_TEST_DEV_20261113_${invitation}`:null;
const dispatchKey='BT_DEV_INVII_FITTIZI_V1';
let panelMessage='';
let screen='intro';
let currentKey=QUESTIONS[0].id;
let answers={};
let alertMessage='';
const optionOrders={};
const rowOrders={};

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function shuffle(items){let arr=[...items];for(let i=arr.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
for(const q of QUESTIONS){
  const o=q.opts||[];
  const fixed=o.filter(x=>x.fixed||x.other||x.exclusive||x.label==='Non ricordo'||x.label==='Non so'||(q.id==='D1'&&x.label==='Al momento non sento il bisogno di partecipare'));
  optionOrders[q.id]=q.random?[...shuffle(o.filter(x=>!fixed.includes(x))),...fixed]:o;
  if(q.type==='matrix'){
    if(q.id==='B1-B5'){
      rowOrders[q.id]=shuffle(q.rows.filter(r=>r.id!=='B2'));
    }else{
      rowOrders[q.id]=q.random?shuffle(q.rows):q.rows;
    }
  }
}
// Demo state is isolated by token and by browser origin.
function readDemoState(token){
 const person=demoSocios.find(s=>s.token===token);if(!person)return null;
 try{const p=JSON.parse(localStorage.getItem(`BT_TEST_DEV_20261113_${token}`)||'null');
  return p&&p.version===2&&p.answers&&typeof p.answers==='object'?p:null;
 }catch{return null;}
}
function storeDemoState(){
 if(!socio)return;
 // If another tab has already completed the survey, do not overwrite that status.
 if(screen!=='done'&&readDemoState(invitation)?.screen==='done')return;
 try{localStorage.setItem(storeKey,JSON.stringify({version:2,answers,screen,currentKey,optionOrders,rowOrders,updatedAt:new Date().toISOString()}));}
 catch(e){console.warn('Demo storage unavailable',e);}
}
function restoreDemoState(){
 const st=readDemoState(invitation);if(!st)return;
 answers=st.answers||{};
 for(const q of QUESTIONS){
  const prev=st.optionOrders?.[q.id];
  if(Array.isArray(prev)&&prev.length===q.opts.length&&prev.every(o=>q.opts.some(opt=>opt.code===o.code))){
   optionOrders[q.id]=prev.map(o=>q.opts.find(opt=>opt.code===o.code));
  }
  if(q.type==='matrix'){
   const prior=st.rowOrders?.[q.id];
   const expected=q.id==='B1-B5'?q.rows.filter(r=>r.id!=='B2'):q.rows;
   if(Array.isArray(prior)&&prior.length===expected.length&&prior.every(r=>expected.some(e=>e.id===r.id))){
    rowOrders[q.id]=prior.map(r=>expected.find(e=>e.id===r.id));
   }
  }
 }
 screen=['intro','question','done'].includes(st.screen)?st.screen:'intro';
 currentKey=st.currentKey||QUESTIONS[0].id;
}
function demoStatus(token){const st=readDemoState(token);if(!st)return 'Non iniziato';return st.screen==='done'?'Completato':'In corso';}
function demoPrefix(){return `<p class="demo-info" role="note">PROVA CON SOCI FITTIZI · Salvataggio solo in questo browser · <a href="${escapeHtml(location.pathname)}">Elenco prove</a></p>`;}
function invitationUrl(token){
 // Keep the correct GitHub Pages project path; the same URL is reused in both channels.
 return `${location.origin}${location.pathname}?token=${encodeURIComponent(token)}`;
}
function loadDispatch(){
 try{const s=JSON.parse(localStorage.getItem(dispatchKey)||'{}');return s&&typeof s==='object'&&!Array.isArray(s)?s:{};}catch{return {};}
}
function saveDispatch(data){
 try{localStorage.setItem(dispatchKey,JSON.stringify(data));}catch(err){console.warn('Impossibile salvare la simulazione invii',err);}
}
function simulateDispatch(phase){
 const previous=loadDispatch();let prepared=0,already=0,notEligible=0;
 for(const p of demoSocios){
  const item=previous[p.id]||{};
  if(demoStatus(p.token)==='Completato'){notEligible++;continue;}
  if(phase==='reminder'&&!item.initial){notEligible++;continue;}
  if(item[phase]){already++;continue;}
  item[phase]=new Date().toISOString();previous[p.id]=item;prepared++;
 }
 saveDispatch(previous);
 panelMessage=`${phase==='initial'?'Primo invio email':'Sollecito WhatsApp'}: ${prepared} nuovi inviti simulati; ${already} già registrati; ${notEligible} esclusi. Nessun messaggio reale è stato inviato.`;
 renderRoster();
}
function makeInvitationMessage(person,channel){
 const url=invitationUrl(person.token);
 return channel==='wa'
   ? `Ciao! Ti invito a compilare il questionario di Better Together. Questo è il tuo link personale: ${url} Puoi interrompere e riprendere la compilazione usando lo stesso link.`
   : `Oggetto: Questionario Better Together\n\nCiao,\n\npuoi compilare il questionario tramite il tuo link personale:\n${url}\n\nPuoi interrompere e riprendere la compilazione usando lo stesso link.\n\nGrazie!`;
}
async function copyDev(value){
 try{
  if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(value);
  else{
   const t=document.createElement('textarea');t.value=value;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();
   if(!document.execCommand('copy'))throw Error('Copia non disponibile');t.remove();
  }
  panelMessage='Copiato negli appunti. È soltanto una simulazione: non è stato inviato alcun messaggio.';
 }catch{
  panelMessage='Copia automatica non disponibile: seleziona il link nella riga del socio oppure usa un browser HTTPS.';
 }
 renderRoster();
}
function csvDispatch(){
 const d=loadDispatch();const names=['id_socio_fittizio','link_personale','stato_in_questo_browser','primo_invito_email_simulato_il','sollecito_whatsapp_simulato_il'];
 const rows=demoSocios.map(p=>({id_socio_fittizio:p.id,link_personale:invitationUrl(p.token),stato_in_questo_browser:demoStatus(p.token),primo_invito_email_simulato_il:d[p.id]?.initial||'',sollecito_whatsapp_simulato_il:d[p.id]?.reminder||''}));
 const contents=makeCSV(names,rows);const blob=new Blob([contents],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='test_dev_piano_invii_fittizi.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function renderRoster(){
 document.body.dataset.surveyScreen='intro';
 const dispatch=loadDispatch();
 const links=demoSocios.map(p=>{
  const sent=dispatch[p.id]||{};
  const status=demoStatus(p.token);
  return `<tr><td>${escapeHtml(p.id)}</td><td>${escapeHtml(status)}</td><td><a href="?token=${encodeURIComponent(p.token)}">Apri il questionario</a></td><td>${sent.initial?'✓':'–'}</td><td>${sent.reminder?'✓':'–'}</td><td class="demo-tools"><button type="button" class="dev-mini" data-action="copy-email" data-socio="${escapeHtml(p.id)}">Copia email</button><button type="button" class="dev-mini" data-action="copy-wa" data-socio="${escapeHtml(p.id)}">Copia WhatsApp</button></td></tr>`;
 }).join('');
 const completed=demoSocios.filter(p=>demoStatus(p.token)==='Completato').length;
 app.innerHTML=`<div class="single-flow"><div class="question-card intro-card"><div class="dev-badge">AMBIENTE DI SVILUPPO · DATI FITTIZI</div><h1>Prova dei link personalizzati</h1><p>Qui puoi simulare un primo invio via email e un sollecito WhatsApp senza modificare il questionario usato dai volontari.</p><p class="demo-notice"><strong>È soltanto una simulazione locale.</strong> Non parte nessun messaggio e le risposte non vengono raccolte su un server. Gli stati qui mostrati sono quelli di <strong>questo browser</strong>. Non inserire dati di soci reali.</p><div class="dev-summary"><strong>${demoSocios.length} soci fittizi</strong><span>${completed} completati in questo browser</span></div><div class="demo-buttons"><button class="btn primary" type="button" data-action="simulate-initial">Simula invio email</button><button class="btn" type="button" data-action="simulate-reminder">Simula sollecito WhatsApp ai non completati</button></div>${panelMessage?`<p class="dev-feedback" role="status">${escapeHtml(panelMessage)}</p>`:''}<div class="demo-table-wrapper"><table class="demo-table dev-table"><thead><tr><th>Codice fittizio</th><th>Compilazione</th><th>Link unico</th><th>Email</th><th>WA</th><th>Messaggi con lo stesso link</th></tr></thead><tbody>${links}</tbody></table></div><p class="muted small">Il primo invio viene registrato una sola volta per codice. Il sollecito considera soltanto chi ha ricevuto il primo invito e non risulta completato <strong>in questo browser</strong>. Apri lo stesso codice da email o WhatsApp: il collegamento è identico.</p><div class="demo-buttons"><button class="btn" type="button" data-action="dispatch-csv">Esporta piano invii CSV</button><button class="btn" type="button" data-action="all-csv">Esporta risposte CSV locali</button><button class="btn" type="button" data-action="reset-all">Azzera tutta la simulazione</button></div></div></div>`;
}

function renderBadToken(){
 document.body.dataset.surveyScreen='intro';
 app.innerHTML=`<div class="single-flow"><div class="question-card intro-card"><h1>Link di prova non valido</h1><p>Questo codice non appartiene all'elenco dei soci fittizi.</p><a href="${escapeHtml(location.pathname)}">Torna ai link di prova</a></div></div>`;
}
function getAnswer(q){return answers[q.id]||null;}
function active(q,state=answers){
 const value=(id)=>state[id]?.v;
 if(q.id==='P3')return ['O03','O04'].includes(value('P2')) && ['O02','O03'].includes(value('P1'));
 if(q.id==='B8')return /^F\d+$/.test(value('B7N')||'');
 if(['B9V','B12S'].includes(q.id))return /^F\d+$/.test(value('B9')||'');
 if(q.id==='D1R')return ['O03','O04'].includes(value('P2'));
 if(q.id==='G4')return ['O01','O02'].includes(value('G3'));
 return true;
}
function activeQuestions(){return QUESTIONS.filter(q=>active(q));}
function matrixRows(q){
 const rows=rowOrders[q.id]||[];
 if(q.id==='B1-B5'){
  const withB2=[];
  for(const r of rows){
   withB2.push(r);
   if(r.id==='B1'&&['2','3','4'].includes(answers[q.id]?.rows?.B1))withB2.push(q.rows.find(x=>x.id==='B2'));
  }
  return withB2;
 }
 return rows;
}
// Una schermata per ogni item delle batterie, senza alterare i codici delle variabili.
function steps(){
  return activeQuestions().flatMap(q=>q.type==='matrix'
    ? matrixRows(q).map(row=>({key:`${q.id}::${row.id}`,q,row}))
    : [{key:q.id,q,row:null}]);
}
function getStep(){return steps().find(s=>s.key===currentKey)||null;}
function pageTop(){
  const list=steps();const i=Math.max(0,list.findIndex(s=>s.key===currentKey));
  const percent=Math.round(((i+1)/list.length)*100);
  return `<div class="single-flow"><div class="eyebrow">QUESTIONARIO SOCI · DICEMBRE 2026 · DEMO</div><div class="progress-bg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="Avanzamento"><div class="progress-fill" style="width:${percent}%"></div></div>`;
}
function titleAndHint(q){
 return `<h2 id="question-title">${escapeHtml(q.text)}</h2>${(q.hint||[]).map(h=>`<p class="hint">${escapeHtml(h)}</p>`).join('')}`;
}
function renderIntro(){
 document.body.dataset.surveyScreen='intro';
 app.innerHTML=`<div class="single-flow">${demoPrefix()}<div class="question-card intro-card"><h1>La tua esperienza<br>con Better Together</h1><div class="intro-text">${SURVEY.intro.map(x=>`<p>${escapeHtml(x)}</p>`).join('')}</div><p class="demo-notice"><strong>Puoi interrompere la compilazione in qualsiasi momento e riprenderla dal punto in cui l’avevi lasciata</strong>, riaprendo questo stesso link. In questa versione di prova, il recupero funziona soltanto usando lo stesso browser e dispositivo.</p><p class="muted small">Test con il codice fittizio ${escapeHtml(socio?.id||'')}. Le risposte non vengono inviate a Better Together.</p></div><div class="actions"><span></span><button type="button" class="btn primary" data-action="start">${Object.keys(answers).length?'Riprendi':'Inizia il questionario'} →</button></div></div>`;
}

function renderScale(q){
 const ans=getAnswer(q)?.v;
 const main=q.opts.filter(o=>/^[1-5]$/.test(o.code));
 const extras=q.opts.filter(o=>!/^[1-5]$/.test(o.code));
 const a=`<div class="scale-labeled" aria-label="Scala di risposta">${main.map(o=>`<button type="button" class="scale-label ${ans===o.code?'active':''}" data-action="choose" data-code="${o.code}" aria-pressed="${ans===o.code}"><strong>${o.code}</strong><span>${escapeHtml(o.label)}</span></button>`).join('')}</div>`;
 // Numero e descrizione sono nello stesso pulsante a ogni larghezza.
 return a+(extras.length?`<div class="specials">${extras.map(o=>`<label class="special-choice ${ans===o.code?'selected':''}"><input type="radio" name="single-${q.id}" data-action="radio" value="${o.code}" ${ans===o.code?'checked':''}>${escapeHtml(o.label)}</label>`).join('')}</div>`:'');
}
function renderSingle(q){
 const ans=getAnswer(q)||{};
 const options=optionOrders[q.id];
 const choice=(o)=>{
  const checked=ans.v===o.code;
  return `<div class="choice-wrap"><label class="choice ${checked?'selected':''}"><input type="radio" name="single-${q.id}" data-action="radio" value="${escapeHtml(o.code)}" ${checked?'checked':''}><span>${escapeHtml(o.label)}</span></label>${o.other&&checked?`<div class="write-in"><label for="other-input">${o.label.includes('facoltativamente')?'Se desideri, specifica':'Specifica'}</label><input id="other-input" data-action="other-text" type="text" maxlength="300" value="${escapeHtml(ans.t||'')}" autocomplete="off"></div>`:''}</div>`;
 };
 return `<div class="choice-list">${options.map(choice).join('')}</div>`;
}
function renderMulti(q){
 const ans=getAnswer(q)||{v:[],otherTexts:{}};
 const codes=Array.isArray(ans.v)?ans.v:[];
 const maxText=q.max?`Seleziona al massimo ${q.max} risposte.`:'Seleziona tutte le risposte pertinenti.';
 const options=optionOrders[q.id];
 return `<p class="muted small" style="margin-bottom:16px">${maxText}</p><div class="choice-list">${options.map(o=>{
   const checked=codes.includes(o.code);
   return `<div class="choice-wrap"><label class="choice ${checked?'selected':''}"><input type="checkbox" data-action="check" value="${escapeHtml(o.code)}" ${checked?'checked':''}><span>${escapeHtml(o.label)}</span></label>${o.other&&checked?`<div class="write-in"><label for="other-input">Specifica</label><input id="other-input" data-action="other-text" data-code="${o.code}" maxlength="300" value="${escapeHtml(ans.otherTexts?.[o.code]||'')}" autocomplete="off"></div>`:''}</div>`;
 }).join('')}</div>`;
}
function renderMatrixItem(q,row){
  const ans=answers[q.id]?.rows?.[row.id]||'';
  const normal=q.opts.filter(o=>/^[1-5]$/.test(o.code));
  const extras=q.opts.filter(o=>!normal.includes(o));
  const instructionByBattery={
    'A5-A6':'Per ogni figura indicata, seleziona una sola risposta.',
    'B1-B5':'Per ogni situazione descritta, seleziona una sola risposta.',
    'B9V':'Per ogni aspetto indicato, seleziona una sola risposta.',
    'B13':'Per ogni caratteristica indicata, seleziona una sola risposta.'
  };
  const instruction=instructionByBattery[q.id]||'Seleziona una sola risposta.';
  const prefix=`<h3 class="battery-item-label">${escapeHtml(row.label)}</h3><p class="muted small battery-instruction">${escapeHtml(instruction)}</p>`;
  const choices=`<div class="scale-labeled" role="group" aria-label="${escapeHtml(row.label)}">${normal.map(o=>`<button type="button" class="scale-label ${ans===o.code?'active':''}" data-action="matrix-choice" data-rowid="${row.id}" data-code="${o.code}" aria-pressed="${ans===o.code}"><strong>${o.code}</strong><span>${escapeHtml(o.label)}</span></button>`).join('')}</div>`;
  const special=extras.length?`<div class="specials">${extras.map(o=>`<label class="special-choice ${ans===o.code?'selected':''}"><input type="radio" name="matrix-${q.id}-${row.id}" data-action="matrix-radio" data-rowid="${row.id}" value="${escapeHtml(o.code)}" ${ans===o.code?'checked':''}>${escapeHtml(o.label)}</label>`).join('')}</div>`:'';
  return prefix+choices+special;
}
function renderPostal(q){
 const ans=getAnswer(q)||{};
 const options=q.opts;
 return `<div class="choice-list">${options.map(o=>{
    const checked=ans.v===o.code;
    return `<div class="choice-wrap"><label class="choice ${checked?'selected':''}"><input type="radio" data-action="radio" name="postal-${q.id}" value="${o.code}" ${checked?'checked':''}><span>${escapeHtml(o.label)}</span></label>${o.code==='O01'&&checked?`<div class="write-in"><label for="postal-input">CAP (5 cifre)</label><input type="text" inputmode="numeric" pattern="[0-9]{5}" autocomplete="postal-code" maxlength="5" id="postal-input" data-action="postal-input" value="${escapeHtml(ans.t||'')}" placeholder="00000"></div>`:''}</div>`;
 }).join('')}</div>`;
}
function renderComment(q){
 const ans=getAnswer(q)||{};
 return `<div class="choice-list"><div class="choice-wrap"><label class="choice ${ans.v==='O01'?'selected':''}"><input type="radio" name="comment" data-action="radio" value="O01" ${ans.v==='O01'?'checked':''}><span>${escapeHtml(q.opts.find(o=>o.code==='O01').label)}</span></label>${ans.v==='O01'?`<div class="write-in"><label for="comment-input">Il tuo commento</label><textarea id="comment-input" data-action="comment-text" class="open-answer">${escapeHtml(ans.t||'')}</textarea></div>`:''}</div><label class="choice ${ans.v==='O02'?'selected':''}"><input type="radio" name="comment" data-action="radio" value="O02" ${ans.v==='O02'?'checked':''}><span>${escapeHtml(q.opts.find(o=>o.code==='O02').label)}</span></label></div>`;
}
function renderQuestion(preserveScroll=false){
 document.body.dataset.surveyScreen="question";
  const step=getStep();
  if(!step){screen='intro';renderIntro();return;}
  const {q,row}=step;
  const y=window.scrollY;
  const content=q.type==='matrix'?renderMatrixItem(q,row):q.type==='scale'?renderScale(q):q.type==='multi'?renderMulti(q):q.type==='postal'?renderPostal(q):q.type==='comment'?renderComment(q):renderSingle(q);
  app.innerHTML=pageTop()+`<div class="question-card" aria-labelledby="question-title">${titleAndHint(q)}${content}${alertMessage?`<div class="alert" role="alert">${escapeHtml(alertMessage)}</div>`:''}</div><div class="actions"><button type="button" class="btn" data-action="back">← Indietro</button><button type="button" class="btn primary" data-action="next">${steps().at(-1)?.key===currentKey?'Termina':'Avanti'} →</button></div></div>`;
  if(preserveScroll)window.scrollTo(0,y);else window.scrollTo(0,0);
}
function validate(step){
  const {q,row}=step;
  const ans=getAnswer(q);
  if(!ans)return 'Seleziona una risposta per proseguire.';
  if(q.type==='matrix'){
    if(!ans.rows?.[row.id])return 'Seleziona una risposta per proseguire.';
  }else if(q.type==='multi'){
    if(!Array.isArray(ans.v)||!ans.v.length)return 'Seleziona almeno una risposta per proseguire.';
    if(q.max && ans.v.length>q.max)return `Puoi selezionare al massimo ${q.max} risposte.`;
    for(const opt of q.opts){
      if(opt.other&&ans.v.includes(opt.code)&&!(ans.otherTexts?.[opt.code]||'').trim())return 'Specifica la risposta selezionata alla voce «Altro».';
    }
  }else{
    if(!ans.v)return 'Seleziona una risposta per proseguire.';
    const opt=q.opts.find(o=>o.code===ans.v);
    if(opt?.other && !opt.label.includes('facoltativamente') && !(ans.t||'').trim())return 'Completa la risposta selezionata.';
    if(q.type==='postal' && ans.v==='O01' && !/^\d{5}$/.test(ans.t||''))return 'Inserisci un CAP di cinque cifre.';
    if(q.type==='comment' && ans.v==='O01' && !(ans.t||'').trim())return 'Scrivi il commento oppure scegli «Non ho altro da aggiungere».';
  }
  return '';
}
function updateChoice(code){
 const q=getStep().q;
 answers[q.id]={...(answers[q.id]||{}),v:code};
 if(q.type==='postal'&&code!=='O01')delete answers[q.id].t;
 if(q.type==='comment'&&code!=='O01')delete answers[q.id].t;
 alertMessage='';storeDemoState();renderQuestion(true);
}
function updateMulti(code,checked){
 const q=getStep().q;
 const current=answers[q.id]||{v:[],otherTexts:{}};
 const option=q.opts.find(x=>x.code===code);
 let values=Array.isArray(current.v)?[...current.v]:[];
 if(checked){
  if(option?.exclusive)values=[code];
  else{
   values=values.filter(c=>!q.opts.find(o=>o.code===c)?.exclusive);
   if(!values.includes(code))values.push(code);
  }
 }else values=values.filter(c=>c!==code);
 if(q.max&&values.length>q.max){
  alertMessage=`Puoi selezionare al massimo ${q.max} risposte.`;
  renderQuestion(true);return;
 }
 answers[q.id]={v:values,otherTexts:current.otherTexts||{}};
 alertMessage='';storeDemoState();renderQuestion(true);
}
function updateMatrix(rowid,code){
 const q=getStep().q;
 answers[q.id]={rows:{...(answers[q.id]?.rows||{}),[rowid]:code}};
 if(q.id==='B1-B5'&&rowid==='B1'&&!['2','3','4'].includes(code))delete answers[q.id].rows.B2;
 alertMessage='';storeDemoState();renderQuestion(true);
}
function next(){
  if(readDemoState(invitation)?.screen==='done'){screen='done';renderDone();return;}
  const step=getStep();const error=validate(step);
  if(error){alertMessage=error;renderQuestion(true);return;}
  alertMessage='';
  const list=steps();const i=list.findIndex(s=>s.key===currentKey);
  if(readDemoState(invitation)?.screen==='done'){screen='done';renderDone();return;}
  if(i<list.length-1){currentKey=list[i+1].key;storeDemoState();renderQuestion();}else{screen='done';storeDemoState();renderDone();}
}
function back(){
  const list=steps();const i=list.findIndex(s=>s.key===currentKey);
  if(i>0){currentKey=list[i-1].key;alertMessage='';storeDemoState();renderQuestion();}
  else{screen='intro';storeDemoState();renderIntro();window.scrollTo(0,0);}
}
function columnNames(){
 const cols=['id_rispondente'];
 for(const q of QUESTIONS){
   if(q.type==='matrix')cols.push(...q.rows.map(r=>r.id));
   else if(q.type==='comment')cols.push('E3','E3_testo');
   else if(q.type==='postal')cols.push(q.id,q.id+'_cap');
   else if(q.type==='multi')cols.push(q.id,q.id+'_altro');
   else if(q.opts?.some(o=>o.other))cols.push(q.id,q.id+'_altro');
   else cols.push(q.id);
 }
 return cols;
}
function valueRows(state=answers,id=invitation){
 const result={id_rispondente:id};
 for(const q of QUESTIONS){
   const shown=active(q,state),a=shown?state[q.id]:null;
   if(q.type==='matrix'){
    for(const r of q.rows){
     const eligible=shown&&(q.id!=='B1-B5'||r.id!=='B2'||['2','3','4'].includes(a?.rows?.B1));
     result[r.id]=eligible?(a?.rows?.[r.id]||''):'FILTERED';
    }
   }else if(q.type==='comment'){
    result[q.id]=shown?(a?.v||''):'FILTERED';result.E3_testo=shown?(a?.t||''):'';
   }else if(q.type==='postal'){
    result[q.id]=shown?(a?.v||''):'FILTERED';result[q.id+'_cap']=shown?(a?.t||''):'';
   }else if(q.type==='multi'){
    result[q.id]=shown?(Array.isArray(a?.v)?q.opts.filter(o=>a.v.includes(o.code)).map(o=>o.code).join(';'):''):'FILTERED';
    result[q.id+'_altro']=shown?Object.values(a?.otherTexts||{}).join('; '):'';
   }else if(q.opts?.some(o=>o.other)){
    result[q.id]=shown?(a?.v||''):'FILTERED';result[q.id+'_altro']=shown?(a?.t||''):'';
   }else result[q.id]=shown?(a?.v||''):'FILTERED';
 }
 return result;
}
function makeCSV(names,rows){
 const quote=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
 return '\ufeff'+names.map(quote).join(',')+'\r\n'+rows.map(row=>names.map(k=>quote(row[k])).join(',')).join('\r\n')+'\r\n';
}
function toCSV(){return makeCSV(columnNames(),[valueRows()]);}
function allCSV(){
 const names=['stato_compilazione','aggiornato_il',...columnNames()];
 const rows=[];
 for(const p of demoSocios){
  const st=readDemoState(p.token);
  if(!st)continue;
  rows.push({stato_compilazione:st.screen==='done'?'COMPLETATO':'IN_CORSO',aggiornato_il:st.updatedAt||'',...valueRows(st.answers,p.id)});
 }
 return makeCSV(names,rows);
}
function saveCSV(){
 const csv=toCSV();const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);
 const el=document.createElement('a');el.href=url;el.download=`better_together_${socio?.id||'demo'}.csv`;document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function saveAllCSV(){
 const csv=allCSV(); const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='better_together_risposte_demo_locali.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function resetCurrent(){
 if(!socio)return;
 localStorage.removeItem(storeKey);location.reload();
}
function resetAll(){
 if(!confirm('Azzerare tutte le risposte fittizie e la simulazione degli invii su questo browser?'))return;
 demoSocios.forEach(p=>localStorage.removeItem(`BT_TEST_DEV_20261113_${p.token}`));localStorage.removeItem(dispatchKey);panelMessage='Simulazione azzerata.';renderRoster();
}
function renderDone(){
 document.body.dataset.surveyScreen='done';
 app.innerHTML=`<div class="single-flow"><div class="question-card intro-card"><div class="finish-icon">✓</div><h1>Questionario già completato</h1><p class="lead">La compilazione del codice fittizio ${escapeHtml(socio?.id||'')} è stata registrata in questo browser.</p><p class="demo-notice"><strong>Test anti-duplicazione locale:</strong> riaprendo lo stesso link in questo browser non puoi inviare un secondo questionario. Il blocco centralizzato su più dispositivi richiederà il server.</p><div class="demo-buttons"><button class="btn" type="button" data-action="csv">Scarica CSV di questa prova</button><a class="btn primary" href="${escapeHtml(location.pathname)}">Torna al pannello test</a></div></div></div>`;
 window.scrollTo(0,0);
}

app.addEventListener('click',e=>{
 const target=e.target.closest('[data-action]');if(!target)return;
 const action=target.dataset.action;
 if(action==='start'){if(readDemoState(invitation)?.screen==='done'){screen='done';renderDone();return;}screen='question';if(!steps().find(x=>x.key===currentKey))currentKey=steps()[0].key;storeDemoState();renderQuestion();}
 else if(action==='choose')updateChoice(target.dataset.code);
 else if(action==='matrix-choice')updateMatrix(target.dataset.rowid,target.dataset.code);
 else if(action==='next')next();
 else if(action==='back')back();
 else if(action==='csv')saveCSV();
 else if(action==='all-csv')saveAllCSV();
 else if(action==='simulate-initial')simulateDispatch('initial');
 else if(action==='simulate-reminder')simulateDispatch('reminder');
 else if(action==='dispatch-csv')csvDispatch();
 else if(action==='copy-email'||action==='copy-wa'){const person=demoSocios.find(p=>p.id===target.dataset.socio);if(person)copyDev(makeInvitationMessage(person,action==='copy-wa'?'wa':'email'));}
 else if(action==='reset-current')resetCurrent();
 else if(action==='reset-all')resetAll();
});
app.addEventListener('change',e=>{
 const target=e.target;
 if(target.dataset.action==='radio')updateChoice(target.value);
  if(target.dataset.action==='matrix-radio')updateMatrix(target.dataset.rowid,target.value);
 if(target.dataset.action==='check')updateMulti(target.value,target.checked);
});
app.addEventListener('input',e=>{
 const target=e.target,q=getStep().q;
 if(target.dataset.action==='other-text'){
  if(q.type==='multi'){
   answers[q.id]??={v:[],otherTexts:{}};
   answers[q.id].otherTexts??={};answers[q.id].otherTexts[target.dataset.code]=target.value;
  }else {answers[q.id]??={};answers[q.id].t=target.value;}
 }else if(['postal-input','comment-text'].includes(target.dataset.action)){
  answers[q.id]??={};answers[q.id].t=target.value;
 }
 storeDemoState();
});
// Read-only interface for automated smoke testing; not displayed to respondents.
window.BT_TEST={get activeIds(){return activeQuestions().map(q=>q.id);},get activeKeys(){return steps().map(s=>s.key);},get currentId(){return getStep()?.q.id||null;},get currentRowId(){return getStep()?.row?.id||null;},get currentKey(){return currentKey;},get answers(){return JSON.parse(JSON.stringify(answers));},get csv(){return toCSV();},get pages(){return QUESTIONS;}};
window.addEventListener('storage',e=>{if(socio && e.key===storeKey && readDemoState(invitation)?.screen==='done'){screen='done';renderDone();}else if(!invitation && (e.key===dispatchKey || e.key?.startsWith('BT_TEST_DEV_20261113_'))){renderRoster();}});
if(!invitation)renderRoster();
else if(!socio)renderBadToken();
else{restoreDemoState();if(screen==='done')renderDone();else if(screen==='question'&&getStep())renderQuestion();else renderIntro();}
