'use strict';
/* Better Together: accesso diretto con link personale. */
const ENDPOINT='https://ixevtederjaovjkhvuqi.supabase.co/functions/v1/bt-questionario';
const SCHEMA_VERSION=10;
const SURVEY_REVISION='BT_V9_5_20261120_ATTIVITA20';
const SURVEY=window.BT_SURVEY;
const QUESTIONS=SURVEY.questions;
const QUESTION_MAP=Object.fromEntries(QUESTIONS.map(q=>[q.id,q]));
const app=document.getElementById('app');
const query=new URLSearchParams(location.search);
const invitation=(query.get('token')||'').toLowerCase();
const VALID_TOKEN=/^[a-f0-9]{64}$/;
let screen='intro';
let currentKey=QUESTIONS[0].id;
let answers={};
let alertMessage='';
let navigating=false;
let upgradeNeeded=false;
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
 const fixed=o.filter(x=>x.fixed||x.other||x.exclusive||x.label==='Non ricordo'||x.label==='Non so');
 optionOrders[q.id]=q.random?[...seededShuffle(o.filter(x=>!fixed.includes(x)),randomSeed(invitation+':'+q.id+':options')),...fixed]:o;
 if(q.type==='matrix'){
  if(q.id==='B1-B5')rowOrders[q.id]=seededShuffle(q.rows.filter(r=>r.id!=='B2'),randomSeed(invitation+':'+q.id+':rows'));
  else rowOrders[q.id]=q.random?seededShuffle(q.rows,randomSeed(invitation+':'+q.id+':rows')):q.rows;
 }
}
function setSaveStatus(text){const el=document.getElementById('save-state');if(el)el.textContent=text||'';}
function stepIndex(){return Math.max(0,steps().findIndex(x=>x.key===currentKey));}
function payloadAnswers(){return {...answers,__schema_version:SCHEMA_VERSION,__survey_revision:SURVEY_REVISION};}
async function api(body){
 let res;
 try{res=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});}
 catch{throw new Error('Connessione al servizio di raccolta non disponibile');}
 let data;
 try{data=await res.json();}catch{throw new Error(`Risposta inattesa dal servizio (HTTP ${res.status})`);}
 if(!res.ok&&data?.status==='already_completed')return data;
 if(!res.ok)throw new Error(data?.error||`Errore del servizio (HTTP ${res.status})`);
 return data;
}
function enqueueSave(){
 // Serializzare i salvataggi: le richieste non devono arrivare fuori ordine.
 const snapshot=JSON.parse(JSON.stringify(payloadAnswers()));
 const index=stepIndex();
 saveQueue=saveQueue.catch(()=>{}).then(async()=>{
  const result=await api({token:invitation,action:'save',answers:snapshot,current_step:index});
  if(result.status==='already_completed'){screen='done';renderDone();return;}
  if(result.status!=='saved')throw new Error('Risposta inattesa al salvataggio');
  saveFailure='';setSaveStatus('Risposte salvate');
 });
 return saveQueue.catch(err=>{saveFailure=err.message||'Errore di salvataggio';setSaveStatus('Salvataggio non riuscito');throw err;});
}
function scheduleSave(delay=350){
 if(!VALID_TOKEN.test(invitation)||screen==='done'||upgradeNeeded)return;
 clearTimeout(saveTimer);
 setSaveStatus('Salvataggio…');
 saveTimer=setTimeout(()=>{enqueueSave().catch(err=>console.warn('Salvataggio non riuscito',err.message));},delay);
}
async function flushSave(){
 clearTimeout(saveTimer);saveTimer=null;
 await enqueueSave();
 if(screen==='done')throw new Error('Questionario già completato');
}
function renderMissingLink(){
 document.body.dataset.surveyScreen='intro';
 app.innerHTML='<div class="single-flow"><div class="question-card intro-card"><h1>Questionario Better Together</h1><p>Per partecipare, apri il link personale che hai ricevuto da Better Together.</p><p>Se non trovi più il link, contatta l’associazione.</p></div></div>';
}
function renderBadToken(message=''){
 document.body.dataset.surveyScreen='intro';
 app.innerHTML=`<div class="single-flow"><div class="question-card intro-card"><h1>Link non valido</h1><p>${escapeHtml(message||'Questo link personale non è stato riconosciuto. Apri il link che hai ricevuto da Better Together oppure contatta l’associazione.')}</p></div></div>`;
}
function renderLoading(){document.body.dataset.surveyScreen='intro';app.innerHTML='<div class="single-flow"><div class="question-card intro-card"><h1>Caricamento del questionario…</h1><p>Sto verificando il link personale e caricando le eventuali risposte già registrate.</p></div></div>';}
function renderUnavailable(message){document.body.dataset.surveyScreen='intro';app.innerHTML=`<div class="single-flow"><div class="question-card intro-card"><h1>Connessione non riuscita</h1><p>Non posso verificare il link o caricare le risposte: ${escapeHtml(message)}</p><button class="btn primary" type="button" data-action="retry">Riprova</button></div></div>`;}
async function loadRemote(){
 if(!VALID_TOKEN.test(invitation)){renderBadToken('Il link personale non è valido. Apri il link ricevuto da Better Together oppure contatta l’associazione.');return;}
 renderLoading();
 try{
  const result=await api({token:invitation,action:'load'});
  if(result.status==='already_completed'){screen='done';renderDone();return;}
  if(result.status!=='ok')throw new Error('Risposta inattesa dal server');
  const incoming=(result.answers&&typeof result.answers==='object'&&!Array.isArray(result.answers))?result.answers:{};
  if(result.completed){answers=incoming;screen='done';renderDone();return;}
  // Una compilazione Word8 (o precedente) non e' compatibile con Word9.
  // L'utente deve confermare il riavvio: non cancellare i dati precedenti al caricamento.
  upgradeNeeded=Object.keys(incoming).some(k=>!k.startsWith('__')) && incoming.__schema_version!==SCHEMA_VERSION;
  answers=upgradeNeeded?{}:incoming;
  const list=steps();
  const progress=Number.isInteger(result.current_step)?Math.max(0,Math.min(result.current_step,list.length-1)):0;
  currentKey=upgradeNeeded?(list[0]?.key||QUESTIONS[0].id):(list[progress]?.key||list[0]?.key||QUESTIONS[0].id);
  screen='intro';
  renderIntro();
 }catch(err){if(err.message==='Invito non trovato')renderBadToken();else renderUnavailable(err.message||'Errore sconosciuto');}
}
function getAnswer(q,row=null){
 if(q.id==='B11'&&row?.venueCode) return answers.B11?.byVenue?.[row.venueCode]||null;
 return answers[q.id]||null;
}
function chosenVenues(state=answers){
 const codes=Array.isArray(state.B10?.v)?state.B10.v:[];
 return codes.filter(code=>/^F(?:[1-9]|10)$/.test(code));
}
function venueName(code){return QUESTION_MAP.B10.opts.find(o=>o.code===code)?.label||'';}

function active(q,state=answers){
 const value=(id)=>state[id]?.v;
 if(q.id==='P3')return ['O03','O04','O05'].includes(value('P2')) && ['O02','O03'].includes(value('P1'));
 if(q.id==='B8')return Array.isArray(value('B7')) && value('B7').some(code=>/^F\d+$/.test(code));
 if(['B11','B12'].includes(q.id))return chosenVenues(state).length>0;
 if(q.id==='D5')return ['O03','O04','O05'].includes(value('P2'));
 if(q.id==='G3')return ['O01','O02'].includes(value('G2'));
 return true;
}
function activeQuestions(){return QUESTIONS.filter(q=>active(q));}
function matrixRows(q,state=answers){
 if(q.id==='B8'){
  const chosen=Array.isArray(state.B7?.v)?state.B7.v:[];
  return chosen.map(code=>q.rows.find(row=>row.activityCode===code)).filter(Boolean);
 }
 if(q.id==='B12'){
  return chosenVenues(state).map(code=>q.rows.find(row=>row.venueCode===code)).filter(Boolean);
 }
 const rows=rowOrders[q.id]||[];
 if(q.id==='B1-B5'){
  const withB2=[];
  for(const r of rows){
   withB2.push(r);
   if(r.id==='B1'&&['2','3','4'].includes(state[q.id]?.rows?.B1))withB2.push(q.rows.find(x=>x.id==='B2'));
  }
  return withB2;
 }
 return rows;
}
// Una schermata per ogni item delle batterie, senza alterare i codici delle variabili.
function steps(){
  return activeQuestions().flatMap(q=>{
    let pages;
    // B11: a page for each selected venue; B8 and B12 stay on one page.
    if(q.id==='B11')pages=chosenVenues().map(code=>({key:'B11::'+code,q,row:{id:'B11_'+code,venueCode:code,label:venueName(code)}}));
    else if(q.type==='matrix' && ['A6-A7','B8','B12'].includes(q.id))pages=[{key:q.id,q,row:null}];
    else pages=q.type==='matrix' ? matrixRows(q).map(row=>({key:`${q.id}::${row.id}`,q,row}))
      : [{key:q.id,q,row:null}];
    const section=(SURVEY.sections||[]).find(x=>x.startAt===q.id);
    return section?[{key:`section::${section.id}`,section},...pages]:pages;
  });
}
function getStep(){return steps().find(s=>s.key===currentKey)||null;}
function pageTop(){
  const list=steps();const i=Math.max(0,list.findIndex(s=>s.key===currentKey));
  const percent=Math.round(((i+1)/list.length)*100);
  return `<div class="single-flow"><div class="eyebrow">QUESTIONARIO SOCI · DICEMBRE 2026</div><div class="progress-bg" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-label="Avanzamento"><div class="progress-fill" style="width:${percent}%"></div></div>`;
}
// Raccordi e parole in grassetto del Word: in viola, senza cambiare font.
function richText(value,highlights=[]){
 const src=String(value??'');
 const parts=(highlights||[]).filter(Boolean).sort((a,b)=>b.length-a.length);
 if(!parts.length)return escapeHtml(src);
 let cursor=0,result='';
 while(cursor<src.length){
  let found=null;
  for(const word of parts){
   const pos=src.indexOf(word,cursor);
   if(pos<0)continue;
   if(!found||pos<found.pos||(pos===found.pos&&word.length>found.word.length))found={pos,word};
  }
  if(!found)break;
  result+=escapeHtml(src.slice(cursor,found.pos));
  result+=`<strong style="color:var(--purple);font-weight:700">${escapeHtml(found.word)}</strong>`;
  cursor=found.pos+found.word.length;
 }
 return result+escapeHtml(src.slice(cursor));
}
function displayTitle(q,row){
 if(q.id==='B8')return 'Quando hai partecipato a:';
 let txt=q.text;
 if(q.id==='B11'&&row?.venueCode){
   txt=txt+' '+venueName(row.venueCode)+'?';
 }
 return txt;
}
function titleAndHint(q,row){
 let title;
 if(q.id==='A2b'){
  // Mostra il canale di A2a sulla riga successiva, tutto in viola;
  // il punto interrogativo rimane nero come il testo della domanda.
  const option=QUESTION_MAP.A2a.opts.find(o=>o.code===answers.A2a?.v);
  const [prefix,suffix='']=q.text.split('[Risposta a A2a]');
  title=`${escapeHtml(prefix)}<span class="linked-answer-line"><span class="linked-answer">${escapeHtml(option?.label||'il canale selezionato')}</span>${escapeHtml(suffix)}</span>`;
 }else{
  title=richText(displayTitle(q,row),q.id==='B11'&&row?.venueCode?[row.label]:q.highlights);
 }
 return `<p class="question-progress-number">${escapeHtml(q.displayCode||q.id)}</p><h2 id="question-title">${title}</h2>${(q.hint||[]).map(h=>`<p class="hint">${escapeHtml(h)}</p>`).join('')}`;
}
// A raccordo is a standalone screen: never combine it with the first question.
function renderRaccordo(step,preserveScroll=false){
 document.body.dataset.surveyScreen='section';
 const y=window.scrollY;
 const lines=step.section.lines.map(line=>`<p style="line-height:1.55;margin:0 0 16px">${richText(line.text,line.highlights)}</p>`).join('');
 app.innerHTML=pageTop()+`<div class="question-card" role="region" aria-label="Raccordo tra le domande">${lines}</div><div class="bt-save-status" id="save-state" aria-live="polite"></div><div class="actions"><button type="button" class="btn" data-action="back">← Indietro</button><button type="button" class="btn primary" data-action="next">Avanti →</button></div></div>`;
 if(preserveScroll)window.scrollTo(0,y);else window.scrollTo(0,0);
}
function renderIntro(){
 document.body.dataset.surveyScreen='intro';
 const upgrade=upgradeNeeded?'<p class="demo-notice"><strong>Questionario aggiornato.</strong> Le risposte parziali salvate in una versione precedente non possono essere recuperate nel nuovo questionario. Se scegli di ricominciare, saranno sostituite. Le compilazioni già concluse rimangono invariate.</p>':'';
 const alreadyStarted=Object.keys(answers).some(k=>!k.startsWith('__'));
 const startLabel=upgradeNeeded?'Ricomincia con il nuovo questionario':alreadyStarted?'Riprendi il questionario':'Inizia il questionario';
 app.innerHTML=`<div class="single-flow"><div class="question-card intro-card bt-welcome">
  <h1>La tua opinione conta!</h1>
  <div class="intro-text">
   <p>Better Together nasce per creare occasioni di incontro, favorire nuove conoscenze e costruire relazioni. Per continuare a crescere e migliorare, abbiamo bisogno anche del <strong>tuo punto di vista</strong>.</p>
   <p>Con questo questionario vogliamo capire <strong>come hai vissuto la tua esperienza con Better Together</strong>, quali aspetti hai apprezzato, che cosa possiamo migliorare e quali attività ti piacerebbe trovare in futuro.</p>
   <p><strong>La tua opinione è importante anche se hai partecipato poche volte o non frequenti più i Ritrovi Urbani.</strong> Vogliamo conoscere le esperienze di tutti i soci, non soltanto di chi partecipa regolarmente.</p>
   <p>Compilare il questionario richiede circa <strong>10 minuti</strong>. Non ci sono risposte giuste o sbagliate: ti chiediamo soltanto di rispondere con sincerità. <strong>La partecipazione è libera e volontaria.</strong></p>
  </div>
  <section class="bt-privacy-summary" aria-labelledby="bt-privacy-title">
   <h2 id="bt-privacy-title">La tua privacy è importante</h2>
   <p><strong>Puoi rispondere con sincerità e tranquillità.</strong> Le tue risposte saranno trattate con la massima riservatezza e nel pieno rispetto della tua privacy.</p>
   <p><strong>Chi analizzerà i questionari non conoscerà la tua identità.</strong> Prima dell'analisi, i dati personali saranno separati dalle risposte e saranno adottate specifiche procedure per tutelare l'anonimato dei partecipanti.</p>
   <p>I risultati saranno presentati esclusivamente in forma aggregata, senza identificare i singoli soci.</p>
   <p class="bt-privacy-link"><a href="privacy.html" target="_blank" rel="noopener noreferrer">Leggi l'informativa sulla privacy <span aria-hidden="true">↗</span></a></p>
  </section>
  <p class="muted small bt-resume-text">Se interrompi la compilazione, potrai riprenderla riaprendo il tuo link personale, anche da un altro dispositivo.</p>
  ${upgrade}
 </div><div class="actions bt-intro-actions"><span></span><button type="button" class="btn primary" data-action="start">${startLabel} →</button></div></div>`;
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
  return `<div class="choice-wrap"><label class="choice ${checked?'selected':''}"><input type="radio" name="single-${q.id}" data-action="radio" value="${escapeHtml(o.code)}" ${checked?'checked':''}><span>${richText(o.label,o.highlights)}</span></label>${o.other&&checked?`<div class="write-in"><label for="other-input">${o.label.includes('facoltativamente')?'Se desideri, specifica':'Specifica'}</label><input id="other-input" data-action="other-text" type="text" maxlength="300" value="${escapeHtml(ans.t||'')}" autocomplete="off"></div>`:''}</div>`;
 };
 return `<div class="choice-list">${options.map(choice).join('')}</div>`;
}
function renderMulti(q,row=null){
 const ans=getAnswer(q,row)||{v:[],otherTexts:{}};
 const codes=Array.isArray(ans.v)?ans.v:[];
 const maxText=['B7','B9','B10'].includes(q.id)?'':q.max?`Seleziona al massimo ${q.max} risposte.`:'Seleziona tutte le risposte pertinenti.';
 const options=optionOrders[q.id];
 return `${maxText?`<p class="muted small" style="margin-bottom:16px">${maxText}</p>`:''}<div class="choice-list">${options.map(o=>{
   const checked=codes.includes(o.code);
   return `<div class="choice-wrap"><label class="choice ${checked?'selected':''}"><input type="checkbox" data-action="check" value="${escapeHtml(o.code)}" ${checked?'checked':''}><span>${q.id==='B9'?escapeHtml(o.label):richText(o.label,o.highlights)}</span></label>${o.other&&checked?`<div class="write-in"><label for="other-input">Specifica</label><input id="other-input" data-action="other-text" data-code="${o.code}" maxlength="300" value="${escapeHtml(ans.otherTexts?.[o.code]||'')}" autocomplete="off"></div>`:''}</div>`;
 }).join('')}</div>`;
}
function renderMatrixItem(q,row){
  const ans=answers[q.id]?.rows?.[row.id]||'';
  const normal=q.opts.filter(o=>/^[1-5]$/.test(o.code));
  const extras=q.opts.filter(o=>!normal.includes(o));
  const instructionByBattery={
    'A6-A7':'Per ogni figura indicata, seleziona una sola risposta.',
    'B1-B5':'Per ogni situazione descritta, seleziona una sola risposta.',
    'B9V':'Per ogni aspetto indicato, seleziona una sola risposta.',
    'B13':'Per ogni caratteristica indicata, seleziona una sola risposta.',
    'B8':'Seleziona una sola risposta per questa attività.',
    'B12':'Seleziona una risposta per questa sede.'
  };
  const instruction=instructionByBattery[q.id]||'Seleziona una sola risposta.';
  const prefix=`<h3 class="battery-item-label">${richText(row.label,['B8','B12'].includes(q.id)?[row.label]:row.highlights)}</h3><p class="muted small battery-instruction">${escapeHtml(instruction)}</p>`;
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
  if(step.section){renderRaccordo(step,preserveScroll);return;}
  const {q,row}=step;
  const y=window.scrollY;
  const content=q.type==='matrix' && !row
    ? `<div class="battery-group">${matrixRows(q).map(r=>`<div class="battery-group-row">${renderMatrixItem(q,r)}</div>`).join('')}</div>`
    :q.type==='matrix'?renderMatrixItem(q,row):q.type==='scale'?renderScale(q):q.type==='multi'?renderMulti(q,row):q.type==='postal'?renderPostal(q):q.type==='comment'?renderComment(q):renderSingle(q);
  app.innerHTML=pageTop()+`<div class="question-card" data-question="${escapeHtml(q.id)}" aria-labelledby="question-title">${titleAndHint(q,row)}${content}${alertMessage?`<div class="alert" role="alert">${escapeHtml(alertMessage)}</div>`:''}</div><div class="bt-save-status" id="save-state" aria-live="polite"></div><div class="actions"><button type="button" class="btn" data-action="back">← Indietro</button><button type="button" class="btn primary" data-action="next">${steps().at(-1)?.key===currentKey?'Termina':'Avanti'} →</button></div></div>`;
  if(preserveScroll)window.scrollTo(0,y);else window.scrollTo(0,0);
}
function validate(step){
  if(step.section)return '';
  const {q,row}=step;
  const ans=getAnswer(q,row);
  if(!ans)return 'Seleziona una risposta per proseguire.';
  if(q.type==='matrix'){
    const shownRows=row?[row]:matrixRows(q);
    for(const required of shownRows)
      if(!ans.rows?.[required.id])return `Seleziona una risposta per ${required.label} prima di proseguire.`;
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
// Aggiorna le dipendenze quando una risposta precedente cambia.
function clearInactiveDependents(){
  for(const id of ['P3','D5','G3']){
    if(!active(QUESTION_MAP[id]))delete answers[id];
  }
}
function updateChoice(code){
 const q=getStep().q;
 const previous=answers[q.id]?.v;
 answers[q.id]={...(answers[q.id]||{}),v:code};
 if(q.type==='postal'&&code!=='O01')delete answers[q.id].t;
 if(q.type==='comment'&&code!=='O01')delete answers[q.id].t;
 // A2b valuta un canale specifico: cambiando A2a la valutazione va ripetuta.
 if(q.id==='A2a'&&previous!==code)delete answers.A2b;
 if(['P1','P2','G2'].includes(q.id))clearInactiveDependents();
 alertMessage='';scheduleSave();renderQuestion(true);
}
function updateMulti(code,checked){
 const q=getStep().q;
 const step=getStep(), venue=step.row?.venueCode;
 const current=q.id==='B11'?(answers.B11?.byVenue?.[venue]||{v:[],otherTexts:{}}):(answers[q.id]||{v:[],otherTexts:{}});
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
 if(q.id==='B11'){
   answers.B11??={byVenue:{}}; answers.B11.byVenue??={};
   answers.B11.byVenue[venue]={v:values,otherTexts:current.otherTexts||{}};
 }else{
   answers[q.id]={v:values,otherTexts:current.otherTexts||{}};
   if(q.id==='B7'){
     // Le risposte su attivita' non piu' selezionate non devono ricomparire.
     const selected=new Set(values.filter(c=>/^F\d+$/.test(c)));
     if(answers.B8?.rows)for(const rowId of Object.keys(answers.B8.rows)){
       if(!selected.has(rowId.replace('B8_','')))delete answers.B8.rows[rowId];
     }
     if(answers.B8?.rows && !Object.keys(answers.B8.rows).length)delete answers.B8;
   }
   if(q.id==='B10'){
     const selected=new Set(chosenVenues());
     if(answers.B12?.rows)for(const v of Object.keys(answers.B12.rows))if(!selected.has(v.replace('B12_','')))delete answers.B12.rows[v];
     if(answers.B11?.byVenue)for(const v of Object.keys(answers.B11.byVenue))if(!selected.has(v))delete answers.B11.byVenue[v];
     if(answers.B12?.rows && !Object.keys(answers.B12.rows).length)delete answers.B12;
     if(answers.B11?.byVenue && !Object.keys(answers.B11.byVenue).length)delete answers.B11;
   }
 }
 alertMessage='';scheduleSave();renderQuestion(true);
}
function updateMatrix(rowid,code){
 const q=getStep().q;
 answers[q.id]={rows:{...(answers[q.id]?.rows||{}),[rowid]:code}};
 if(q.id==='B1-B5'&&rowid==='B1'&&!['2','3','4'].includes(code))delete answers[q.id].rows.B2;
 alertMessage='';scheduleSave();renderQuestion(true);
}
async function next(){
 if(navigating||upgradeNeeded)return;
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
   const result=await api({token:invitation,action:'complete',answers:payloadAnswers(),current_step:i});
   if(result.status==='already_completed'||result.status==='completed'){screen='done';renderDone();}
   else throw new Error('Risposta inattesa dal server');
  }else{
   const nextKey=list[i+1].key;
   currentKey=nextKey;
   screen='question';renderQuestion();
   await flushSave();
  }
 }catch(err){
  if(screen!=='done'){
   alertMessage='Non è stato possibile salvare le risposte sul server. Controlla la connessione e riprova: il questionario non risulta inviato.';
   renderQuestion(true);setSaveStatus('Errore di salvataggio');
  }
 }finally{navigating=false;}
}
async function back(){
 if(navigating||upgradeNeeded)return;
 const list=steps();const i=list.findIndex(s=>s.key===currentKey);
 if(i>0){currentKey=list[i-1].key;alertMessage='';renderQuestion();scheduleSave();}
 else{screen='intro';renderIntro();window.scrollTo(0,0);scheduleSave();}
}
function columnNames(){
 const cols=['id_rispondente'];
 for(const q of QUESTIONS){
   if(q.id==='B11')cols.push(...QUESTION_MAP.B10.opts.filter(o=>/^F(?:[1-9]|10)$/.test(o.code)).map(o=>'B11_'+o.code));
   else if(q.type==='matrix')cols.push(...q.rows.map(r=>r.id));
   else if(q.type==='comment')cols.push(q.id,q.id+'_testo');
   else if(q.type==='postal')cols.push(q.id,q.id+'_cap');
   else if(q.type==='multi')cols.push(q.id,q.id+'_altro');
   else if(q.opts?.some(o=>o.other))cols.push(q.id,q.id+'_altro');
   else cols.push(q.id);
 }
 return cols;
}
function valueRows(){
 const result={id_rispondente:invitation};
 for(const q of QUESTIONS){
   const shown=active(q),a=shown?answers[q.id]:null;
   if(q.id==='B11'){
     const selected=new Set(chosenVenues());
     for(const v of QUESTION_MAP.B10.opts.filter(o=>/^F(?:[1-9]|10)$/.test(o.code))){
      const selectedAnswers=a?.byVenue?.[v.code]?.v||[];
      result['B11_'+v.code]=selected.has(v.code)?q.opts.filter(o=>selectedAnswers.includes(o.code)).map(o=>o.code).join(';'):'FILTERED';
     }
   }else if(q.type==='matrix'){
    const eligibleRows=shown?new Set(matrixRows(q).map(row=>row.id)):new Set();
    for(const row of q.rows){
     result[row.id]=eligibleRows.has(row.id)?(a?.rows?.[row.id]||''):'FILTERED';
    }
   }else if(q.type==='comment'){
    result[q.id]=shown?(a?.v||''):'FILTERED';result[q.id+'_testo']=shown?(a?.t||''):'';
   }else if(q.type==='postal'){
    result[q.id]=shown?(a?.v||''):'FILTERED';result[q.id+'_cap']=shown?(a?.t||''):'';
   }else if(q.type==='multi'){
    result[q.id]=shown?(Array.isArray(a?.v)?q.opts.filter(o=>a.v.includes(o.code)).map(o=>o.code).join(';'):''):'FILTERED';
    result[q.id+'_altro']=shown?q.opts.filter(o=>o.other && a?.v?.includes(o.code)).map(o=>a.otherTexts?.[o.code]||'').filter(Boolean).join('; '):'';
   }else if(q.opts?.some(o=>o.other)){
    result[q.id]=shown?(a?.v||''):'FILTERED';result[q.id+'_altro']=shown?(a?.t||''):'';
   }else result[q.id]=shown?(a?.v||''):'FILTERED';
 }
 return result;
}
function renderDone(){
 document.body.dataset.surveyScreen='done';
 app.innerHTML='<div class="single-flow"><div class="question-card intro-card"><div class="finish-icon">✓</div><h1>Questionario completato</h1><p class="lead">Grazie per il tempo che ci hai dedicato. Le tue risposte sono state registrate.</p><p>Il questionario risulta già completato e non può essere compilato una seconda volta tramite questo link personale.</p></div></div>';
 window.scrollTo(0,0);
}
app.addEventListener('click',e=>{
 const target=e.target.closest('[data-action]');if(!target)return;
 const action=target.dataset.action;
 if(action==='start'){
  if(upgradeNeeded){answers={};upgradeNeeded=false;currentKey=steps()[0].key;}
  if(!steps().some(s=>s.key===currentKey))currentKey=steps()[0].key;
  screen='question';renderQuestion();scheduleSave(0);
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
 const step=getStep();if(!step||step.section)return;
 const q=step.q;
 if(target.dataset.action==='other-text'){
  if(q.type==='multi'){
   if(q.id==='B11'){
    const venue=step.row?.venueCode;
    answers.B11??={byVenue:{}};answers.B11.byVenue??={};
    answers.B11.byVenue[venue]??={v:[],otherTexts:{}};
    answers.B11.byVenue[venue].otherTexts[target.dataset.code]=target.value;
   }else{
    answers[q.id]??={v:[],otherTexts:{}};
    answers[q.id].otherTexts??={};answers[q.id].otherTexts[target.dataset.code]=target.value;
   }
  }else{answers[q.id]??={};answers[q.id].t=target.value;}
 }else if(['postal-input','comment-text'].includes(target.dataset.action)){
  answers[q.id]??={};answers[q.id].t=target.value;
 }else return;
 scheduleSave(450);
});
// Salvataggio non bloccante se si chiude la scheda, senza completare la compilazione.
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden'&&screen==='question'&&!upgradeNeeded&&VALID_TOKEN.test(invitation)&&saveTimer){
  clearTimeout(saveTimer);saveTimer=null;
  fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:invitation,action:'save',answers:payloadAnswers(),current_step:stepIndex()}),keepalive:true,cache:'no-store'}).catch(()=>{});
 }
});
if(!invitation)renderMissingLink();else loadRemote();
