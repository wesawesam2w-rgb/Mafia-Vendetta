// الخادم: هو المدير الإلكتروني وصاحب الحالة. العميل لا يستلم إلا ما يحق له رؤيته.
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const {R,ACT,ORDER,compose,check}=require('./engine');
const PW=+process.env.POINTS_WIN||10,PL=+process.env.POINTS_LOSS||0;
const DB=path.join(process.env.DATA_DIR||__dirname,'stats.json');
let stats={};try{stats=JSON.parse(fs.readFileSync(DB))}catch{}
const save=()=>{try{fs.writeFileSync(DB,JSON.stringify(stats))}catch{}};
const rooms=new Map(),html=fs.readFileSync(path.join(__dirname,'public','index.html'));
const srv=http.createServer((q,s)=>{s.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});s.end(html)});
const wss=new WebSocketServer({server:srv});
const byId=(r,i)=>r.players.find(p=>p.id===i),maf=p=>R[p.role][2]==='maf'||p.role==='impostor';
const opts=(p,r)=>(ACT[p.role]||[]).filter(a=>!(a==='kill'&&r.nightNo===1));
const mkcode=()=>{let c;do{c=Array.from({length:5},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join('')}while(rooms.has(c));return c};
const arm=(r,ms,fn)=>{clearTimeout(r.tm);r.dl=Date.now()+ms;r.tm=setTimeout(()=>{fn();bc(r)},ms)};
const err=(ws,m)=>ws.send(JSON.stringify({t:'err',m}));
const alive=r=>r.players.filter(p=>p.alive);
function deal(r){const roles=compose(r.players.length,r.cfg);r.players.forEach((p,i)=>{Object.assign(p,{role:roles[i],alive:true,jailed:false,jp:false,sil:false,hypBy:null,ack:false,notes:[]})});
 r.phase='reveal';r.nightNo=0;r.log=['وُزّعت الأدوار سرّاً'];r.win=null;r.step=null;arm(r,90000,()=>startNight(r))}
function startNight(r){r.phase='night';r.nightNo++;r.n={q:ORDER.filter(s=>r.players.some(p=>s==='mafia'?maf(p):p.role===s)),i:0,kills:[],blocked:new Set(),slander:new Set()};
 r.players.forEach(p=>{p.sil=false;p.hypBy=null});r.log.push('— الليلة '+r.nightNo+' — الجميع يغلق عينيه');stepNext(r)}
function stepNext(r){const n=r.n;r.calling=null;
 while(n.i<n.q.length){const s=n.q[n.i++];
  if(s==='mafia'||s==='yakuza'){const g=r.players.filter(p=>p.alive&&!p.jailed&&(s==='yakuza'?p.role==='yakuza':maf(p)));if(!g.length)continue;
   const first=r.nightNo===1;r.calling=s;r.step={k:s,who:g.map(p=>p.id),votes:{},first,grp:g.map(p=>p.name)};return arm(r,first?8000:35000,()=>endStep(r))}
  const p=r.players.find(x=>x.role===s);if(!p)continue;
  if(!p.alive){if(r.cfg.mystery){r.calling=s;r.step={k:s,who:[]};return arm(r,3000+Math.random()*4000,()=>stepNext(r))}continue}
  const why=p.jailed?'jail':n.blocked.has(p.id)?'block':!opts(p,r).length?'n1':null;
  r.calling=s;r.step={k:s,who:[p.id],why};return arm(r,why?4000:30000,()=>stepNext(r))}
 dawn(r)}
function endStep(r){const s=r.step;
 if(s&&(s.k==='mafia'||s.k==='yakuza')&&!s.first){const c={};Object.values(s.votes).forEach(t=>{if(t)c[t]=(c[t]||0)+1});
  const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
  if(top&&top[1]>s.who.length/2){const t=byId(r,top[0]),ms=r.players.filter(p=>p.alive&&R[p.role][2]==='maf');
   const only=s.k==='mafia'&&ms.length===1&&ms[0].id===r.n.seduced;if(t&&!only)r.n.kills.push({t,r:s.k})}}
 stepNext(r)}
function act(r,p,d){const s=r.step;if(!s||!s.who.includes(p.id)||s.why||s.done)return;
 if(s.k==='mafia'||s.k==='yakuza'){if(s.first)return;const t=byId(r,(d.tg||[])[0]);
  if(d.pass)s.votes[p.id]=0;else{if(!t||!t.alive||t.id===p.id)return;s.votes[p.id]=t.id}
  if(Object.keys(s.votes).length>=s.who.length)endStep(r);return}
 if(d.pass){s.done=1;return stepNext(r)}
 if(!opts(p,r).includes(d.a))return;
 const tg=(d.tg||[]).map(i=>byId(r,i)),need=d.a==='res'?2:1;
 if(tg.length!==need||tg.some(t=>!t||!t.alive||t.id===p.id)||new Set(tg).size!==need)return;
 s.done=1;apply(r,p,d.a,tg);stepNext(r)}
function apply(r,p,a,[t,u]){const n=r.n,note=x=>p.notes.push('ليلة '+r.nightNo+': '+x);
 if(a==='kill')n.kills.push({t,r:p.role});
 if(a==='inv'){const ro=n.slander.has(t.id)?'thug':t.role;note(`${t.name} ← ${R[ro][0]}`);
  if(p.role==='priest')t.notes.push('ليلة '+r.nightNo+': الكاهن هو '+p.name);
  if(p.role==='jailer'&&['maf','yak'].includes(R[t.role][2]))t.jailed=true}
 if(a==='block')n.blocked.add(t.id);
 if(a==='seduce'){n.blocked.add(t.id);n.seduced=t.id}
 if(a==='hyp')n.hyp={by:p.id,tg:t.id};
 if(a==='silence')n.silence=t.id;
 if(a==='slander')n.slander.add(t.id);
 if(a==='prot'){if(p.role==='nurse')n.nurse=t.id;else n.bg=t.id}
 if(a==='res'){const x=R[t.role][2],y=R[u.role][2];note(`${t.name} و${u.name}: ${x===y&&x!=='loner'?'نفس الفريق':'فريقان مختلفان'}`)}}
function dawn(r){r.phase='dawn';r.step=null;r.calling=null;const n=r.n,dead=new Map();
 if(r.nightNo>1)for(const k of n.kills){const t=k.t;
  if(n.seduced===t.id||(k.r==='femme'&&t.role==='bystander')||n.nurse===t.id)continue;
  if(n.bg===t.id){const b=r.players.find(x=>x.role==='bodyguard'&&x.alive);if(b){if(!dead.has(b.id))dead.set(b.id,k.r);continue}}
  if(!dead.has(t.id))dead.set(t.id,k.r)}
 r.log.push('— الفجر —');
 for(const [id,by] of dead){kill(r,byId(r,id));const p=byId(r,id);r.log.push(`قُتل ${p.name}`+(r.cfg.mystery?'':` — كان ${R[p.role][0]}`)+(p.role==='impostor'&&by==='mafia'?' (قتلته المافيا)':''))}
 if(!dead.size)r.log.push('لم يُقتل أحد هذه الليلة');
 const sl=n.silence&&byId(r,n.silence);if(sl&&sl.alive){sl.sil=true;r.log.push(`العرّاب أسكت ${sl.name}: لن يصوّت اليوم`)}
 r.players.forEach(p=>{p.jp=p.alive&&p.jailed});const j=r.players.filter(p=>p.jp).map(p=>p.name);if(j.length)r.log.push('في السجن: '+j.join('، '));
 if(n.hyp){const h=byId(r,n.hyp.tg);if(h&&h.alive){h.hypBy=n.hyp.by;h.notes.push('أنت منوَّم: صوتك اليوم يتبع المنوّم')}}
 r.log.push('الأحياء: '+alive(r).length);
 const w=check(r.players);if(w)return over(r,w);arm(r,6000,()=>startDay(r))}
function kill(r,p){p.alive=false;if(p.role==='jailer')r.players.forEach(x=>{x.jailed=false;x.jp=false})}
function startDay(r){r.phase='day';r.sus=[];r.rdy=new Set();arm(r,r.cfg.discuss*1000,()=>startVote(r))}
function startVote(r){if(r.sus.length<2){r.log.push('لم يُرشَّح مشتبهان على الأقل: لا تصويت اليوم');return afterDay(r)}
 r.phase='vote';r.vq=[...r.sus];r.vi=-1;r.res={};nextVote(r)}
function nextVote(r){r.vi++;if(r.vi>=r.vq.length)return tally(r);r.cur=r.vq[r.vi];r.votes={};arm(r,20000,()=>closeVote(r))}
const voter=p=>p.alive&&!p.jailed&&!p.sil;
function closeVote(r){let tot=0;for(const p of r.players.filter(voter)){let a;
  if(p.hypBy){const h=byId(r,p.hypBy);a=h&&voter(h)&&r.votes[h.id]?1:0}else a=r.votes[p.id]?1:0;
  if(a)tot+=p.role==='judge'?2:1}
 r.res[r.cur]=tot;r.log.push(`${byId(r,r.cur).name}: ${tot} صوت`);nextVote(r)}
function tally(r){const e=Object.entries(r.res).sort((a,b)=>b[1]-a[1]);
 if(e.length>1&&e[0][1]===e[1][1])r.log.push('تعادل في الأصوات: لا إقصاء اليوم');
 else{const p=byId(r,e[0][0]);kill(r,p);r.log.push(`أُقصي ${p.name}`+(r.cfg.mystery?'':` — كان ${R[p.role][0]}`))}
 afterDay(r)}
function afterDay(r){r.cur=null;const w=check(r.players);if(w)return over(r,w);startNight(r)}
function over(r,w){clearTimeout(r.tm);r.phase='over';r.win=w;r.step=null;r.cur=null;
 r.log.push('انتهت اللعبة — الفائز: '+({civ:'المدنيون',maf:'المافيا',yak:'الياكوزا',loner:'الوحيد',none:'لا أحد'})[w]);
 for(const p of r.players){const s=stats[p.token]=stats[p.token]||{name:p.name,w:0,l:0,g:0,pts:0};s.name=p.name;s.g++;if(w===R[p.role][2]){s.w++;s.pts+=PW}else{s.l++;s.pts+=PL}}save()}
function view(r,p){const rev=q=>r.phase==='over'||(!q.alive&&!r.cfg.mystery),s=r.step,mine=s&&s.who.includes(p.id);
 const allies=r.nightNo&&p.role!=='bystander'&&(maf(p)||p.role==='yakuza')?r.players.filter(q=>p.role==='yakuza'?q.role==='yakuza':maf(q)).map(q=>q.name):[];
 return{t:'state',code:r.code,phase:r.phase,host:r.host===p.token,night:r.nightNo,cfg:r.cfg,left:Math.max(0,(r.dl||0)-Date.now()),win:r.win,
  players:r.players.map(q=>({id:q.id,name:q.name,av:q.av,alive:q.alive,conn:q.conn,sil:q.sil&&q.alive,jail:q.jp,me:q===p,host:q.token===r.host,role:rev(q)?q.role:null,ack:q.ack})),
  me:{role:r.phase==='lobby'?null:p.role,allies,notes:p.notes,canVote:voter(p)&&!p.hypBy,hyp:!!p.hypBy},
  calling:r.phase==='night'&&r.calling?(r.calling==='mafia'?'المافيا':r.calling==='yakuza'?'الياكوزا':R[r.calling][0]):null,
  step:mine?{k:s.k,why:s.why,first:s.first,grp:s.grp,opts:s.why||s.first?[]:(s.k==='mafia'||s.k==='yakuza')?['kill']:opts(p,r),voted:s.votes?s.votes[p.id]!==undefined:!!s.done}:null,
  sus:r.sus||[],cur:r.phase==='vote'?r.cur:null,voted:r.phase==='vote'&&r.votes?r.votes[p.id]!==undefined:false,
  log:r.log.slice(-25),chat:(r.chat||[]).slice(-30)}}
function bc(r){r.players.forEach(p=>p.ws&&p.ws.readyState===1&&p.ws.send(JSON.stringify(view(r,p))))}
function handle(ws,m){const tok=String(m.token||'').slice(0,60);
 if(m.t==='ping'){if(ws.p)ws.p.seen=Date.now();return ws.send('{"t":"pong"}')}
 if(m.t==='lb')return ws.send(JSON.stringify({t:'lb',rows:Object.values(stats).sort((a,b)=>b.pts-a.pts).slice(0,10)}));
 if(m.t==='create'||m.t==='join'){if(!tok)return;
  let r=m.t==='join'?rooms.get(String(m.code||'').toUpperCase()):null;
  if(m.t==='create'){r={code:mkcode(),host:tok,players:[],phase:'lobby',cfg:{discuss:120,mystery:false,loner:false,yakuza:false,impostor:false},log:[],chat:[],nightNo:0,sus:[],t0:Date.now()};rooms.set(r.code,r)}
  if(!r)return err(ws,'الغرفة غير موجودة');
  let p=r.players.find(x=>x.token===tok);
  if(!p){if(r.phase!=='lobby')return err(ws,'بدأت اللعبة بالفعل');if(r.players.length>=12)return err(ws,'الغرفة ممتلئة (12)');
   const nm=String(m.name||'').trim().slice(0,16);if(!nm)return err(ws,'اكتب اسمك');if(r.players.some(x=>x.name===nm))return err(ws,'الاسم مستخدم');
   p={id:crypto.randomBytes(3).toString('hex'),token:tok,name:nm,av:(+m.av||0)%12,alive:true,notes:[],r};r.players.push(p)}
  if(p.ws&&p.ws!==ws)try{p.ws.close()}catch{}
  p.ws=ws;ws.p=p;p.conn=true;p.seen=Date.now();return bc(r)}
 const p=ws.p;if(!p)return;const r=p.r;p.seen=Date.now();p.conn=true;
 switch(m.t){
 case'cfg':{if(r.host!==p.token||r.phase!=='lobby')return;const c=m.cfg||{};r.cfg={discuss:Math.min(600,Math.max(30,+c.discuss||120)),mystery:!!c.mystery,loner:!!c.loner,yakuza:!!c.yakuza,impostor:!!c.impostor};break}
 case'start':if(r.host!==p.token||r.phase!=='lobby')return;if(r.players.length<6)return err(ws,'الحد الأدنى 6 لاعبين');deal(r);break;
 case'ack':if(r.phase!=='reveal')return;p.ack=true;if(r.players.every(x=>x.ack))startNight(r);break;
 case'act':if(r.phase==='night')act(r,p,m);break;
 case'suspect':{const t=byId(r,m.id);if(r.phase==='day'&&p.alive&&t&&t.alive&&!r.sus.includes(t.id))r.sus.push(t.id);break}
 case'ready':if(r.phase==='day'&&p.alive){r.rdy.add(p.id);if(r.rdy.size*2>alive(r).length)startVote(r)}break;
 case'vote':if(r.phase==='vote'&&voter(p)&&!p.hypBy&&r.votes[p.id]===undefined){r.votes[p.id]=m.v?1:0;
  if(r.players.filter(x=>voter(x)&&!x.hypBy).every(x=>r.votes[x.id]!==undefined))closeVote(r)}break;
 case'chat':if((r.phase==='day'||r.phase==='vote')&&p.alive){r.chat.push({n:p.name,m:String(m.m||'').slice(0,200)})}break;
 case'again':if(r.host!==p.token||r.phase!=='over')return;r.phase='lobby';r.players.forEach(x=>Object.assign(x,{alive:true,role:null}));r.chat=[];break;
 case'leave':if(r.phase==='lobby'){r.players=r.players.filter(x=>x!==p);ws.p=null;if(!r.players.length)return rooms.delete(r.code);if(r.host===p.token)r.host=r.players[0].token}break;
 }bc(r)}
wss.on('connection',ws=>{ws.on('message',d=>{let m;try{m=JSON.parse(d)}catch{return}try{handle(ws,m)}catch(e){console.error(e)}});
 ws.on('close',()=>{const p=ws.p;if(p&&p.ws===ws){p.ws=null;p.conn=false;bc(p.r)}})});
setInterval(()=>{for(const [c,r] of rooms){let ch=false;for(const p of r.players){const on=!!p.ws&&Date.now()-p.seen<15000;if(on!==p.conn){p.conn=on;ch=true}}if(ch)bc(r);if(Date.now()-r.t0>864e5)rooms.delete(c)}},3000);
srv.listen(process.env.PORT||3000,()=>console.log('Mafia Vendetta on',process.env.PORT||3000));
