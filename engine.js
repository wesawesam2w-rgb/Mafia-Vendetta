// محرك القوانين: بيانات الأدوار، التوزيع، شروط الفوز
const crypto=require('crypto');
const R={bystander:['المواطن العادي','Bystander','civ'],detective:['المحقق','Detective','civ'],priest:['الكاهن','Priest','civ'],jailer:['السجان','Jailer','civ'],judge:['القاضي','Judge','civ'],sheriff:['الشريف','Sheriff','civ'],nurse:['الممرضة','Nurse','civ'],bodyguard:['الحارس الشخصي','Bodyguard','civ'],vixen:['فيكسن','Vixen','civ'],hypnotist:['المنوّم','Hypnotist','civ'],journalist:['الصحفي','Journalist','civ'],impostor:['المحتال','Impostor','civ'],thug:['فرد المافيا','Thug','maf'],thief:['اللص','Thief','maf'],godfather:['العرّاب','Godfather','maf'],lawyer:['المحامي','Lawyer','maf'],snitch:['الواشي','Snitch','maf'],yakuza:['الياكوزا','Yakuza','yak'],femme:['المرأة الفاتنة','Femme Fatale','loner'],psycho:['السايكو','Psycho','loner']};
const ACT={detective:['kill','inv'],priest:['kill','inv'],jailer:['inv'],judge:['inv'],sheriff:['kill'],nurse:['prot'],bodyguard:['prot'],vixen:['seduce'],hypnotist:['hyp'],journalist:['res'],thief:['block'],godfather:['silence'],lawyer:['inv'],snitch:['slander'],femme:['kill'],psycho:['kill']};
// ترتيب الليل: بطاقة Night Sequence لم تكن مقروءة، فهذا ترتيب مفترض قابل للتعديل هنا
const ORDER=['thief','vixen','snitch','godfather','hypnotist','nurse','bodyguard','jailer','priest','detective','judge','lawyer','journalist','sheriff','femme','psycho','mafia','yakuza'];
const SETUP={6:[4,0,1,1,0],7:[4,0,1,2,0],8:[4,1,1,2,0],9:[5,1,1,2,0],10:[4,2,1,2,1],11:[6,1,1,2,1],12:[6,2,1,2,1]};
const shuf=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const pick=(a,n)=>shuf(a).slice(0,n);
function compose(n,c){const[b,s,l,t,m]=SETUP[n];
 let x=[...pick(['detective','priest','jailer','judge','sheriff'],l),...pick(['nurse','bodyguard','vixen','hypnotist','journalist'],s),...pick(['thief','godfather','lawyer','snitch'],m),...Array(t).fill('thug'),...Array(b).fill('bystander')];
 const rep=r=>{const i=x.indexOf('bystander');if(i>=0)x[i]=r};
 if(c.yakuza&&n>=12){const i=x.findIndex(r=>R[r][2]==='maf'&&r!=='thug');if(i>=0)x.splice(i,1);rep('yakuza');x.push('yakuza')}
 if(c.loner&&n>=10)rep(pick(['femme','psycho'],1)[0]);
 if(c.impostor)rep('impostor');
 return shuf(x)}
function check(ps){const a=ps.filter(p=>p.alive),c=t=>a.filter(p=>R[p.role][2]===t).length,civ=c('civ'),maf=c('maf'),yak=c('yak'),lon=c('loner');
 if(lon&&!civ&&!maf&&!yak)return'loner';
 if(!maf&&!yak)return'civ';
 if(a.length===2&&maf===1&&yak===1)return'none';
 if(!yak&&civ<=maf)return lon?'loner':'maf';
 if(!maf&&civ<=yak)return'yak';
 return null}
module.exports={R,ACT,ORDER,SETUP,compose,check};
