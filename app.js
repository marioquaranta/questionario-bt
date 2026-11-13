 'use strict';
/* Ambiente di sviluppo con archiviazione centralizzata Supabase. SOLO TEST FITTIZI. */
const ENDPOINT='https://ixevtederjaovjkhvuqi.supabase.co/functions/v1/bt-questionario';
const SURVEY=window.BT_SURVEY;
const QUESTIONS=SURVEY.questions;
const QUESTION_MAP=Object.fromEntries(QUESTIONS.map(q=>[q.id,q]));
const app=document.getElementById('app');
const query=new URLSearchParams(location.search);
const invitation=query.get('token')||'';
const VALID_TOKEN=/^[a-f0-9]{64}$/;
let screen='intro';
let currentKey=QUESTIONS[0].id;
let answers={};
let alertMessage='';
let navigating=false;
let saveTimer=null;
let saveQueue=Promise.resolve();
let saveFailure='';
const optionOrders={};
const rowOrders={};

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function randomSeed(s){let x=2166136261;for(let i=0;i<s.length;i++){x=Math.imul(x^s.charCodeAt(i),16777619)>>>0;}return x||1;}
function seededShuffle(items,seed){let s=seed>>>0;const a=[...items];for(let i=a.length-1;i>0;i--){s=(Math.imul(s,1664525)+1013904223)>>>0;const j=s%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
for(const q of QUESTIONS){
 const o=q.opts||[];
 const fixed=o.filter(x=>x.fixed||x.other||x.exclusive||x.label==='Non ricordo'||x.label==='Non so'||(q.id==='D1'&&x.label==='Al momento non sento il bisogno di partecipare'));
 optionOrders[q.id]=q.random?[...seededShuffle(o.filter(x=>!fixed.includes(x)),randomSeed(invitation+':'+q.id+':options')),...fixed]:o;
 if(q.type==='matrix'){
  if(q.id==='B1-B5')rowOrders[q.id]=seededShuffle(q.rows.filter(r=>r.id!=='B2'),randomSeed(invitation+':'+q.id+':rows'));
  else rowOrders[q.id]=q.random?seededShuffle(q.rows,randomSeed(invitation+':'+q.id+':rows')):q.rows;
 }
}
function tokenLink(token){return `${location.origin}${location.pathname}?token=${encodeURIComponent(token)}`;}
function setSaveStatus(text){const el=document.getElementById('save-state');if(el)el.textContent=text||'';}
async function api(body){
 let res;
 try{res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});}
 catch{throw new Error('Connessione al servizio di raccolta non disponibile');}
 let data;
 try{data=await res.json();}catch{throw new Error(`Risposta inattesa dal servizio (HTTP ${res.status})`);}
 if(!res.ok && data?.status==='already_completed')return data;
 if(!res.ok)throw new Error(data?.error||`Errore del servizio (HTTP ${res.status})`);
 return data;
}
function stepIndex(){return Math.max(0,steps().findIndex(x=>x.key===currentKey));}
function enqueueSave(){
 const snapshot=JSON.parse(JSON.stringify(answers));
 const index=stepIndex();
 saveQueue=saveQueue.catch(()=>{}).then(async()=>{
  const result=await api({token:invitation,action:'save',answers:snapshot,current_step:index});
  if(result.status==='already_completed'){
   screen='done';renderDone();return;
  }
  if(result.status!=='saved')throw new Error('Risposta inattesa al salvataggio');
  saveFailure='';setSaveStatus('Risposte salvate');
 });
 return saveQueue.catch(err=>{saveFailure=err.message||'Errore di salvataggio';setSaveStatus('Salvataggio non riuscito');throw err;});
}
function scheduleSave(delay=350){
 if(!VALID_TOKEN.test(invitation)||screen==='done')return;
 clearTimeout(saveTimer);
 setSaveStatus('Salvataggio…');
 saveTimer=setTimeout(()=>{enqueueSave().catch(err=>console.warn('Salvataggio non riuscito',err.message));},delay);
}
async function flushSave(){
 clearTimeout(saveTimer);saveTimer=null;
 await enqueueSave();
}
function renderHome(){
 document.body.dataset.surveyScreen='intro';
 app.innerHTML=`<div class="single-flow"><div class="question-card intro-card"><div class="dev-badge">AMBIENTE DI SVILUPPO · DATI FITTIZI</div><h1>Test della raccolta centralizzata</h1><p>Per provare i link personalizzati utilizza uno dei codici di 64 caratteri ottenuti da Supabase. Non inserire dati di soci reali.</p><p class="demo-notice"><strong>La raccolta è ora centralizzata.</strong> Le compilazioni di prova vengono salvate su Supabase e possono essere riprese da browser differenti. Il sito dei volontari è separato.</p><form id="code-form"><label for="code-input"><strong>Codice personale di prova</strong></label><div class="write-in"><input id="code-input" type="text" spellcheck="false" autocapitalize="off" autocomplete="off" inputmode="text" maxlength="64" placeholder="Incolla qui il codice dal CSV" required style="width:100%;font-family:monospace"></div><div class="actions"><span></span><button class="btn primary" type="submit">Apri il questionario →</button></div></form><p class="muted small">Puoi anche costruire il link personale aggiungendo <code>?token=CODICE</code> all'indirizzo di questa pagina. Non pubblicare il CSV dei codici su GitHub.</p><p id="home-message" role="status"></p></div></div>`;
}
function renderBadToken(message=''){document.body.dataset.surveyScreen='intro';app.innerHTML=`<div class="single-flow"><div class="question-card intro-card"><h1>Link di prova non valido</h1><p>${escapeHtml(message||'Il codice non è stato trovato nell’archivio di test.')}</p><a href="${escapeHtml(location.pathname)}">Torna alla pagina iniziale</a></div></div>`;}
function renderLoading(){document.body.dataset.surveyScreen='intro';app.innerHTML='<div class="single-flow"><div class="question-card intro-card"><h1>Recupero della compilazione…</h1><p>Sto verificando il codice e caricando le eventuali risposte già registrate.</p></div></div>';}
function renderUnavailable(message){document.body.dataset.surveyScreen='intro';app.innerHTML=`<div class="single-flow"><div class="question-card intro-card"><h1>Connessione non riuscita</h1><p>Non posso verificare il link o caricare le risposte: ${escapeHtml(message)}</p><button class="btn primary" type="button" data-action="retry">Riprova</button></div></div>`;}
async function loadRemote(){
 if(!VALID_TOKEN.test(invitation)){renderBadToken('Il codice deve contenere 64 caratteri esadecimali.');return;}
 renderLoading();
 try{
  const result=await api({token:invitation,action:'load'});
  if(result.status!=='ok')throw new Error('Risposta inattesa dal server');
  answers=(result.answers&&typeof result.answers==='object'&&!Array.isArray(result.answers))?result.answers:{};
  if(result.completed){screen='done';renderDone();return;}
  const list=steps();
  const progress=Number.isInteger(result.current_step)?Math.max(0,Math.min(result.current_step,list.length-1)):0;
  currentKey=list[progress]?.key||list[0]?.key||QUESTIONS[0].id;
  screen=Object.keys(answers).length?'question':'intro';
  if(screen==='question')renderQuestion();else renderIntro();
 }catch(err){if(err.message==='Invito non trovato'){renderBadToken();}else renderUnavailable(err.message||'Errore sconosciuto');}
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
  return `<div class="single-flow"><div class="eyebrow">QUESTIONARIO SOCI · TEST SVILUPPO</div><div class="progress-bg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="Avanzamento"><div class="progress-fill" style="width:${percent}%"></div></div>`;
}
function titleAndHint(q){
 return `<h2 id="question-title">${escapeHtml(q.text)}</h2>${(q.hint||[]).map(h=>`<p class="hint">${escapeHtml(h)}</p>`).join('')}`;
}
function renderIntro(){
 document.body.dataset.surveyScreen='intro';
 app.innerHTML=`<div class="single-flow"><div class="question-card intro-card"><h1>La tua esperienza<br>con Better Together</h1><div class="intro-text">${SURVEY.intro.map(x=>`<p>${escapeHtml(x)}</p>`).join('')}</div><p class="demo-notice"><strong>Puoi interrompere la compilazione in qualsiasi momento e riprenderla dal punto in cui l’avevi lasciata</strong>, riaprendo questo stesso link. In questa versione di prova, il recupero funziona anche da un browser o dispositivo diverso.</p><p class="muted small">Ambiente di sviluppo: utilizza soltanto codici e risposte fittizi. Le risposte vengono salvate nel database Supabase di prova.</p></div><div class="actions"><span></span><button type="button" class="btn primary" data-action="start">${Object.keys(answers).length?'Riprendi':'Inizia il questionario'} →</button></div></div>`;
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
  app.innerHTML=pageTop()+`<div class="question-card" aria-labelledby="question-title">${titleAndHint(q)}${content}${alertMessage?`<div class="alert" role="alert">${escapeHtml(alertMessage)}</div>`:''}</div><p id="save-state" class="bt-save-status" role="status" aria-live="polite"></p><div class="actions"><button type="button" class="btn" data-action="back">← Indietro</button><button type="button" class="btn primary" data-action="next">${steps().at(-1)?.key===currentKey?'Termina':'Avanti'} →</button></div></div>`;
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
 alertMessage='';scheduleSave();renderQuestion(true);
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
 alertMessage='';scheduleSave();renderQuestion(true);
}
function updateMatrix(rowid,code){
 const q=getStep().q;
 answers[q.id]={rows:{...(answers[q.id]?.rows||{}),[rowid]:code}};
 if(q.id==='B1-B5'&&rowid==='B1'&&!['2','3','4'].includes(code))delete answers[q.id].rows.B2;
 alertMessage='';scheduleSave();renderQuestion(true);
}
async function next(){
 if(navigating)return;
 const step=getStep();if(!step)return;
 const error=validate(step);
 if(error){alertMessage=error;renderQuestion(true);return;}
 alertMessage='';
 const list=steps();const i=list.findIndex(s=>s.key===currentKey);
 navigating=true;
 try{
   if(i===list.length-1){
     setSaveStatus('Invio in corso…');
     await flushSave();
     const result=await api({token:invitation,action:'complete',answers,current_step:i});
     if(result.status==='already_completed'||result.status==='completed'){
       screen='done';renderDone();
     }else throw new Error('Risposta inattesa dal server');
   }else{
     currentKey=list[i+1].key;
     screen='question';renderQuestion();
     await flushSave();
   }
 }catch(err){
   alertMessage='Non è stato possibile salvare le risposte sul server. Controlla la connessione e riprova: il questionario non risulta inviato.';
   renderQuestion(true);setSaveStatus('Errore di salvataggio');
 }finally{navigating=false;}
}
async function back(){
 if(navigating)return;
 const list=steps();const i=list.findIndex(s=>s.key===currentKey);
 if(i>0){currentKey=list[i-1].key;alertMessage='';renderQuestion();scheduleSave();}
 else{screen='intro';renderIntro();window.scrollTo(0,0);scheduleSave();}
}

function renderDone(){
 document.body.dataset.surveyScreen='done';
 app.innerHTML=`<div class="single-flow"><div class="question-card intro-card"><div class="finish-icon">✓</div><h1>Questionario già completato</h1><p class="lead">La compilazione di questo codice fittizio risulta completata nell’archivio centralizzato.</p><p class="demo-notice"><strong>Test anti-duplicazione:</strong> lo stesso link non deve consentire un'altra compilazione, nemmeno in un browser diverso.</p><a class="btn primary" href="${escapeHtml(location.pathname)}">Torna alla pagina iniziale</a></div></div>`;
 window.scrollTo(0,0);
}
app.addEventListener('submit',e=>{
 if(e.target.id!=='code-form')return;
 e.preventDefault();
 const code=document.getElementById('code-input')?.value?.trim().toLowerCase()||'';
 if(!VALID_TOKEN.test(code)){document.getElementById('home-message').textContent='Codice non valido: servono 64 caratteri esadecimali.';return;}
 location.assign(tokenLink(code));
});
app.addEventListener('click',e=>{
 const target=e.target.closest('[data-action]');if(!target)return;
 const action=target.dataset.action;
 if(action==='start'){
  screen='question';if(!steps().find(x=>x.key===currentKey))currentKey=steps()[0].key;
  renderQuestion();scheduleSave(0);
 }else if(action==='choose')updateChoice(target.dataset.code);
 else if(action==='matrix-choice')updateMatrix(target.dataset.rowid,target.dataset.code);
 else if(action==='next')next();
 else if(action==='back')back();
 else if(action==='retry')loadRemote();
});
app.addEventListener('change',e=>{
 const target=e.target;
 if(target.dataset.action==='radio')updateChoice(target.value);
 if(target.dataset.action==='matrix-radio')updateMatrix(target.dataset.rowid,target.value);
 if(target.dataset.action==='check')updateMulti(target.value,target.checked);
});
app.addEventListener('input',e=>{
 const target=e.target;
 const step=getStep();if(!step)return;
 const q=step.q;
 if(target.dataset.action==='other-text'){
  if(q.type==='multi'){
   answers[q.id]??={v:[],otherTexts:{}};
   answers[q.id].otherTexts??={};answers[q.id].otherTexts[target.dataset.code]=target.value;
  }else {answers[q.id]??={};answers[q.id].t=target.value;}
 }else if(['postal-input','comment-text'].includes(target.dataset.action)){
  answers[q.id]??={};answers[q.id].t=target.value;
 }else{return;}
 scheduleSave(450);
});
// Un piccolo salvataggio in caso di cambio pagina; il salvataggio finale resta esplicito.
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden' && screen==='question' && VALID_TOKEN.test(invitation) && saveTimer){
  clearTimeout(saveTimer);saveTimer=null;
  fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:invitation,action:'save',answers,current_step:stepIndex()}),keepalive:true,cache:'no-store'}).catch(()=>{});
 }
});
// Interfaccia di controllo per i test automatici; non visibile ai rispondenti.
window.BT_TEST={get activeIds(){return activeQuestions().map(q=>q.id);},get activeKeys(){return steps().map(s=>s.key);},get currentId(){return getStep()?.q.id||null;},get currentRowId(){return getStep()?.row?.id||null;},get currentKey(){return currentKey;},get answers(){return JSON.parse(JSON.stringify(answers));},get pages(){return QUESTIONS;}};
if(!invitation)renderHome();else loadRemote();
