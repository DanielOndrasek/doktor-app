const fs=require('fs'); const blk=fs.readFileSync('v22_block.js','utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function mk(){
  const calls=[]; const docs=new Map(); const notices=new Map(); let handler=null;
  const state={ items:new Map(), db:{ doc:(p)=>({ get:async()=>({exists:docs.has(p), data:()=>({...docs.get(p)})}), update:async(d)=>{ docs.set(p,{...(docs.get(p)||{}),...d}); const id=p.split('/')[1]; if(state.items.has(id)) state.items.set(id,{...state.items.get(id),...d}); } }) } };
  const env={ state, calls, docs, notices,
    okOf:p=>!(p&&typeof p==='object'&&p.ok===false), failOf:p=>(p&&(p.duvod||p.chyba))||'server odmítl',
    esc:x=>String(x??''), errText:e=>e&&e.message||String(e), GMAIL_LABELS:{vyrizeno:'Label_14',cekam:'Label_12'},
    bezDia:t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),
    notice:(k,h,id)=>{ if(!h) notices.delete(id); else notices.set(id,h); }, flash:(k,h,id)=>{ notices.set(id||'flash',h); },
    document:{ addEventListener:(t,f)=>{handler=f;} }, console,
    setStav: async (it,stav,extra)=>{ await state.db.doc('polozky/'+it.id).update({stav,zmeneno:new Date().toISOString(),...(extra||{})}); },
  };
  env.tool=async()=>({ok:true});
  env.call=async(it,tool,input)=>{ calls.push([tool,input]); return env.tool(tool,input); };
  env.callBox=async(b,tool,input)=>{ calls.push([tool,input]); return env.tool(tool,input); };
  const f=new Function(...Object.keys(env), blk+'\n return {vratPolozku,naplanujUklid,zpracujCekajiciUklid,provedUklid,najdiUvnRef};');
  const api=f(...Object.values(env)); env.api=api; env.click=(id)=>handler({target:{closest:()=>({dataset:{undo:id}, disabled:false})}}); return env;
}
function put(e,it){ e.state.items.set(it.id,it); e.docs.set('polozky/'+it.id,{...it}); }
let fail=0; const ok=(c,m)=>{ if(!c){fail++; console.log('FAIL',m);} else console.log('ok  ',m); };
(async()=>{
  // 1) ✓ a hned Vrátit zpět: žádné volání schránky
  let e=mk(); let it={id:'uvn_1',schranka:'uvn',uvn_ref:'INBOX:10',uvn_message_id:'a@b',stav:'vyrizeno',presun_ceka:true,predmet:'Test',zmeneno:new Date().toISOString()}; put(e,it);
  e.api.naplanujUklid(it); ok(e.notices.has('undo-uvn_1'),'lišta Vrátit zpět je vidět');
  await e.api.vratPolozku(e.state.items.get('uvn_1')); await sleep(80);
  ok(e.calls.length===0,'vrácení během odpočtu nevolá schránku'); ok(e.docs.get('polozky/uvn_1').stav==='nove' && e.docs.get('polozky/uvn_1').presun_ceka===false,'stav zpět na nove');
  // 2) ✓ a nechat doběhnout: přesun + novy_ref ze serveru
  e=mk(); it={id:'uvn_2',schranka:'uvn',uvn_ref:'INBOX:11',uvn_message_id:'c@d',stav:'vyrizeno',presun_ceka:true,predmet:'P',zmeneno:new Date().toISOString()}; put(e,it);
  e.tool=async(t,i)=> t==='mail_move'?{ok:true,novy_ref:'_Triage/Vyřízeno:7'}:{ok:true};
  e.api.naplanujUklid(it); await sleep(120);
  let d=e.docs.get('polozky/uvn_2'); ok(e.calls.some(c=>c[0]==='mail_move'&&c[1].slozka==='_Triage/Vyřízeno'),'po odpočtu proběhl přesun'); ok(d.presun_ceka===false&&d.uvn_ref==='_Triage/Vyřízeno:7'&&d.uvn_presunuto==='_Triage/Vyřízeno','uložen novy_ref'); ok(!e.notices.has('undo-uvn_2'),'lišta zmizela');
  // 3) návrat z archivu dnes (server bez novy_ref): mail_najdi selže -> index -> přesun -> mail_najdi najde v INBOX
  e=mk(); it={id:'uvn_3',schranka:'uvn',uvn_ref:'INBOX:95065',uvn_message_id:'x@y',stav:'vyrizeno',od_email:'k@s.cz',datum:'2026-09-09T07:58:00+02:00',predmet:'Prosba o  konzultaci – Dejlová'}; put(e,it);
  let moved=false;
  e.tool=async(t,i)=>{ if(t==='mail_najdi') return moved?{ok:true,ref:'INBOX:95400'}:{ok:false,duvod:'nenalezena'};
    if(t==='mail_search') return {pocet:2,vysledky:[{ref:'_Triage/Vyřízeno:2',datum:'2026-09-09T07:58',predmet:'prosba o konzultaci – dejlová'},{ref:'INBOX:1',datum:'2026-09-10T10:00',predmet:'jiné'}]};
    if(t==='mail_move'){ moved=true; return {ok:true}; } return {ok:true}; };
  let out=await e.api.vratPolozku(it); d=e.docs.get('polozky/uvn_3');
  ok(e.calls.some(c=>c[0]==='mail_move'&&c[1].ref==='_Triage/Vyřízeno:2'&&c[1].slozka==='INBOX'),'přesun zpět z dohledaného refu'); ok(d.stav==='nove'&&d.uvn_ref==='INBOX:95400','uvn_ref obnoven'); ok(!out.varovani,'bez varování');
  // 4) zpráva se nedá dohledat -> stav se vrátí, varování, žádný přesun
  e=mk(); it={id:'uvn_4',schranka:'uvn',uvn_ref:'INBOX:5',uvn_message_id:'q@w',stav:'vyrizeno',od_email:'a@a.cz',datum:'2026-09-09T07:58:00+02:00',predmet:'X'}; put(e,it);
  e.tool=async(t)=> t==='mail_najdi'?{ok:false,duvod:'n'}:(t==='mail_search'?{pocet:0,vysledky:[]}:{ok:true});
  out=await e.api.vratPolozku(it); ok(out.varovani&&!e.calls.some(c=>c[0]==='mail_move')&&e.docs.get('polozky/uvn_4').stav==='nove','nedohledáno: varování, bez přesunu');
  // 5) Gmail návrat
  e=mk(); it={id:'gmail_1',schranka:'gmail',gmail_thread_id:'T1',stav:'vyrizeno'}; put(e,it);
  await e.api.vratPolozku(it); ok(JSON.stringify(e.calls)===JSON.stringify([['label_thread',{threadId:'T1',labelIds:['INBOX']}],['unlabel_thread',{threadId:'T1',labelIds:['Label_14']}]]),'Gmail: INBOX zpět, Vyřízeno pryč');
  // 6) selhání přesunu -> příznak zpět, chyba se propíše
  e=mk(); it={id:'uvn_6',schranka:'uvn',uvn_ref:'INBOX:6',stav:'vyrizeno',presun_ceka:true,predmet:'Z',zmeneno:new Date().toISOString()}; put(e,it);
  e.tool=async(t)=> t==='mail_move'?{ok:false,duvod:'zpráva nenalezena'}:{ok:true};
  let err=null; try{ await e.api.provedUklid(it);}catch(x){err=x;} d=e.docs.get('polozky/uvn_6'); ok(err&&d.presun_ceka===true&&d.presun_pokusy===1,'selhání: příznak zůstal, pokus započten');
  // 7) dodatečný úklid po načtení + pojistka proti dvojímu úklidu a strop pokusů
  e=mk(); put(e,{id:'uvn_7',schranka:'uvn',uvn_ref:'INBOX:7',stav:'vyrizeno',presun_ceka:true,zmeneno:new Date(Date.now()-5000).toISOString()});
  put(e,{id:'uvn_8',schranka:'uvn',uvn_ref:'INBOX:8',stav:'vyrizeno',presun_ceka:true,presun_pokusy:3,zmeneno:new Date(Date.now()-5000).toISOString()});
  put(e,{id:'uvn_9',schranka:'uvn',uvn_ref:'INBOX:9',stav:'nove',presun_ceka:false});
  e.api.zpracujCekajiciUklid(); e.api.zpracujCekajiciUklid(); await sleep(60);
  ok(e.calls.filter(c=>c[0]==='mail_move').length===1&&e.calls[0][1].ref==='INBOX:7','dodatečný úklid jen jednou a jen u čekající položky');
  // 8) kliknutí na lištu
  e=mk(); it={id:'uvn_10',schranka:'uvn',uvn_ref:'INBOX:12',stav:'vyrizeno',presun_ceka:true,predmet:'K',zmeneno:new Date().toISOString()}; put(e,it);
  e.api.naplanujUklid(it); e.click('uvn_10'); await sleep(100);
  ok(e.calls.length===0&&e.docs.get('polozky/uvn_10').stav==='nove'&&e.notices.has('vraceno'),'klik na Vrátit zpět');
  console.log(fail?('SELHALO '+fail):'VŠE PROŠLO'); process.exit(fail?1:0);
})();
