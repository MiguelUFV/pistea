// Pistea · la app (la carga index.html; el cálculo del día está en calc.js)
const $=s=>document.querySelector(s),fmt=n=>Math.round(n).toLocaleString('es-ES'),dec=(n,d=1)=>(+n||0).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});   // decimales con coma
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const IC={est:'<path d="M3 20l6-10 4 6 3-4 5 8z"/>',com:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5M16 5.2a3 3 0 010 5.6M18.5 14.8c1.7.7 2.5 2.2 2.5 4.2"/>',go:'<path d="M5 18l3-9 4 3 3-7M4 21h16"/>',datos:'<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',rec:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3"/>',yo:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',up:'<path d="M12 19V5M6 11l6-6 6 6"/>',heart:'<path d="M12 20s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.4-7 10-7 10z"/>',lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',flame:'<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',bolt:'<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',map:'<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',clock:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',cam:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',pin:'<path d="M12 21s-6-5.3-6-11a6 6 0 0112 0c0 5.7-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',block:'<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>',down:'<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',devices:'<rect x="3" y="5" width="13" height="10" rx="1.5"/><path d="M1.5 18h16M18 9h4v11h-4z"/>',back:'<path d="M15 5l-7 7 7 7"/>',check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',crown:'<path d="M4 19h16M5 16L3.5 7.5 8.5 11 12 5l3.5 6 5-3.5L19 16z"/>',play:'<path d="M8 5v14l11-7z"/>',club:'<path d="M12 3l7 3v5c0 4.5-3 7.8-7 10-4-2.2-7-5.5-7-10V6z"/>',ski:'<path d="M4 20.5L14.6 4.4c.6-.9 1.8-1.1 2.6-.4M9 21L19.6 4.9c.6-.9 1.8-1.1 2.6-.4"/>',snowboard:'<rect x="2.2" y="9.2" width="19.6" height="5.6" rx="2.8" transform="rotate(-32 12 12)"/><path d="M8.6 11.6l1.3 2M13.4 8.6l1.3 2"/>',ambos:'<path d="M3.5 19.5L12 6.3c.5-.8 1.4-.9 2-.4M7 20l8.5-13.2c.5-.8 1.4-.9 2-.4"/><rect x="11" y="13.6" width="11.4" height="4.4" rx="2.2" transform="rotate(-32 16.7 15.8)"/>'};
const ic=(n)=>`<svg class="i" viewBox="0 0 24 24">${IC[n]}</svg>`;
const S=[['alto-campoo','Alto Campoo','Cantábrica'],['astun','Astún','Pirineos'],['baqueira-beret','Baqueira Beret','Pirineos'],['boi-taull','Boí Taüll','Pirineos'],['candanchu','Candanchú','Pirineos'],['cerler','Cerler','Pirineos'],['espot','Espot','Pirineos'],['formigal','Formigal','Pirineos'],['fuentes-de-invierno','Fuentes de Invierno','Cantábrica'],['javalambre','Javalambre','Ibérica'],['la-covatilla','La Covatilla','Central'],['la-molina','La Molina','Pirineos'],['la-pinilla','La Pinilla','Central'],['leitariegos','Leitariegos','Cantábrica'],['manzaneda','Manzaneda','Galicia'],['masella','Masella','Pirineos'],['panticosa','Panticosa','Pirineos'],['port-aine','Port Ainé','Pirineos'],['port-del-comte','Port del Comte','Pirineos'],['san-isidro','San Isidro','Cantábrica'],['sierra-nevada','Sierra Nevada','Bética'],['valdelinares','Valdelinares','Ibérica'],['valdesqui','Valdesquí','Central'],['valdezcaray','Valdezcaray','Ibérica'],['valgrande-pajares','Valgrande-Pajares','Cantábrica'],['vall-de-nuria','Vall de Núria','Pirineos'],['vallter','Vallter','Pirineos']]
 .map((a,i)=>({id:a[0],n:a[1],z:a[2],x:(i*37%100)+'%',y:(i*61%100)+'%'})),SM=Object.fromEntries(S.map(s=>[s.id,s]));
const MET={desnivel:'Desnivel',km:'Kilómetros',freeride:'Freeride',horas:'Horas esquiando',bajadas:'Bajadas',dias:'Días',vmax:'Vel. máxima'};
const show=(m,v)=>m==='horas'?v.toFixed(0)+' h':m==='vmax'?v.toFixed(0)+' km/h':(m==='km'||m==='freeride')&&v>0&&v<1?fmt(Math.max(1,v*1000))+' m':m==='km'?fmt(v)+' km':m==='freeride'?dec(v)+' km':m==='desnivel'?fmt(v)+' m':fmt(v);
const ini=n=>esc(n.split(' ').map(w=>w[0]).slice(0,2).join(''));
const av=(n,a)=>`<span class="av" style="${a?`background-image:url(${esc(a)});background-size:cover;background-position:center;color:transparent;`:''}">${ini(n)}</span>`;
const ago=t=>{const h=(Date.now()-t)/36e5;return h<1?'Hace minutos':h<24?`Hace ${Math.floor(h)} h`:h<48?'Ayer':`Hace ${Math.floor(h/24)} días`};
let st={tab:'est',met:'desnivel',amb:'España',per:'temporada',flt:'Todas',scope:'Amigos',toast:0,user:null,me:null,loading:true,offline:false,stats:[],feed:[],rank:null,mode:'login',err:''};
// PP: el pasaporte de pistas (GET /api/passport); WT: el temporizador de las historias del Wrapped
let T,W=null,qt,rq=0,curSave=null,SI={},FC={},PP=null,WT=0;fetch('/img/fotos.json').then(r=>r.json()).then(j=>{FC=j}).catch(()=>{});st.sim=true;fetch('/img/estaciones.json?v=4').then(r=>r.json()).then(j=>{SI=j;if(st.me)render()}).catch(()=>{});
const LS=(k,v)=>{try{return v===undefined?localStorage.getItem(k):v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){return null}};
const feedQ=()=>'feed?scope='+(st.scope==='Amigos'?'amigos':'todos');
async function api(path,opt={}){
 const m=opt.method||(opt.body?'POST':'GET'),old=LS('pistea_t');let r;try{r=await fetch('/api/'+path,{method:m,credentials:'same-origin',headers:{'Content-Type':'application/json',...(m!=='GET'?{'X-Pistea':'1'}:{}),...(old?{Authorization:'Bearer '+old}:{})},body:opt.body?JSON.stringify(opt.body):undefined})}catch(e){throw Object.assign(new Error('Sin conexión con el servidor. Revisa tu internet.'),{offline:true})}
 if(old&&(r.ok||r.status===401))LS('pistea_t',null);
 const j=await r.json().catch(()=>({}));
 if(r.status===401&&st.me&&!opt.auth){LS('pistea_t',null);st.me=null;st.user=null;st.err='Tu sesión ha caducado. Entra de nuevo.';st.mode='login';render();throw new Error(j.error||'Sesión caducada')}
 if(!r.ok)throw Object.assign(new Error(j.error||'Error del servidor'),{status:r.status});return j}
const seg=(arr,cur,fn)=>`<div class="seg">${arr.map(a=>`<button class="${a===cur?'on':''}" data-c="${fn}|${a}">${a[0].toUpperCase()+a.slice(1)}</button>`).join('')}</div>`;
const pills=(arr,cur,fn)=>`<div class="pills">${arr.map(a=>`<button class="${a===cur?'on':''}" data-c="${fn}|${a}">${a}</button>`).join('')}</div>`;
// La mezcla de dificultades (verde, azul, roja, negra) en proporción: las pistas que lista la ficha, con el color de la
// fuente oficial de cada estación (gen_dificultad.js)
const difBar=d=>{if(!d)return '';const t=d.v+d.a+d.r+d.n;if(!t)return '';return `<span class="dif" title="Mezcla de pistas por color">${[['v','g'],['a','b'],['r','r'],['n','k']].map(([k,c])=>d[k]?`<i style="flex:${d[k]/t};background:var(--${c})"></i>`:'').join('')}</span>`};
const FV='2';   // versión de las fotos: súbela al cambiarlas (el navegador las guarda una hora)
const photo=id=>`url(/img/foto/${id}.webp?v=${FV}),url(/img/${id}.webp)`;   // si no hay foto, la imagen de satélite
const stCard=(s,fn='ficha')=>{const k=(st.stats[s.id]||{}).skiers||0,w=st.user&&(st.user.wish||[]).includes(s.id);return `<div class="st" style="background-image:${photo(s.id)}" data-c="${fn}|${s.id}" role="button" tabindex="0">${k?`<span class="live"><i class="dot on"></i>${k} ${k===1?'esquiador':'esquiadores'}</span>`:''}${w?`<span class="wish" title="En tu lista de esta temporada">${ic('star')}</span>`:''}<b>${s.n}</b><small>${s.z}</small>${difBar(SI[s.id]&&SI[s.id].dif)}</div>`};
const season=()=>{const d=new Date(),y=d.getFullYear()-(d.getMonth()<6?1:0);return `Temporada ${String(y).slice(2)}/${String(y+1).slice(2)}`};
const LVL={debutante:['Debutante','g'],intermedio:['Intermedio','b'],avanzado:['Avanzado','r'],experto:['Experto','k']};
const LVLD={debutante:'Bajo pistas verdes y voy cogiendo confianza.',intermedio:'Bajo azules con soltura y alguna roja.',avanzado:'Rojas a buen ritmo y negras con cuidado.',experto:'Negras, fuera de pista y lo que haga falta.'};
const MOD={ski:'Esquí',snowboard:'Snowboard',ambos:'Esquí y snowboard'};
const TER={pista:'Pistas pisadas',carving:'Carving',baches:'Baches',park:'Snowpark',freeride:'Fuera de pista',travesia:'Travesía'};
const chips=u=>`<div class="chips">${u.age?`<span class="chipTag on">${u.age} años</span>`:''}<span class="chipTag on"><i style="background:var(--${(LVL[u.level]||LVL.intermedio)[1]})"></i>${(LVL[u.level]||LVL.intermedio)[0]}</span><span class="chipTag on">${MOD[u.modality]||MOD.ski}</span>${(u.terrain||[]).map(k=>TER[k]?`<span class="chipTag">${TER[k]}</span>`:'').join('')}</div>`;
// El recorrido. Los días del motor nuevo traen [x, z, clase] en metros del mapa 3D: se dibujan encima de la miniatura de la
// estación, que cubre la caja de estaciones.json, cada tramo con el color de su pista (el freeride en ámbar, las subidas a
// trazos blancos). Los días antiguos, sin caja ni clases, se encajan en el recuadro como antes
const TC=['#fff','var(--g)','var(--b)','var(--r)','var(--k)','var(--fr)','#c7d3df'];
// fit: para la vista del día, el encuadre crece hasta que cabe todo el recorrido (un freeride lejos de las pistas se sale de la
// miniatura) y la miniatura va dentro, en su sitio; devuelve también la proporción del encuadre
const trkFit=(t,id)=>{const cj=SI[id].caja,m=80;let a=cj[0],b=cj[1],c=cj[2],e=cj[3];for(const p of t){a=Math.min(a,p[0]-m);b=Math.min(b,p[1]-m);c=Math.max(c,p[0]+m);e=Math.max(e,p[1]+m)}return [a,b,c,e]};
const trkMap=(t,id,fit)=>{const cj=id&&SI[id]&&SI[id].caja;if(!cj||!t||t.length<2||!Array.isArray(t[0])||t[0].length<3)return '';let out='',d='',cur=null;
 const put=()=>{if(!d)return;const up=!cur,sw=up?1.6:cur===6?2:3.2;out+=`${up||cur===6?'':`<path d="${d}" stroke="#fff" stroke-width="${sw+2.4}" opacity=".85"/>`}<path d="${d}" stroke="${TC[cur]}" stroke-width="${sw}"${up?' stroke-dasharray="4 4" opacity=".9"':''}/>`};
 for(let i=1;i<t.length;i++){const c=t[i][2];if(c!==cur){put();d=`M${t[i-1][0]} ${t[i-1][1]}`;cur=c}d+=`L${t[i][0]} ${t[i][1]}`}put();
 const v=fit?trkFit(t,id):cj,img=fit?`<image href="/img/${id}.webp" x="${cj[0]}" y="${cj[1]}" width="${cj[2]-cj[0]}" height="${cj[3]-cj[1]}" preserveAspectRatio="none"/><rect x="${v[0]}" y="${v[1]}" width="${v[2]-v[0]}" height="${v[3]-v[1]}" fill="rgba(9,30,52,.3)"/>`:'';
 return `<svg viewBox="${v[0]} ${v[1]} ${v[2]-v[0]} ${v[3]-v[1]}" preserveAspectRatio="xMidYMid ${fit?'meet':'slice'}" width="100%" height="100%" fill="none" stroke-linecap="round" stroke-linejoin="round">${img}${out.replace(/<path /g,'<path vector-effect="non-scaling-stroke" ')}</svg>`};
// El fondo de las tarjetas de un día: la miniatura, oscurecida si encima va el recorrido en color, aclarada si es uno antiguo
const mapBg=d=>{const c=trkMap(d.track,d.station)?'rgba(9,30,52,.25)':'rgba(243,247,251,.6)';return `linear-gradient(${c},${c}),url(/img/${d.station}.webp)`};
const trk=(t,w=300,h=120,id)=>{if(!t||t.length<2)return '';const m=trkMap(t,id);if(m)return m;const xs=t.map(p=>p[0]),ys=t.map(p=>p[1]),mx=Math.max(...xs)||1,my=Math.max(...ys)||1,d=t.map((p,i)=>(i?'L':'M')+(12+p[0]/mx*(w-24)).toFixed(1)+' '+(12+p[1]/my*(h-24)).toFixed(1)).join('');return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><path class="trk" d="${d}" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`};

// ---------- sesión ----------
function authView(){const m=st.mode,info=st.info?`<div style="color:var(--g);font-size:14px;font-weight:500;margin:12px 0 0">${esc(st.info)}</div>`:'';
 const T={login:['Bienvenido de nuevo','Entra para seguir tu temporada.'],reg:['Crea tu cuenta','Es gratis. Luego, en un par de minutos, montas tu ficha de esquiador.'],forgot:['Recupera tu contraseña','Te enviaremos un enlace al correo para crear una nueva.'],reset:['Nueva contraseña','Elige una contraseña de al menos 8 caracteres.']}[m];
 const f=(m==='reg'?'<label>Nombre público</label><input id="al" maxlength="24" autocomplete="nickname" required><small>Así te verán en los rankings. Lo puedes cambiar luego.</small><label>Edad (opcional)</label><input id="ag" type="number" min="14" max="120" placeholder="Ej: 24"><small style="color:var(--mu);display:block;margin-top:4px">Mínimo 14 años por ley (art. 7 LOPDGDD 3/2018).</small>':'')+(m!=='reset'?`<label>Correo electrónico</label><input id="em" type="email" autocomplete="${m==='reg'?'email':'username'}" maxlength="254" required value="${esc(st.em||LS('pistea_email')||'')}">`:'')+(m==='forgot'?'':`<label>${m==='reset'?'Nueva contraseña':'Contraseña'}${m==='login'?'':' (mín. 8 caracteres)'}</label><div style="position:relative"><input id="pw" type="password" autocomplete="${m==='login'?'current-password':'new-password'}" minlength="${m==='login'?1:8}" maxlength="128" required style="padding-right:76px"${m==='login'?'':' data-i="pwMeter|@v"'}><button type="button" class="link" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:13px" data-c="togglePw|@">Mostrar</button></div>${m==='login'?'':'<div class="pwm" id="pwm" aria-hidden="true"><i></i><i></i><i></i><i></i></div><small id="pwm-t" style="display:block;margin-top:6px">Usa una frase o mezcla palabras: no vale tu correo ni una muy común.</small>'}`)+(m==='reg'?'<label style="display:flex;align-items:flex-start;gap:10px;margin-top:16px;cursor:pointer;font-size:12px;color:var(--mu)"><input type="checkbox" id="terms" required style="width:auto;margin-top:2px"><span>Acepto las <a href="/condiciones" target="_blank" rel="noopener" style="color:var(--ac)">condiciones</a> y la <a href="/privacidad" target="_blank" rel="noopener" style="color:var(--ac)">política de privacidad</a>, y tengo al menos 14 años.</span></label>':'');
 const btn={login:'Entrar',reg:'Crear cuenta',forgot:'Enviar enlace',reset:'Guardar contraseña'}[m];
 const foot=m==='login'?'<button class="link" data-c="go|forgot">¿Olvidaste tu contraseña?</button><br><br>¿Eres nuevo? <button class="link" data-c="go|reg">Crear cuenta</button>':m==='reg'?'¿Ya tienes cuenta? <button class="link" data-c="go|login">Entrar</button>':'<button class="link" data-c="go|login">Volver a entrar</button>';
 return `<div class="auth"><header class="auth-hero"><div class="logo">${ic('est')} Pistea</div><p class="auth-claim">Cada bajada cuenta.</p><p class="auth-sub">Graba tus días de esquí, mira por dónde has bajado y compárate con toda España.</p></header><section class="auth-sheet" aria-label="${T[0]}"><h1>${T[0]}</h1><p class="mu" style="margin-top:6px">${T[1]}</p>${info}<form data-s="submitAuth|@e">${f}<input id="hp" name="web" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0"><div class="err" id="er">${esc(st.err)}</div><button class="btn" id="sb">${btn}</button></form><p class="foot">${foot}</p></section></div>`}
const go=m=>{st.mode=m;st.err='';st.info='';render()};
async function submitAuth(e){e.preventDefault();const m=st.mode,v=id=>$('#'+id)?$('#'+id).value:'',em=v('em'),al=v('al');$('#sb').disabled=true;
 try{
  if(m==='forgot'){await api('forgot',{body:{email:em}});st.mode='login';st.err='';st.info='Si ese correo tiene cuenta, te hemos enviado un enlace. Revisa también el spam.';render();return false}
  if(m==='reset'){await api('reset',{body:{token:st.resetToken,password:v('pw')}});st.resetToken=null;st.mode='login';st.err='';st.info='Contraseña cambiada. Ya puedes entrar con la nueva.';render();return false}
  const ageVal=$('#ag')&&$('#ag').value?parseInt($('#ag').value,10):undefined;
  await api(m==='reg'?'register':'login',{auth:true,body:{email:em,password:v('pw'),alias:al,age:ageVal,terms:!!($('#terms')&&$('#terms').checked),web:v('hp')}});LS('pistea_email',em.trim().toLowerCase());st.em='';st.err='';st.info='';await boot();if(m==='reg'&&st.verify)flash('Cuenta creada. Te hemos enviado un correo para confirmarla.')
 }catch(x){st.err=x.message;st.info='';st.em=em;render();if($('#al'))$('#al').value=al;if($('#pw'))$('#pw').focus()}return false}
async function logout(silent){if(!silent)await api('logout',{method:'POST',body:{}}).catch(()=>{});LS('pistea_t',null);st.user=null;st.me=null;st.mode='login';render()}
async function logoutAll(){if(!confirm('Se cerrará la sesión en todos tus dispositivos, también en este.'))return;try{await api('logout-all',{method:'POST',body:{}});logout(true);st.info='Has cerrado la sesión en todos los dispositivos.';render()}catch(e){flash(e.message)}}
function changePw(){ov(`<div class="top" style="padding-top:60px"><div class="eyebrow">Seguridad</div><h1>Cambiar contraseña</h1></div><form data-s="savePw|@e"><label>Contraseña actual</label><input id="cp-old" type="password" autocomplete="current-password" required maxlength="128"><label>Contraseña nueva (mín. 8 caracteres)</label><input id="cp-new" type="password" autocomplete="new-password" minlength="8" maxlength="128" required><div class="err" id="cp-er"></div><button class="btn" id="cp-sb">Guardar</button></form><small style="display:block;margin-top:12px">Se cerrará la sesión en tus otros dispositivos.</small>`)}
async function savePw(e){e.preventDefault();$('#cp-sb').disabled=true;try{await api('password',{body:{old:$('#cp-old').value,password:$('#cp-new').value}});ov0();flash('Contraseña cambiada.')}catch(x){$('#cp-er').textContent=x.message;$('#cp-sb').disabled=false}return false}
async function delAccount(){const pw=prompt('Se borrarán tu cuenta, fotos y todos tus días conforme al Derecho al Olvido (RGPD). Escribe tu contraseña para confirmar:');if(!pw)return;try{await api('me',{method:'DELETE',body:{password:pw}});logout(true)}catch(e){flash(e.message)}}
function flash(t){const d=document.createElement('div');d.className='toast';d.style.cssText='position:absolute;left:20px;right:20px;top:14px;z-index:20';d.textContent=t;$('#app').appendChild(d);setTimeout(()=>d.remove(),3500)}
async function boot(){st.loading=true;st.offline=false;try{await refresh();st.rec=recLoad();if(NAT&&st.rec&&st.rec.native)NAT.status().then(x=>{st.recRun=!!x.recording;render()}).catch(()=>{});st.err=''}catch(x){st.me=null;if(x.offline)st.offline=true;else if(!/sesión|Sesión/.test(x.message))st.err=x.message}st.loading=false;render();if(st.me&&!st.user.onboarded&&!$('.ov'))onb(0)}   // cuenta sin ficha: el alta guiada, una vez
async function refresh(){const m=await api('me',{auth:true});const[s,f,pp]=await Promise.all([api('stations'),api(feedQ()),api('passport').catch(()=>null)]);st.me=m;st.user=m.user;st.stats=s;st.feed=f;if(pp)PP=pp}

// ---------- vistas ----------
const V={
est(){const zs=['Todas',...new Set(S.map(s=>s.z))],l=S.filter(s=>st.flt==='Todas'||s.z===st.flt),t=st.me.totals,lg=st.me.league;
 return `<div class="top"><div class="eyebrow">Hola, ${esc(st.user.alias.split(' ')[0])}</div><h1>Elige tu estación</h1></div>${verifyBanner()}${recBanner()}
 <section class="pass" aria-label="Tu temporada"><div class="pass-head"><span>Pistea</span><span>${season()}</span></div>
  <b class="pass-num">${fmt(t.desnivel)}</b><span class="pass-unit">metros de desnivel esquiados</span>
  <div class="pass-row"><div><b>${t.dias}</b><small>${t.dias===1?'día':'días'}</small></div><div><b>${fmt(t.km)}</b><small>km</small></div><div><b>${st.me.pos?st.me.pos+'.º':'—'}</b><small>en España</small></div></div>
  <div class="pass-foot"><span>${esc(st.user.alias)}</span><span class="pass-code" aria-hidden="true"></span></div></section>
 <div class="tiles"><div class="tile">${ic('rec')}<div><b>${lg.tier?'Liga '+lg.tier:'Liga semanal'}</b><small>${lg.tier?`Puesto ${lg.pos} de ${lg.total} esta semana`:'Graba un día para entrar'}</small></div></div><div class="tile">${ic('flame')}<div><b>${st.me.streak} ${st.me.streak===1?'semana':'semanas'}</b><small>${st.me.streak?'de racha seguida':'Empieza tu racha esta semana'}</small></div></div></div>
 ${wrCard()}${pills(zs,st.flt,'setF')}<div class="grid">${l.map(s=>stCard(s)).join('')}</div>`},
rec(){const r=st.rank;if(!r)return `<div class="top"><h1>Récords</h1></div><div class="empty">Cargando…</div>`;
 const rows=r.rows.map(x=>`<div class="row ${x.me?'me':''}"><span class="pos">${x.pos}</span>${av(x.alias,x.avatar)}<b style="font-weight:600">${esc(x.alias)}</b><span class="val">${show(st.met,x.v)}</span></div>`).join('');
 return `<div class="top"><h1>Récords</h1></div>
 <div class="tabs">${Object.keys(MET).map(k=>`<button class="${k===st.met?'on':''}" data-c="setM|${k}">${MET[k]}</button>`).join('')}</div>
 ${seg(['hoy','semana','temporada'],st.per,'setP')}${pills(['España',...S.map(s=>s.n)],st.amb,'setA')}
 <div class="hero" style="margin-bottom:12px"><div class="eyebrow">Tu puesto en ${st.amb==='España'?'España':esc(st.amb)}</div><div class="big" style="margin-top:8px">${r.me?r.me.pos+'.º':'—'}</div>
 <small style="display:block;margin-top:8px">${r.me?(r.me.pos>1?`Te faltan ${show(st.met,r.gap)} para subir un puesto.`:'Lideras esta clasificación.'):'Todavía no tienes actividad en este filtro.'}</small></div>
 ${rows||'<div class="empty">Nadie ha esquiado aquí todavía. Sé el primero.</div>'}
 ${st.amb==='España'?'<p class="ppnote" style="margin-top:16px">'+ic('crown')+'Elige una estación para ver los récords de cada una de sus pistas.</p>':recPistes()}`},
com(){const f=st.feed,head=`<div class="top"><h1>Comunidad</h1></div>${seg(['Amigos','España','Buscar'],st.scope,'setS')}`;
 if(st.scope==='Buscar')return head+`<input id="q" placeholder="Buscar esquiadores por nombre" data-i="search|@v" value="${esc(st.q||'')}"><div id="res" style="margin-top:12px">${resHtml()}</div>`;
 return head+(f.length?f.map(d=>`<div class="card"><div style="display:flex;gap:12px;align-items:center;cursor:pointer" data-c="profile|${d.uid}">${av(d.alias,d.avatar)}<div><b style="font-weight:600">${esc(d.alias)}</b><br><small>${esc(SM[d.station].n)}, ${ago(d.ts).toLowerCase()}</small></div></div>
 <div class="map" style="height:170px;cursor:pointer;background-image:${mapBg(d)}" data-c="dayView|${d.id}" role="button" tabindex="0" aria-label="Ver el día">${trk(d.track,300,120,d.station)}</div>
 <div class="kpis" style="margin-bottom:12px"><div><b>${fmt(d.desnivel)}</b><small>m desnivel</small></div><div><b>${dec(d.km)}</b><small>km</small></div><div><b>${d.bajadas}</b><small>bajadas</small></div></div>${d.freeride>=0.05?`<span class="fr-tag" style="margin:-2px 0 12px">${dec(d.freeride)} km de freeride</span><br>`:''}
 <button class="kudo ${d.liked?'on':''}"${d.uid===st.user.id?' disabled title="Tus días reciben apoyos; tú no te los das"':` data-c="kudo|${d.id}|@"`}>${ic('heart')} <span>${d.kudos}</span> ${d.kudos===1?'apoyo':'apoyos'}</button>${d.uid!==st.user.id?`<button class="link" style="float:right;color:var(--mu);font-size:12.5px;margin-top:8px" data-c="reportUser|${d.uid}|${d.id}">Denunciar</button>`:''}</div>`).join(''):`<div class="empty">${st.scope==='Amigos'?'Tus amigos no han esquiado aún. Busca esquiadores y sigue a más gente.':'Aún no hay actividad.'}</div>`)},
yo(){const t=st.me.totals,vis=st.me.stations,days=st.me.days,u=st.user;
 const cr=(PP&&PP.crowns)||{v:[],n:[]},B=[['star','Primera bajada',t.bajadas>0],['bolt','100 km/h',t.vmax>=100],['flame','5 días',t.dias>=5],['map','5 estaciones',vis.length>=5],['up','10.000 m',t.desnivel>=10000],['clock','20 horas',t.horas>=20],['flag','10 km de freeride',t.freeride>=10],['star','Top 10',st.me.pos>0&&st.me.pos<=10],
  ['check','25 pistas selladas',ppTotal()>=25],['map','Estación completa',ppFull().length>0],['crown','Corona de velocidad',cr.v.length>0],['crown','Corona de bajadas',cr.n.length>0]];
 const wish=u.wish||[];
 return `${head(u,{me:1})}<input type="file" id="av-file" accept="image/jpeg,image/png,image/webp" hidden data-ch="pickAvatar|@">
 <div class="soc"><span><b>${st.me.followers}</b>${st.me.followers===1?'seguidor':'seguidores'}</span><span><b>${st.me.following}</b>siguiendo</span><span><b>${st.me.pos?st.me.pos+'.º':'—'}</b>en España</span></div>
 ${chips(u)}${u.bio?`<p class="bio">${esc(u.bio)}</p>`:''}${facts(u)}
 <button class="btn gh" data-c="editProfile">${ic('edit')}Editar perfil</button>
 ${compCard(u)}
 <h2>${season()}</h2>${wrCard()}${goalCard()}
 <div class="kpis"><div><b>${fmt(t.desnivel)}</b><small>m de desnivel</small></div><div><b>${fmt(t.km)}</b><small>km</small></div><div><b>${dec(t.horas)}</b><small>horas</small></div><div><b>${fmt(t.bajadas)}</b><small>bajadas</small></div><div><b>${t.dias}</b><small>${t.dias===1?'día':'días'}</small></div><div><b>${dec(t.freeride||0)}</b><small>km de freeride</small></div></div>
 <h2>Estaciones:${vis.length} de ${S.length}</h2><div class="card"><div style="display:flex;flex-wrap:wrap;gap:6px">${S.map(s=>{const v=vis.includes(s.id),w=!v&&wish.includes(s.id);return `<span class="chipTag ${v?'hit':w?'want':''}">${w?ic('star'):''}${esc(s.n)}</span>`}).join('')}</div><div class="bar"><i style="width:${vis.length/S.length*100}%"></i></div>${wish.length?'<small style="display:block;margin-top:10px">En oscuro, las que ya has esquiado; con estrella, las de tu lista de esta temporada.</small>':''}</div>
 ${ppCard()}
 <h2>Insignias</h2><div class="bdg">${B.map(b=>`<div class="${b[2]?'on':''}">${ic(b[0])}${b[1]}</div>`).join('')}</div>
 <h2>Mis días</h2>${days.length?days.map(d=>`<div class="row" style="cursor:pointer" data-c="dayView|${d.id}" role="button" tabindex="0"><div><b>${esc(SM[d.station].n)}</b><br><small>${ago(d.ts)}, ${d.bajadas} bajadas${d.freeride>=0.05?`, ${dec(d.freeride)} km de freeride`:''}</small></div><span class="val">${fmt(d.desnivel)} m</span></div>`).join(''):'<div class="empty">Todavía no has grabado ningún día. Pulsa el botón naranja cuando estés en la estación.</div>'}
 <h2>Cuenta y privacidad</h2>
 <div class="list">${st.user.admin?`<button data-c="panelDatos">${ic('datos')}Panel de datos de usuarios</button><button data-c="moderation">${ic('flag')}Moderación de denuncias</button>`:''}<button data-c="changePw">${ic('lock')}Cambiar contraseña</button><button data-c="showBlocks">${ic('block')}Usuarios bloqueados</button><button data-c="exportData">${ic('down')}Descargar mis datos</button><button data-c="logoutAll">${ic('devices')}Cerrar sesión en todos los dispositivos${st.me&&st.me.sessions>1?` (${st.me.sessions})`:''}</button></div>
 <p class="credit" style="margin:0 2px 16px">Tu contraseña se guarda cifrada y nadie puede leerla. Guardamos los accesos a tu cuenta durante 180 días para protegerla.</p>
 <button class="btn gh" data-c="logout">Cerrar sesión</button>
 <p style="display:flex;justify-content:center;gap:18px;margin:18px 0 12px;font-size:14px"><a href="/privacidad" target="_blank" rel="noopener" style="color:var(--mu)">Privacidad</a><a href="/condiciones" target="_blank" rel="noopener" style="color:var(--mu)">Condiciones</a><a href="/normas" target="_blank" rel="noopener" style="color:var(--mu)">Normas</a></p>
 <button class="btn dg" data-c="delAccount">Eliminar cuenta y datos</button>`}
};
function render(){
 document.body.classList.toggle('out',!st.me);   // sin sesión: la foto a toda pantalla
 if(st.loading&&!st.me){$('#m').innerHTML=`<div class="auth"><header class="auth-hero" style="display:grid;place-content:center;justify-items:center;gap:10px"><div class="logo">${ic('est')} Pistea</div><small style="color:#fff">Cargando…</small></header></div>`;$('#nav').style.display='none';return}
 if(st.offline&&!st.me){$('#m').innerHTML=`<div class="auth"><header class="auth-hero"><div class="logo">${ic('est')} Pistea</div></header><section class="auth-sheet"><h1>Sin conexión</h1><p class="mu" style="margin:8px 0 20px">No llegamos al servidor. Tu sesión sigue abierta: en cuanto vuelva la conexión entras directamente.</p><button class="btn" data-c="boot">Reintentar</button></section></div>`;$('#nav').style.display='none';return}
 if(!st.me){$('#m').innerHTML=authView();$('#nav').style.display='none';return}
 $('#nav').style.display='';$('#m').innerHTML=(st.toast?`<div class="toast">${esc(st.toast)}</div>`:'')+V[st.tab]();
 $('#nav').innerHTML=[['est','Estaciones'],['com','Comunidad'],['go','Traquear'],['rec','Récords'],['yo','Perfil']].map(t=>t[0]==='go'?`<button class="go" data-c="elegir" aria-label="Traquear">${ic('go')}</button>`:`<button class="${t[0]===st.tab?'on':''}" data-c="tab|${t[0]}">${ic(t[0])}${t[1]}</button>`).join('')}
async function loadRank(){const my=++rq,q=new URLSearchParams({metric:st.met,period:st.per});if(st.amb!=='España'){const id=S.find(s=>s.n===st.amb).id;q.set('station',id);if(!st.rk2||st.rk2.id!==id){st.rk2=null;api('records?station='+id).then(r=>{if(st.amb===SM[id].n){st.rk2=Object.assign(r,{id});if(st.tab==='rec')render()}}).catch(()=>{})}}st.rank=null;if(st.tab==='rec')render();try{const r=await api('rank?'+q);if(my!==rq)return;st.rank=r}catch(e){flash(e.message)}render();pillIn()}
async function tab(t){st.tab=t;st.toast=0;render();$('#m').scrollTop=0;if(t==='rec'){st.rk2=null;loadRank();pillIn()}else if(t!=='yo'){try{await refresh();render()}catch(e){}}}
// La estación elegida en Récords, a la vista en su fila de píldoras (si no, con 28 estaciones se queda fuera de pantalla)
const pillIn=()=>requestAnimationFrame(()=>{const b=[...document.querySelectorAll('#m .pills button.on')].pop();if(b&&b.textContent!=='España')b.scrollIntoView({block:'nearest',inline:'center'})});
const setF=a=>{st.flt=a;render()},setS=async a=>{st.scope=a;render();if(a!=='Buscar'){try{st.feed=await api(feedQ());render()}catch(e){}}},setP=a=>{st.per=a;loadRank()},setA=a=>{st.amb=a;loadRank()},setM=a=>{st.met=a;loadRank()};
const resHtml=()=>(st.users||[]).length?st.users.map(u=>`<div class="row">${av(u.alias,u.avatar)}<b style="font-weight:600;cursor:pointer" data-c="profile|${u.id}">${esc(u.alias)}</b><button class="kudo ${u.following?'on':''}" style="margin-left:auto" data-c="follow|${u.id}|@">${u.following?'Siguiendo':'Seguir'}</button></div>`).join(''):'<div class="empty">Escribe al menos 2 letras para buscar.</div>';
function search(v){st.q=v;clearTimeout(qt);qt=setTimeout(async()=>{try{st.users=v.trim().length>1?await api('users?q='+encodeURIComponent(v.trim())):[];$('#res').innerHTML=resHtml()}catch(e){}},250)}
async function follow(id,b){try{const r=await api('follow',{body:{id}});b.textContent=r.following?'Siguiendo':'Seguir';b.classList.toggle('on',r.following)}catch(e){flash(e.message)}}
async function profile(id){try{const u=await api('user?id='+id),mine=st.user.wish||[],both=u.me?[]:(u.wish||[]).filter(x=>mine.includes(x)&&SM[x]);ov(`${head(u)}
 <div class="soc"><span><b>${u.followers}</b>${u.followers===1?'seguidor':'seguidores'}</span><span><b>${u.totals.dias}</b>${u.totals.dias===1?'día':'días'}</span><span><b>${u.pos?u.pos+'.º':'—'}</b>en España</span></div>
 ${chips(u)}${u.bio?`<p class="bio">${esc(u.bio)}</p>`:''}${facts(u)}
 ${u.me?'':`<button class="btn ${u.following?'gh':''}" data-c="follow|${u.id}|@">${u.following?'Siguiendo':'Seguir'}</button>`}
 ${both.length?`<div class="card match" style="margin-top:12px">${ic('star')}<div><b>Los dos queréis ir a ${list(both.map(x=>esc(SM[x].n)))}</b><br><small>Está en vuestras listas de esta temporada.</small></div></div>`:''}
 <div class="kpis" style="margin-top:14px"><div><b>${fmt(u.totals.desnivel)}</b><small>m desnivel</small></div><div><b>${fmt(u.totals.km)}</b><small>km</small></div><div><b>${fmt(u.totals.bajadas)}</b><small>bajadas</small></div></div>
 <h2>Últimos días</h2>${u.days.length?u.days.map(d=>`<div class="card" style="cursor:pointer" data-c="dayView|${d.id}" role="button" tabindex="0"><b style="font-weight:600">${esc(SM[d.station].n)}</b> <small>${ago(d.ts).toLowerCase()}</small><div class="map" style="height:120px;background-image:${mapBg(d)}">${trk(d.track,300,90,d.station)}</div><small>${fmt(d.desnivel)} m de desnivel, ${d.bajadas} bajadas${d.freeride>=0.05?`, ${dec(d.freeride)} km de freeride`:''}</small></div>`).join(''):'<div class="empty">Sin días todavía.</div>'}${u.me?'':`<div style="display:flex;gap:22px;justify-content:center;margin:22px 0 6px"><button class="link" style="color:var(--mu)" data-c="reportUser|${u.id}">Denunciar</button><button class="link" style="color:var(--r)" data-c="blockUser|${u.id}">Bloquear</button></div>`}`)}catch(e){flash(e.message)}}
function reportUser(target,day){ov(`<div class="top" style="padding-top:60px"><div class="eyebrow">Denunciar</div><h1>¿Qué ocurre?</h1></div><form data-s="sendReport|@e|${target}|${day||''}">${[['spam','Spam o publicidad'],['ofensivo','Nombre, foto o texto ofensivo'],['trampas','Datos falsos o trampas en el ranking'],['suplantacion','Se hace pasar por otra persona'],['privacidad','Publica datos privados de alguien'],['otro','Otro motivo']].map(([v,l],i)=>`<label style="display:flex;gap:10px;align-items:center;color:var(--tx);margin:12px 0;font-size:15px"><input type="radio" name="rr" value="${v}" style="width:auto"${i?'':' required'}> ${l}</label>`).join('')}<label>Detalles (opcional)</label><textarea id="rn" maxlength="300" style="width:100%;min-height:80px;background:var(--s1);border:1px solid var(--ln);border-radius:10px;padding:12px;color:var(--tx);font:inherit"></textarea><div class="err" id="r-er"></div><button class="btn" id="r-sb">Enviar denuncia</button></form><small style="display:block;margin-top:12px">La revisa una persona. Quien denuncias no sabe que has sido tú. Si te molesta, también puedes bloquearlo.</small>`)}
async function sendReport(e,target,day){e.preventDefault();const r=document.querySelector('input[name=rr]:checked');if(!r)return false;$('#r-sb').disabled=true;try{await api('report',{body:{target,day:day||undefined,reason:r.value,note:$('#rn').value}});ov0();flash('Gracias. Revisaremos la denuncia.')}catch(x){$('#r-er').textContent=x.message;$('#r-sb').disabled=false}return false}
async function blockUser(id){if(!confirm('¿Bloquear a este usuario? No os veréis en la comunidad, la búsqueda ni los perfiles, y dejaréis de seguiros.'))return;try{await api('block',{body:{id}});ov0();flash('Usuario bloqueado. Puedes desbloquearlo desde tu perfil.');try{st.feed=await api(feedQ());render()}catch(e){}}catch(e){flash(e.message)}}
async function showBlocks(){try{const l=await api('blocks');ov(`<div class="top" style="padding-top:60px"><div class="eyebrow">Privacidad</div><h1>Usuarios bloqueados</h1></div>${l.length?l.map(u=>`<div class="row"><b style="font-weight:600">${esc(u.alias)}</b><button class="kudo" style="margin-left:auto" data-c="unblock|${u.id}|@">Desbloquear</button></div>`).join(''):'<div class="empty">No has bloqueado a nadie.</div>'}`)}catch(e){flash(e.message)}}
async function unblock(id,b){try{await api('block',{body:{id}});b.closest('.row').remove();flash('Desbloqueado.')}catch(e){flash(e.message)}}
const RSN={spam:'Spam',ofensivo:'Ofensivo',trampas:'Trampas',suplantacion:'Suplantación',privacidad:'Privacidad',otro:'Otro'};
async function moderation(){try{const l=await api('admin/reports');ov(`<div class="top" style="padding-top:60px"><div class="eyebrow">Moderación</div><h1>Denuncias abiertas</h1></div>${l.length?l.map(r=>`<div class="card"><div style="display:flex;gap:12px;align-items:center">${av(r.alias,r.avatar)}<div><b style="font-weight:600">${esc(r.alias)}</b>${r.hidden?' <span class="chipTag">oculto</span>':''}${r.banned?' <span class="chipTag">suspendido</span>':''}<br><small>${RSN[r.reason]||esc(r.reason)} · ${r.n} ${r.n===1?'persona':'personas'} · ${ago(r.ts)} · de ${esc(r.reporter||'—')}</small></div></div>${r.bio?`<p class="mu" style="margin-top:8px">"${esc(r.bio)}"</p>`:''}${r.note?`<p style="margin-top:8px">${esc(r.note)}</p>`:''}${r.day&&r.km!=null?`<small style="display:block;margin-top:8px">Día en ${esc((SM[r.station]||{n:'?'}).n)}: ${fmt(r.desnivel)} m · ${dec(r.km)} km · ${r.bajadas} bajadas · ${Math.round(r.vmax)} km/h máx</small>`:''}<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">${[['descartar','Descartar'],...(r.day?[['quitar_dia','Quitar el día']]:[]),['limpiar_perfil','Limpiar perfil'],['suspender','Suspender cuenta']].map(([a,t])=>`<button class="kudo" data-c="resolveRep|${r.id}|${a}">${t}</button>`).join('')}</div></div>`).join(''):'<div class="empty">No hay denuncias pendientes.</div>'}`)}catch(e){flash(e.message)}}
async function resolveRep(id,action){if(action==='suspender'&&!confirm('¿Suspender esta cuenta? No podrá entrar y desaparece de la app.'))return;try{await api('admin/resolve',{body:{id,action}});flash('Hecho.');moderation()}catch(e){flash(e.message)}}
async function kudo(id,b){try{const r=await api('kudos',{body:{id}});b.classList.toggle('on',r.liked);b.querySelector('span').textContent=r.kudos;b.lastChild.textContent=r.kudos===1?' apoyo':' apoyos'}catch(e){flash(e.message)}}
function pickAvatar(input){const f=input.files&&input.files[0];if(!f)return;if(!/^image\/(jpeg|png|webp)$/i.test(f.type)){flash('Solo se admiten fotos JPEG, PNG o WebP.');return}const r=new FileReader();r.onload=e=>{const img=new Image();img.onload=async ()=>{const c=document.createElement('canvas'),s=Math.min(img.width,img.height);c.width=300;c.height=300;c.getContext('2d').drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,300,300);try{const res=await api('avatar',{body:{image:c.toDataURL('image/webp',0.85)}});st.user.avatar=res.avatar;if(st.drView)drPaint();render();flash('Foto de perfil actualizada.')}catch(err){flash(err.message)}};img.src=e.target.result};r.readAsDataURL(f)}
// ---------- ficha de esquiador ----------
// El alta guiada (tras crear la cuenta) y Editar perfil usan las mismas piezas (FD) sobre un borrador (st.dr) que se guarda con
// POST /api/me: en el alta, paso a paso, para que lo hecho no se pierda si se cierra a medias.
const avSt=a=>a?`background-image:url(${esc(a)});background-size:cover;background-position:center;color:transparent`:'';
const seasonY=()=>{const d=new Date();return d.getFullYear()-(d.getMonth()<6?1:0)};
const sinceTxt=y=>{const n=seasonY()-y+1;return n<=1?'Primera temporada en la nieve':`${n} temporadas en la nieve, desde ${y}`};
const list=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' y '+a[a.length-1];
const toHandle=a=>String(a||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'.').replace(/^\.+|\.+$/g,'').slice(0,20).replace(/\.+$/,'');
// El reto de temporada: una baliza por día (como las que marcan el borde de la pista); con más de 60, una barra
const poles=(g,d)=>g>60?`<div class="bar" style="margin:14px 0 10px"><i style="width:${Math.min(100,d/g*100)}%"></i></div>`:`<div class="poles" role="img" aria-label="${Math.min(d,g)} de ${g} días">${Array.from({length:g},(_,i)=>`<i class="${i<d?'on':''}"></i>`).join('')}</div>`;
function head(u,o={}){const h=SM[u.station_home];return `<div class="cover" style="${h?`background-image:${photo(u.station_home)}`:''}">${h?`<span class="cover-tag">${ic('pin')}${esc(h.n)}</span>`:''}</div>
 <div class="idrow"><div class="avw"><span class="av av-xl" style="${avSt(u.avatar)}"${o.me?' data-c="pickFile" role="button" tabindex="0" aria-label="Cambiar foto de perfil"':''}>${ini(u.alias)}</span>${o.me?`<button class="avcam" data-c="pickFile" aria-label="Cambiar foto de perfil">${ic('cam')}</button>`:''}</div>
 <div class="idtx"><h1>${esc(u.alias)}</h1>${u.handle?`<div class="handle">@${esc(u.handle)}</div>`:''}</div></div>${u.since?`<p class="since">${sinceTxt(u.since)}</p>`:''}`}
const facts=u=>u.club||u.gear?`<div class="facts">${u.club?`<div>${ic('club')}<span>Club o escuela</span><b>${esc(u.club)}</b></div>`:''}${u.gear?`<div>${ic('ski')}<span>Equipo</span><b>${esc(u.gear)}</b></div>`:''}</div>`:'';
const CMP=[['avatar','tu foto','tu'],['handle','tu @usuario','tu'],['bio','unas líneas sobre ti','tu'],['since','desde cuándo esquías','como'],['terrain','lo que más te gusta','como'],['station_home','tu estación de casa','casa'],['wish','dónde quieres esquiar','casa'],['goal_days','tu reto de temporada','temporada']];
function compCard(u){const miss=CMP.filter(([k])=>Array.isArray(u[k])?!u[k].length:!u[k]);if(!miss.length)return '';const pc=Math.round((CMP.length-miss.length)/CMP.length*100),n=miss.map(c=>c[1]);
 return `<div class="card comp" style="margin-top:12px"><div class="comp-h"><b>Tu ficha, al ${pc} %</b><button class="link" data-c="editProfile|${miss[0][2]}">Completar</button></div><div class="bar"><i style="width:${pc}%"></i></div><small>${n.length>1?'Te faltan':'Te falta'} ${n.length>3?n.slice(0,3).join(', ')+` y ${n.length-3} más`:list(n)}.</small></div>`}
function goalCard(){const g=st.user.goal_days,d=st.me.seasonDays||0;
 if(!g)return `<div class="card goal"><div class="goal-h"><b>Ponte un reto</b></div><small style="margin-top:6px">Elige cuántos días quieres esquiar esta temporada y clava una baliza por cada uno.</small><button class="btn gh" data-c="editProfile|temporada">Elegir mi reto</button></div>`;
 return `<div class="card goal"><div class="goal-h"><b>Tu reto</b><span><b>${Math.min(d,g)}</b> de ${g} días</span></div>${poles(g,d)}<small>${d>=g?'Reto cumplido. Si quieres más, súbelo desde Editar perfil.':g-d===1?'Te falta 1 día.':`Te faltan ${g-d} días.`}</small></div>`}
const tog=(k,v,l)=>{const on=st.dr[k].includes(v);return `<button type="button" class="${on?'on':''}" data-c="drTog|${k}|${v}" aria-pressed="${on}">${on?ic('check'):''}${l}</button>`};
const FD={
 foto:()=>{const u=st.user;return `<div class="avpick"><span class="av" style="${avSt(u.avatar)}" data-c="pickFile" role="button" tabindex="0" aria-label="Elegir foto de perfil">${ini(st.dr.alias||u.alias)}</span><div><button type="button" class="btn gh" style="padding:10px 16px;width:auto" data-c="pickFile">${ic('cam')}${u.avatar?'Cambiar foto':'Añadir foto'}</button>${u.avatar?'<button type="button" class="link" style="color:var(--r);font-size:14px" data-c="delAvatar">Quitar foto</button>':'<small>Tu cara o tu mejor día en la nieve.</small>'}</div><input type="file" id="av-file" accept="image/jpeg,image/png,image/webp" hidden data-ch="pickAvatar|@"></div>`},
 nombre:()=>`<label for="d-al">Nombre público</label><input id="d-al" maxlength="24" value="${esc(st.dr.alias)}" data-i="drSet|alias|@v" autocomplete="nickname"><small>Así sales en los rankings y en la comunidad.</small>`,
 handle:()=>`<label for="d-h">Tu @usuario</label><div class="hd"><span>@</span><input id="d-h" maxlength="20" value="${esc(st.dr.handle)}" data-i="handleIn|@v" autocapitalize="none" autocomplete="off" spellcheck="false"></div><small class="hs ${hsCls()}" id="hs" aria-live="polite">${hsTxt()}</small>`,
 bio:()=>`<label for="d-bio">Sobre ti</label><textarea id="d-bio" maxlength="200" rows="3" style="resize:none" data-i="drSet|bio|@v" placeholder="Tu pista favorita, con quién subes, lo que te queda por esquiar…">${esc(st.dr.bio)}</textarea>`,
 modalidad:()=>`<div class="lab">Qué haces en la nieve</div><div class="opt3">${Object.keys(MOD).map(k=>`<button type="button" class="opt ${st.dr.modality===k?'on':''}" data-c="drPick|modality|${k}" aria-pressed="${st.dr.modality===k}">${ic(k)}${k==='ambos'?'Las dos':MOD[k]}</button>`).join('')}</div>`,
 nivel:()=>`<div class="lab">Tu nivel</div><div class="lvl">${Object.keys(LVL).map(k=>`<button type="button" class="${st.dr.level===k?'on':''}" data-c="drPick|level|${k}" aria-pressed="${st.dr.level===k}"><i class="sg" style="--c:var(--${LVL[k][1]})"></i><span><b>${LVL[k][0]}</b><small>${LVLD[k]}</small></span></button>`).join('')}</div>`,
 terreno:()=>`<div class="lab">Lo que más te gusta <small>(las que quieras)</small></div><div class="tg">${Object.keys(TER).map(k=>tog('terrain',k,TER[k])).join('')}</div>`,
 desde:()=>{const y=new Date().getFullYear();return `<label for="d-since">Esquías desde</label><select id="d-since" data-ch="drSel|since|@"><option value="">Prefiero no decirlo</option>${Array.from({length:y-1939},(_,i)=>y-i).map(v=>`<option value="${v}"${+st.dr.since===v?' selected':''}>${v}</option>`).join('')}</select><small id="since-t">${st.dr.since?sinceTxt(+st.dr.since):''}</small>`},
 casa:grid=>grid?`<div class="pills">${['Todas',...new Set(S.map(s=>s.z))].map(z=>`<button type="button" class="${(st.dz||'Todas')===z?'on':''}" data-c="drZone|${z}">${z}</button>`).join('')}</div><div class="sgrid">${S.filter(s=>!st.dz||st.dz==='Todas'||s.z===st.dz).map(s=>{const on=st.dr.station_home===s.id;return `<button type="button" class="${on?'on':''}" style="background-image:${photo(s.id)}" data-c="drPick|station_home|${on?'':s.id}" aria-pressed="${on}">${on?`<span class="ok">${ic('check')}</span>`:''}${esc(s.n)}</button>`}).join('')}</div><small style="display:block;margin-top:12px">${st.dr.station_home?`Elegida: ${esc(SM[st.dr.station_home].n)}. Tócala otra vez para quitarla.`:'Si no tienes una fija, sigue sin elegir.'}</small>`
  :`<label for="d-sh">Tu estación de casa</label><select id="d-sh" data-ch="drSel|station_home|@"><option value="">Sin estación fija</option>${S.map(s=>`<option value="${s.id}"${st.dr.station_home===s.id?' selected':''}>${esc(s.n)} (${s.z})</option>`).join('')}</select><small>Su foto es la portada de tu perfil.</small>`,
 deseo:()=>`<div class="lab">Dónde quieres esquiar esta temporada <small>(hasta 12)</small></div><div class="tg">${S.map(s=>tog('wish',s.id,esc(s.n))).join('')}</div>`,
 reto:()=>{const g=+st.dr.goal_days||0,d=st.me.seasonDays||0,o=[5,10,15,20,30,50];if(g&&!o.includes(g)){o.push(g);o.sort((a,b)=>a-b)}
  return `<div class="lab">¿Cuántos días quieres esquiar?</div><div class="tg">${o.map(n=>`<button type="button" class="${g===n?'on':''}" data-c="drPick|goal_days|${n}" aria-pressed="${g===n}">${n} días</button>`).join('')}<button type="button" class="${g?'':'on'}" data-c="drPick|goal_days|" aria-pressed="${!g}">Sin reto</button></div>${g?`<div class="goal-prev">${poles(g,d)}<small>${d?`Llevas ${Math.min(d,g)} de ${g}. `:''}Cada día que grabes en una estación clava una baliza.</small></div>`:''}`},
 club:()=>`<label for="d-club">Club o escuela <small>(opcional)</small></label><input id="d-club" maxlength="60" value="${esc(st.dr.club)}" data-i="drSet|club|@v" placeholder="Tu club de esquí o tu escuela">`,
 equipo:()=>`<label for="d-gear">Tu equipo <small>(opcional)</small></label><input id="d-gear" maxlength="60" value="${esc(st.dr.gear)}" data-i="drSet|gear|@v" placeholder="Tus esquís o tu tabla">`,
 edad:()=>`<label for="d-age">Edad <small>(solo la ves tú)</small></label><input id="d-age" type="number" min="14" max="120" value="${esc(st.dr.age)}" data-i="drSet|age|@v" placeholder="Ej: 28"><small>Mínimo 14 años (art. 7 LOPDGDD 3/2018).</small>`};
// @usuario: se comprueba mientras se escribe; si estaba propuesto por la app y está cogido, se cambia solo por uno libre
let hT,hq=0;
const hsCls=()=>st.hs&&st.hs.ok?'ok':st.hs&&st.hs.e?'no':'';
const hsTxt=()=>{const s=st.hs;return !s?'Opcional. Con él te encuentran tus amigos.':s.w?'Comprobando…':s.ok?(st.dr.handle===st.user.handle?'Es tu @usuario.':`${ic('check')}@${esc(st.dr.handle)} está libre.`):`${esc(s.e)}${s.s?` <button type="button" class="link" data-c="useHandle|${esc(s.s)}">Usar @${esc(s.s)}</button>`:''}`};
function hsPaint(){const e=$('#hs');if(e){e.className='hs '+hsCls();e.innerHTML=hsTxt()}}
function checkHandle(h){clearTimeout(hT);const my=++hq;st.hs=h?{w:1}:null;hsPaint();if(!h)return;
 hT=setTimeout(async()=>{try{const r=await api('handle?h='+encodeURIComponent(h));if(my!==hq)return;
  if(!r.ok&&st.hAuto&&r.suggest){st.dr.handle=r.suggest;const i=$('#d-h');if(i)i.value=r.suggest;st.hs={ok:1}}else st.hs=r.ok?{ok:1}:{e:r.error,s:r.suggest}}catch(e){if(my===hq)st.hs=null}hsPaint()},350)}
function handleIn(v){st.hAuto=false;st.dr.handle=v.trim().toLowerCase().replace(/^@/,'');checkHandle(st.dr.handle)}
function useHandle(h){st.dr.handle=h;st.hAuto=false;const i=$('#d-h');if(i)i.value=h;checkHandle(h)}
const draft=()=>{const u=st.user;return{alias:u.alias,handle:u.handle||'',bio:u.bio||'',modality:u.modality||'ski',level:u.level||'intermedio',terrain:[...(u.terrain||[])],since:u.since||'',station_home:u.station_home||'',wish:[...(u.wish||[])],goal_days:u.goal_days||'',gear:u.gear||'',club:u.club||'',age:u.age||''}};
function drPaint(){const ob=st.drView==='ob',cls=ob?'onb':'edp',a=document.activeElement,fc=a&&a.dataset&&a.dataset.c;let o=$('.ov');if(!o||!o.classList.contains(cls)){ov('');o=$('.ov');o.classList.add(cls)}
 const y=o.scrollTop;o.innerHTML=(ob?'':`<button class="x" data-c="ov0" aria-label="Cerrar sin guardar">${ic('x')}</button>`)+(ob?obHtml():edHtml());o.scrollTop=y;
 if(fc){const e=[...o.querySelectorAll('[data-c]')].find(x=>x.dataset.c===fc);if(e)e.focus({preventScroll:true})}}   // tras repintar, el foco sigue en el botón pulsado
function drSet(k,v){st.dr[k]=v;if(k==='alias'&&st.hAuto){const h=toHandle(v)||'esquiador';st.dr.handle=h;const i=$('#d-h');if(i)i.value=h;checkHandle(h)}}
function drPick(k,v){st.dr[k]=v;drPaint()}
function drTog(k,v){const a=st.dr[k],i=a.indexOf(v);if(i>=0)a.splice(i,1);else{if(k==='wish'&&a.length>=12)return flash('Elige hasta 12 estaciones.');a.push(v)}drPaint()}
function drSel(k,el){st.dr[k]=el.value;if(k==='since'){const t=$('#since-t');if(t)t.textContent=el.value?sinceTxt(+el.value):''}}
const drZone=z=>{st.dz=z;drPaint()};
const ALL=['alias','handle','bio','modality','level','terrain','since','station_home','wish','goal_days','club','gear','age'];
async function saveDraft(keys,extra={}){const body={...extra};for(const k of keys){const v=st.dr[k];body[k]=Array.isArray(v)?v:typeof v==='string'?(v.trim()?v.trim():null):v===''?null:v}
 const r=await api('me',{body});st.user=r.user;st.me.user=r.user;return r}
// Alta guiada: el paso 1 (la cuenta) ya está hecho cuando empieza; se puede saltar en cualquier momento
const OB=[
 ['Tu foto y tu nombre','Así te verán tus amigos en la comunidad y en los rankings.',()=>FD.foto()+FD.nombre()+FD.handle(),['alias','handle']],
 ['Cómo esquías','Sale en tu perfil para que quien te siga sepa cómo bajas.',()=>FD.modalidad()+FD.nivel()+FD.terreno()+FD.desde(),['modality','level','terrain','since']],
 ['Tu estación de casa','La que más pisas. Su foto será la portada de tu perfil.',()=>FD.casa(true),['station_home']],
 ['Tu temporada','Un reto de días y las estaciones que tienes en mente. Las verás en tu perfil y marcadas con una estrella en la lista de estaciones.',()=>FD.reto()+FD.deseo(),['goal_days','wish']]];
function onb(k){st.drView='ob';st.ob=k;if(!st.dr){st.dr=draft();st.hs=null}if(k===0&&!st.dr.handle){st.hAuto=true;st.dr.handle=toHandle(st.dr.alias)||'esquiador'}drPaint();$('.ov').scrollTop=0;if(k===0&&st.dr.handle&&!st.hs)checkHandle(st.dr.handle)}
function obHtml(){const k=st.ob,n=OB.length+1,[t,p,f]=OB[k];return `<div class="onb-top"><div class="steps" aria-hidden="true">${Array.from({length:n},(_,i)=>`<i class="${i<=k?'on':i===k+1?'cur':''}"></i>`).join('')}</div><button class="link" data-c="obSkip">Saltar</button></div>
 <small>Paso ${k+2} de ${n}${k?'':'. La cuenta ya está creada.'}</small><h1>${t}</h1><p class="mu lead">${p}</p>${f()}<div class="err" id="d-er" role="alert"></div>
 <div class="onb-cta">${k?'<button class="btn gh" data-c="obBack">Atrás</button>':''}<button class="btn" id="d-sb" data-c="obNext">${k===OB.length-1?'Terminar':'Continuar'}</button></div>`}
async function obNext(){const k=st.ob,b=$('#d-sb');b.disabled=true;try{await saveDraft(OB[k][3],k===OB.length-1?{onboarded:true}:{});if(k<OB.length-1)onb(k+1);else obDone()}catch(e){$('#d-er').textContent=e.message;b.disabled=false}}
const obBack=()=>onb(st.ob-1);
async function obSkip(){try{await api('me',{body:{onboarded:true}});st.user.onboarded=true}catch(e){}st.dr=null;ov0()}
function obDone(){st.drView=null;st.dr=null;const u=st.user;ov(`<div class="reveal">${head(u)}${chips(u)}<h1 style="margin-top:18px">Tu ficha está lista</h1><p class="mu lead" style="margin-bottom:22px">Así te ven los demás. La cambias cuando quieras desde Perfil.</p><button class="btn" data-c="obEnd|est">Elegir estación</button><button class="btn gh" data-c="obEnd|yo">Ver mi perfil</button></div>`);render()}
function obEnd(t){ov0();tab(t)}
function editProfile(sec){st.dr=draft();st.hs=null;st.hAuto=false;st.drView='ed';drPaint();const e=sec&&document.getElementById('ed-'+sec);if(e)e.scrollIntoView();else $('.ov').scrollTop=0}
function edHtml(){return `<div class="top" style="padding-top:60px"><h1>Editar perfil</h1></div>
 <section id="ed-tu">${FD.foto()}${FD.nombre()}${FD.handle()}${FD.bio()}</section>
 <section id="ed-como"><h2>Cómo esquías</h2>${FD.modalidad()}${FD.nivel()}${FD.terreno()}${FD.desde()}</section>
 <section id="ed-casa"><h2>Tus estaciones</h2>${FD.casa(false)}${FD.deseo()}</section>
 <section id="ed-temporada"><h2>Tu reto de temporada</h2>${FD.reto()}</section>
 <section id="ed-mas"><h2>Más sobre ti</h2>${FD.club()}${FD.equipo()}${FD.edad()}</section>
 <div class="err" id="d-er" role="alert"></div><div class="onb-cta"><button class="btn" id="d-sb" data-c="edSave">Guardar cambios</button></div>`}
async function edSave(){const b=$('#d-sb');b.disabled=true;try{await saveDraft(ALL);st.dr=null;ov0();flash('Perfil guardado.')}catch(e){const r=$('#d-er');r.textContent=e.message;r.scrollIntoView({block:'center'});b.disabled=false}}
// Fuerza de la contraseña al crearla: orientativa; quien decide es el servidor (weakPw)
function pwMeter(v){const em=(($('#em')||{}).value||'').split('@')[0].toLowerCase(),al=(($('#al')||{}).value||'').toLowerCase(),l=v.toLowerCase();let s=0;
 if(v.length>=8)s++;if(v.length>=12)s++;if([/[a-z]/,/[A-Z]/,/\d/,/[^A-Za-z0-9]/].filter(r=>r.test(v)).length>=3||/\S\s+\S.*\s+\S/.test(v))s++;if(v.length>=16)s++;
 if(v.length<8||/^(1234|qwer|pass|contra|abcd)/.test(l)||(em.length>=4&&l.includes(em))||(al.length>=4&&l.includes(al)))s=Math.min(s,1);
 const C=['','var(--r)','#e0a21b','var(--b)','var(--g)'],T=['Usa una frase o mezcla palabras: no vale tu correo ni una muy común.','Débil: alárgala o usa una frase.','Aceptable.','Buena.','Muy buena.'];
 const m=$('#pwm');if(m)[...m.children].forEach((e,i)=>e.style.background=v&&i<Math.max(s,1)?C[Math.max(s,1)]:'');const t=$('#pwm-t');if(t)t.textContent=v?T[Math.max(s,1)]:T[0]}
async function delAvatar(){if(!confirm('¿Eliminar tu foto de perfil?'))return;try{await api('avatar',{method:'DELETE'});st.user.avatar=null;if(st.drView)drPaint();render();flash('Foto de perfil eliminada.')}catch(err){flash(err.message)}}
async function exportData(){try{const res=await fetch('/api/me/export',{credentials:'same-origin'});if(!res.ok)throw new Error('Error al descargar');const b=await res.blob(),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=`pistea-datos-${st.user.alias.replace(/[^a-zA-Z0-9]/g,'')}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);flash('Datos descargados en formato oficial JSON.')}catch(e){flash(e.message)}}
// Una ficha encima de la pestaña: es un diálogo (para los lectores de pantalla) y recibe el foco, salvo si ya estaba dentro
// (al repintar la misma ficha, como en los récords de una pista)
function ov(h){clearInterval(T);stopW();const o=$('.ov'),had=o&&o.contains(document.activeElement);if(o)o.remove();$('#app').insertAdjacentHTML('beforeend',`<div class="ov" role="dialog" aria-modal="true" tabindex="-1"><button class="x" data-c="ov0" aria-label="Cerrar">${ic('x')}</button>${h}</div>`);
 const n=$('.ov'),t=n&&n.querySelector('h1');if(n){if(t)n.setAttribute('aria-label',t.textContent);if(!had)n.focus({preventScroll:true})}}
function ficha(i){const s=SM[i],info=st.stats[i]||{leaders:[],skiers:0};st.fi=i;st.pf='';st.pall=false;
 const fc=FC[i];ov(`<div class="photo" style="background-image:${photo(i)}"><div class="eyebrow">${s.z}</div><h1>${s.n}</h1></div>${fc?`<p class="credit">${fc.ambiente?"Imagen de ambiente de la zona, no de la estación. ":""}Foto: ${esc(fc.autor)}, ${esc(fc.licencia)}, <a href="${esc(fc.url)}" target="_blank" rel="noopener">Wikimedia Commons</a></p>`:''}
 ${SI[i]?`<div class="kpis" style="margin:14px 0"><div><b>${(PI[i]||[]).length||SI[i].pistas}</b><small>pistas</small></div><div><b>${SI[i].remontes}</b><small>remontes</small></div><div><b>${info.skiers}</b><small>${info.skiers===1?'esquiador':'esquiadores'}</small></div></div>`:''}
 <div class="m3d" style="background-image:url(/img/${i}.webp)" data-c="open3d|${i}" role="button" tabindex="0" aria-label="Ver el mapa 3D de ${esc(s.n)}"><div><b>Ver mapa 3D</b><small>Relieve, pistas y remontes. Elige una pista y recórrela con el dron.</small></div><span class="fly" aria-hidden="true">${ic('play')}</span></div>
 <p class="credit">Pistas con el nombre y el color oficiales de la estación; trazados de OpenStreetMap. Mapa: relieve del IGN e imagen Copernicus Sentinel-2.</p><button class="btn go" style="margin-top:14px" data-c="traquear|${i}">${ic('go')}Grabar mi día aquí</button>
 <div id="psec">${pistesHtml(i)}</div>
 <h2>Líderes de la temporada</h2>${info.leaders.length?info.leaders.map((x,k)=>`<div class="row"><span class="pos">${k+1}</span>${av(x.alias)}<b style="font-weight:600">${esc(x.alias)}</b><span class="val">${fmt(x.v)} m</span></div>`).join(''):'<div class="empty">Nadie ha esquiado aquí todavía. Sé el primero.</div>'}
 <button class="btn gh" style="margin-top:14px" data-c="rankOf|${s.n}">Ver clasificación completa</button>`)}
// Pistas de la estación (las que lista el mapa 3D, de scripts/gen_pistas.js), por color; cada una abre el 3D en ella
let PI={};fetch('/img/pistas.json?v=2').then(r=>r.json()).then(j=>{PI=j;const e=$('#psec');if(e&&st.fi)e.innerHTML=pistesHtml(st.fi)}).catch(()=>{});
const slug=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');   // el mismo que el motor 3D (?pista=)
const DC={v:['Verdes','g'],a:['Azules','b'],r:['Rojas','r'],n:['Negras','k'],i:['Itinerarios','fr']};
// Cada pista abre su ficha (récords y 3D). Con el pasaporte: cuántas lleva selladas y el filtro «Me faltan» (las pendientes)
function pistesHtml(i){const all=PI[i]||[];if(!all.length)return '';const got=ppOf(i),f=st.pf||'',l=all.filter(p=>!f||(f==='pend'?!got.has(p[0]):p[1]===f)),n=k=>all.filter(p=>p[1]===k).length,lim=st.pall?l.length:8;
 const done=all.filter(p=>got.has(p[0])).length,pend=all.length-done;
 return `<h2>Pistas</h2>${done?`<button class="ppline" data-c="ppView|${i}"><span><b>${done} de ${all.length}</b> en tu pasaporte</span><small>${Math.round(done/all.length*100)} %</small><div class="bar"><i style="width:${done/all.length*100}%"></i></div></button>`:`<p class="ppnote">${ic('map')}Cada pista que bajes con el GPS queda sellada en tu pasaporte.</p>`}
 <div class="pills">${[['','Todas',all.length],...Object.keys(DC).filter(n).map(k=>[k,DC[k][0],n(k)]),...(done&&pend?[['pend','Me faltan',pend]]:[])].map(([k,t,c])=>`<button class="${f===k?'on':''}" data-c="pisteF|${i}|${k}">${k&&k!=='pend'?`<i class="sg" style="--c:var(--${DC[k][1]})"></i>`:''}${t} ${c}</button>`).join('')}</div>
 <div class="psts">${l.slice(0,lim).map(p=>{const g=got.get(p[0]);return `<button class="pst" data-c="pisteView|${i}|${esc(p[0])}"><i class="sg" style="--c:var(--${DC[p[1]][1]})"></i><span>${esc(p[0])}</span>${g?`<small class="got">${ic('check')}${g[2]}</small>`:'<small>Récords</small>'}</button>`}).join('')}</div>
 ${l.length>lim?`<button class="btn gh" data-c="pisteAll|${i}">Ver las ${l.length} pistas</button>`:''}`}
function pisteF(i,k){st.pf=k;st.pall=false;$('#psec').innerHTML=pistesHtml(i)}
function pisteAll(i){st.pall=true;$('#psec').innerHTML=pistesHtml(i)}
// ---------- pasaporte de pistas y récords por pista ----------
// Pasaporte: cada pista bajada con el GPS (al menos 100 m por ella) queda sellada. El progreso se mide contra la lista de la
// ficha de cada estación (pistas.json, con los nombres y colores oficiales); las coronas son las pistas en las que el usuario
// es el más rápido o el que más bajadas lleva esta temporada (GET /api/passport)
const PCV={v:'g',a:'b',r:'r',n:'k',i:'fr',f:'fr'},PNM={v:'verde',a:'azul',r:'roja',n:'negra',i:'itinerario',f:'itinerario'},PPL={v:'verdes',a:'azules',r:'rojas',n:'negras',i:'itinerarios'};
const pcol=c=>`var(--${PCV[c]||'mu'})`,dshort=t=>new Date(t).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'});
const ppOf=id=>new Map(((PP&&PP.stations[id])||[]).map(r=>[r[0],r]));
function ppStat(id){const L=PI[id]||[],got=ppOf(id),by={};let done=0;for(const p of L){const b=by[p[1]]||(by[p[1]]={t:0,d:0});b.t++;if(got.has(p[0])){b.d++;done++}}return {L,got,done,total:L.length,by}}
const ppIds=()=>S.map(s=>s.id).filter(id=>ppStat(id).done);
const ppTotal=()=>ppIds().reduce((a,id)=>a+ppStat(id).done,0);
const ppFull=()=>ppIds().filter(id=>{const x=ppStat(id);return x.total&&x.done===x.total});
// El siguiente sello: el color al que menos le falta (a igualdad, el ya empezado); si no queda ninguno, la estación entera
function ppNext(id){const x=ppStat(id),c=Object.entries(x.by).filter(([k,b])=>b.d<b.t).sort((a,b)=>(a[1].t-a[1].d)-(b[1].t-b[1].d)||b[1].d-a[1].d)[0];
 if(c){const f=c[1].t-c[1].d;return `Te ${f===1?'falta 1':'faltan '+f} ${f===1?(c[0]==='i'?'itinerario':PNM[c[0]]):PPL[c[0]]} para sellar todas las ${PPL[c[0]]} de ${esc(SM[id].n)}.`}
 const f=x.total-x.done;return f?`Te ${f===1?'falta 1 pista':'faltan '+f+' pistas'} para completar ${esc(SM[id].n)}.`:'Has bajado todas las pistas de la estación.'}
function ppCard(){if(!PP)return '';const ids=ppIds(),tot=ppTotal(),full=ppFull().length,cr=PP.crowns?PP.crowns.v.length+PP.crowns.n.length:0;
 if(!ids.length)return `<h2>Pasaporte de pistas</h2><div class="card ppempty">${ic('map')}<div><b>Tu pasaporte está en blanco</b><small>Cada pista que bajes con el GPS queda sellada aquí. Completa los colores de cada estación y gana sus sellos.</small></div></div>`;
 return `<h2>Pasaporte de pistas</h2><div class="pass ppass"><div class="pass-head"><span>Pasaporte</span><span>${PP.rank?`${PP.rank.pos}.º de ${PP.rank.total} coleccionistas`:''}</span></div>
  <b class="pass-num">${tot}</b><span class="pass-unit">${tot===1?'pista sellada':'pistas selladas'} en ${ids.length} ${ids.length===1?'estación':'estaciones'}</span>
  <div class="pass-row"><div><b>${full}</b><small>${full===1?'completa':'completas'}</small></div><div><b>${cr}</b><small>${cr===1?'corona':'coronas'}</small></div><div><b>${ids.length}/${S.length}</b><small>estaciones</small></div></div></div>
  <div class="card" style="padding:4px 14px">${ids.map(id=>{const x=ppStat(id);return `<button class="pprow" data-c="ppView|${id}"><span class="ppn"><b>${esc(SM[id].n)}</b><small>${x.done} de ${x.total}</small></span><span class="ppbar">${['v','a','r','n','i'].filter(k=>x.by[k]).map(k=>`<i style="flex:${x.by[k].t};--c:${pcol(k)};--p:${x.by[k].d/x.by[k].t*100}%"></i>`).join('')}</span></button>`}).join('')}</div>`}
function ppView(id){const s=SM[id],x=ppStat(id),pct=x.total?Math.round(x.done/x.total*100):0,cr=(PP&&PP.crowns)||{v:[],n:[]},mine=k=>cr[k].filter(c=>c[0]===id);
 const seal=(k,b)=>`<div class="seal ${b.d===b.t?'on':''}" style="--c:${pcol(k)}"><i></i><b>${b.d===b.t?'Sellado':b.d+'/'+b.t}</b><small>${k==='i'?'Itinerarios':'Todas las '+PPL[k]}</small></div>`;
 const row=(p,g)=>`<button class="pst" data-c="pisteView|${id}|${esc(p[0])}"><i class="sg" style="--c:${pcol(p[1])}"></i><span>${esc(p[0])}</span>${g?`<small class="got">${ic('check')}${g[2]}${g[4]?` · ${g[4]} km/h`:''}</small>`:'<small>Pendiente</small>'}</button>`;
 const pend=x.L.filter(p=>!x.got.has(p[0])),done=x.L.filter(p=>x.got.has(p[0])).sort((a,b)=>x.got.get(b[0])[2]-x.got.get(a[0])[2]);
 ov(`<div class="photo" style="background-image:${photo(id)}"><div class="eyebrow">Pasaporte de pistas</div><h1>${esc(s.n)}</h1></div>
 <div class="ppbig"><div class="ring" style="--p:${pct*3.6}deg"><b><span>${pct}<small> %</small></span></b></div><div><b>${x.done} de ${x.total} pistas</b><small>${ppNext(id)}</small></div></div>
 <div class="seals">${['v','a','r','n','i'].filter(k=>x.by[k]).map(k=>seal(k,x.by[k])).join('')}<div class="seal ${x.total&&x.done===x.total?'on':''}" style="--c:var(--or)"><i></i><b>${x.done===x.total?'Sellado':x.total-x.done+' por bajar'}</b><small>Estación completa</small></div></div>
 ${mine('v').length+mine('n').length?`<div class="card crowns">${mine('v').map(c=>`<div>${ic('crown')}<span><b>${esc(c[1])}</b>El más rápido de la temporada: ${c[2]} km/h</span></div>`).join('')}${mine('n').map(c=>`<div>${ic('crown')}<span><b>${esc(c[1])}</b>Quien más la ha bajado esta temporada: ${c[2]} veces</span></div>`).join('')}</div>`:''}
 ${pend.length?`<h2>Por sellar (${pend.length})</h2><div class="psts">${pend.map(p=>row(p)).join('')}</div>`:''}
 ${done.length?`<h2>Selladas (${done.length})</h2><div class="psts">${done.map(p=>row(p,x.got.get(p[0]))).join('')}</div>`:''}
 <button class="btn gh" data-c="ficha|${id}">Ficha de ${esc(s.n)}</button>`)}
// Ficha de una pista: si está sellada y las dos clasificaciones de la temporada (velocidad máxima y bajadas)
async function pisteView(i,name){const s=SM[i];if(!s)return;ov(`<div class="top" style="padding-top:60px"><div class="eyebrow">${esc(s.n)}</div><h1>${esc(name)}</h1></div><div class="empty">Cargando…</div>`);
 try{const r=await api('piste?'+new URLSearchParams({station:i,name}));st.pv={i,name,r,tab:st.pv&&st.pv.tab||'v'};pvPaint()}catch(e){flash(e.message)}}
function pvTab(k){if(st.pv){st.pv.tab=k;pvPaint()}}
function pvPaint(){const{i,name,r,tab}=st.pv,s=SM[i],c=r.c||(PI[i]||[]).reduce((a,p)=>p[0]===name?p[1]:a,'a'),m=r.mine,L=tab==='v'?r.speed:r.runs,pos=tab==='v'?r.me.posV:r.me.posN,it=c==='i'||c==='f';
 const rows=L.map(x=>`<div class="row ${x.me?'me':''}"><span class="pos ${x.pos===1?'crown':''}">${x.pos===1?ic('crown'):x.pos}</span>${av(x.alias,x.avatar)}<b style="font-weight:600">${esc(x.alias)}</b><span class="val">${tab==='v'?x.v+' km/h':x.v+' '+(x.v===1?'bajada':'bajadas')}</span></div>`).join('');
 const sc=$('.ov')?$('.ov').scrollTop:0;
 ov(`<button class="link back" data-c="ficha|${i}">${ic('back')}${esc(s.n)}</button>
 <div class="top" style="padding-top:6px"><h1 class="ptitle"><i class="sg" style="--c:${pcol(c)}"></i>${esc(name)}</h1><p class="mu">${it?'Itinerario: balizado, sin pisar':'Pista '+PNM[c]}${r.skiers?` · ${r.skiers} ${r.skiers===1?'esquiador':'esquiadores'} esta temporada`:''}</p></div>
 ${m?`<div class="card stamp">${ic('check')}<div><b>Sellada en tu pasaporte</b><small>Desde el ${dshort(m.t)} · ${m.n} ${m.n===1?'bajada':'bajadas'}${m.v?` · tu máxima, ${m.v} km/h`:''}</small></div></div>`
  :`<div class="card stamp off">${ic('map')}<div><b>Aún sin sellar</b><small>Bájala con el GPS encendido y quedará en tu pasaporte.</small></div></div>`}
 <h2>Récords de la temporada</h2><div class="seg"><button class="${tab==='v'?'on':''}" data-c="pvTab|v">Velocidad máxima</button><button class="${tab==='n'?'on':''}" data-c="pvTab|n">Más bajadas</button></div>
 ${rows||`<div class="empty">${tab==='v'?'Nadie ha marcado aún velocidad aquí esta temporada.':'Nadie la ha bajado aún esta temporada.'} La corona espera dueño.</div>`}
 ${pos>10?`<div class="row me"><span class="pos">${pos}</span>${av(st.user.alias,st.user.avatar)}<b style="font-weight:600">Tú</b><span class="val">${tab==='v'?r.me.v+' km/h':r.me.n+' '+(r.me.n===1?'bajada':'bajadas')}</span></div>`:''}
 ${L.length&&pos!==1&&L[0]?`<p class="mu gap">${pos?`Para la corona: ${tab==='v'?`${L[0].v-r.me.v} km/h más`:`${L[0].v-r.me.n} ${L[0].v-r.me.n===1?'bajada':'bajadas'} más`}.`:''}</p>`:''}
 <button class="btn gh" style="margin-top:16px" data-c="open3d|${i}|${slug(name)}">${ic('play')}Ver la pista en 3D</button>
 <p class="credit" style="margin-top:12px">Velocidad del GPS del móvil, la mantenida dos segundos seguidos, y solo de días grabados con GPS. Una pista no es un circuito: esquía a la velocidad que puedas controlar y respeta a quien va delante.</p>`);
 if(sc&&$('.ov'))$('.ov').scrollTop=sc}
// Récords de una estación en la pestaña Récords: el más rápido de cada pista
function recPistes(){const r=st.rk2,s=S.find(x=>x.n===st.amb);if(!s)return '';
 if(!r)return `<h2>Récords por pista</h2><div class="empty">Cargando…</div>`;
 return `<h2>Récords por pista</h2><p class="mu" style="margin:-4px 0 10px;font-size:14px">El más rápido de cada pista esta temporada. Toca una para ver su clasificación.</p>`+(r.length?`<div class="card" style="padding:2px 14px">${r.map(x=>`<button class="pst rec" data-c="pisteView|${s.id}|${esc(x.name)}"><i class="sg" style="--c:${pcol(x.c)}"></i><span>${esc(x.name)}</span><small class="${x.v&&x.v.me?'mine':''}">${x.v?`${x.v.me?ic('crown'):''}${esc(x.v.me?'Tú':x.v.alias)} · <b>${x.v.v} km/h</b>`:`${x.n.n} ${x.n.n===1?'bajada':'bajadas'}`}</small></button>`).join('')}</div>`
  :`<div class="empty">Aún no hay récords en ${esc(s.n)}. Graba un día y estrena los suyos.</div>`)}
// ---------- Pistea Wrapped: la temporada en historias (GET /api/wrapped) ----------
// Una pantalla por idea, que pasa sola (7 s) o tocando a izquierda y derecha; el pico es la velocidad y el tipo de esquiador, y
// el final, la tarjeta para compartir
const RUTA=[[621,'Madrid y Barcelona'],[420,'Madrid y Granada'],[355,'Madrid y Valencia'],[315,'Madrid y Zaragoza'],[213,'Madrid y Valladolid'],[110,'Madrid y Ávila'],[92,'Madrid y Segovia'],[72,'Madrid y Toledo']];
const pctTxt=x=>Math.round(x*100)+' %';
// El tipo de esquiador, por dónde reparte sus metros (desglose de cada día), su máxima y cuántas estaciones
function persona(d){const m=d.m||{},t=['v','a','r','n','f'].reduce((a,k)=>a+(m[k]||0),0);
 if(t>=500){const f=(m.f||0)/t,n=(m.n||0)/t,r=(m.r||0)/t,a=(m.a||0)/t;
  if(f>=.15)return ['Alma freeride',`Donde otros ven nieve virgen, tú ves tu línea: el ${pctTxt(f)} de tus metros, fuera de pista.`];
  if(n>=.25)return ['Cazanegras',`Las negras te llaman por tu nombre: el ${pctTxt(n)} de tus metros.`];
  if(d.vmax>=80)return ['Misil',`Pasaste de ${Math.floor(d.vmax/10)*10} km/h. Rápido y con cabeza.`];
  if(d.stations>=4)return ['Trotamontes',`${d.stations} estaciones esta temporada: tu mapa tiene nieve por todas partes.`];
  if(r>=.3)return ['Devorarrojas',`Tu terreno: las rojas, el ${pctTxt(r)} de tus metros.`];
  if(a>=.3)return ['Crucero azul',`Ritmo, curvas y azules sin fin: el ${pctTxt(a)} de tus metros.`];
  return ['En pleno despegue','Cada día un poco más: las verdes ya se te quedan cortas.']}
 if(d.vmax>=80)return ['Misil',`Pasaste de ${Math.floor(d.vmax/10)*10} km/h. Rápido y con cabeza.`];
 return d.stations>=4?['Trotamontes',`${d.stations} estaciones esta temporada.`]:['Esquiador de raza','Días de nieve, piernas y sonrisa. Así se hace una temporada.']}
function wrSlides(d){const SN=id=>esc((SM[id]||{n:id}).n),out=[],add=(k,h,s='')=>out.push({k,h,s}),y=new Date(d.since).getUTCFullYear(),ev=d.desnivel/8849,ru=RUTA.find(x=>d.km>=x[0]),pe=persona(d),cr=PP&&PP.crowns?PP.crowns.v.length+PP.crowns.n.length:0;
 add('nv',`<div class="wr-e">Pistea Wrapped</div><div class="wr-h">Tu temporada ${String(y).slice(2)}/${String(y+1).slice(2)}</div><div class="wr-t">${esc(d.alias.split(' ')[0])}, esto es lo que has hecho en la nieve.</div><div class="wr-hint">Toca para avanzar</div>`);
 add('or',`<div class="wr-e">Has esquiado</div><div class="wr-big">${d.dias}</div><div class="wr-u">${d.dias===1?'día':'días'}</div><div class="wr-t">y has bajado <b>${fmt(d.desnivel)} m</b> de desnivel: ${ev>=1.05?`<b>${dec(ev)} veces</b> la altura del Everest`:ev>=.5?`más de <b>medio Everest</b>`:`<b>${Math.max(1,Math.round(d.desnivel/330))} ${Math.round(d.desnivel/330)<=1?'vez':'veces'}</b> la Torre Eiffel`}.</div>`);
 add('bl',`<div class="wr-e">Sobre la nieve</div><div class="wr-big">${fmt(d.km)}</div><div class="wr-u">kilómetros</div><div class="wr-t">${ru?`Más que la distancia entre <b>${ru[1]}</b>.`:d.km>=4.5?`<b>${fmt(d.km/4.5)} ${d.km/4.5<1.5?'vuelta':'vueltas'}</b> al Retiro.`:'Los primeros kilómetros: los que más se recuerdan.'}</div><div class="wr-row"><div><b>${fmt(d.bajadas)}</b><small>bajadas</small></div><div><b>${dec(d.horas)}</b><small>horas esquiando</small></div>${d.freeride>=.1?`<div><b>${dec(d.freeride)}</b><small>km de freeride</small></div>`:''}</div>`);
 add('ph',`<div class="wr-e">Tu estación</div><div class="wr-h big">${SN(d.top.station)}</div><div class="wr-t"><b>${d.top.dias} de tus ${d.dias} días</b> fueron aquí.${d.stations>1?` Y has pisado <b>${d.stations} estaciones</b> esta temporada.`:''}</div>`,`background-image:linear-gradient(180deg,rgba(9,30,52,.15),rgba(9,30,52,.9)),${photo(d.top.station)}`);
 if(d.fav)add('pc',`<div class="wr-e">Tu pista</div><div class="wr-h big">${esc(d.fav.name)}</div><div class="wr-t">${SN(d.fav.station)} · ${d.fav.c==='f'||d.fav.c==='i'?'itinerario':'pista '+PNM[d.fav.c]}</div><div class="wr-big">${d.fav.n}</div><div class="wr-u">${d.fav.n===1?'vez la bajaste':'veces la bajaste'}</div>`,`--pc:${pcol(d.fav.c)}`);   // fondo: el color de la pista (index.html, .wr.pc)
 const fp=d.fast,diff=fp&&Math.abs(fp.v-d.vmax)>2;
 add('bk',`<div class="wr-e">Tu velocidad máxima</div><div class="wr-big">${Math.round(d.vmax)}</div><div class="wr-u">km/h</div><div class="wr-t">${fp?(diff?`Y <b>${fp.v} km/h</b> en ${esc(fp.name)}, tu pista más rápida.`:`En <b>${esc(fp.name)}</b>, ${SN(fp.station)}.`):`En ${SN(d.vmaxAt.station)}.`}</div>${fp&&fp.pos?`<div class="wr-badge">${fp.pos===1?`${ic('crown')}${fp.total>1?'Nadie ha bajado más rápido por ella esta temporada':'Récord de la temporada en esa pista'}`:`${fp.pos}.º más rápido de ${fp.total} en esa pista`}</div>`:''}`);
 const m=d.m||{},mt=['v','a','r','n','f'].reduce((a,k)=>a+(m[k]||0),0);
 add('sn',`<div class="wr-e">Eres</div><div class="wr-h big">${pe[0]}</div><div class="wr-t">${pe[1]}</div>${mt>=500?`<div class="wr-stack">${['v','a','r','n','f'].filter(k=>m[k]).map(k=>`<i style="flex:${m[k]};background:${pcol(k)}"></i>`).join('')}</div><div class="wr-legs">${['v','a','r','n','f'].filter(k=>m[k]/mt>=.03).map(k=>`<span style="--c:${pcol(k)}"><i></i>${k==='f'?'Freeride':cap(PPL[k])} ${pctTxt(m[k]/mt)}</span>`).join('')}</div>`:''}`);
 add('bl',`<div class="wr-e">Tu mejor día</div><div class="wr-h">${cap(new Date(d.best.ts).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}))}</div><div class="wr-t">en ${SN(d.best.station)}</div><div class="wr-big">${fmt(d.best.desnivel)}</div><div class="wr-u">metros de desnivel</div><div class="wr-t">${d.best.bajadas} bajadas y ${dec(d.best.km)} km. Un día para enmarcar.</div>`);
 if(d.pistes)add('gr',`<div class="wr-e">Tu pasaporte</div><div class="wr-big">${d.pistes}</div><div class="wr-u">${d.pistes===1?'pista sellada':'pistas selladas'}</div><div class="wr-t">${cr?`Y <b>${cr} ${cr===1?'corona':'coronas'}</b>: pistas en las que nadie te gana esta temporada.`:'Cada pista nueva, un sello más. La próxima temporada, a por las que faltan.'}</div>`);
 if(d.pos&&d.pos.total>1)add('or',`<div class="wr-e">En Pistea</div><div class="wr-h big">${d.pos.pos===1?'Número 1':'Top '+Math.max(1,Math.ceil(d.pos.pos/d.pos.total*100))+' %'}</div><div class="wr-t">${d.pos.pos===1?'Nadie ha bajado más desnivel que tú en España esta temporada.':`Puesto <b>${d.pos.pos}</b> de ${d.pos.total} esquiadores de España en desnivel.`}</div>`);
 add('nv',`<div class="wr-e">Pistea Wrapped · ${y}-${String(y+1).slice(2)}</div><div class="wr-h">${esc(d.alias)}</div><div class="wr-card"><div><b>${fmt(d.desnivel)}</b><small>m de desnivel</small></div><div><b>${d.dias}</b><small>${d.dias===1?'día':'días'}</small></div><div><b>${fmt(d.km)}</b><small>km</small></div><div><b>${Math.round(d.vmax)}</b><small>km/h máx.</small></div></div><div class="wr-t">Eres <b>${pe[0]}</b>${d.fav?` · tu pista, <b>${esc(d.fav.name)}</b>`:''}</div>
  <button class="btn go" data-c="wrShare">Compartir mi temporada</button><button class="btn gh wr-again" data-c="wrAgain">Ver otra vez</button>`);
 return out}
async function wrapped(){try{const d=await api('wrapped');if(d.empty){flash('Graba tu primer día de esta temporada y aquí tendrás tu resumen.');return}st.wr={d,i:0,s:wrSlides(d)};wrShow()}catch(e){flash(e.message)}}
// Cada historia dura WR_MS; mantener pulsado la pausa (como en cualquier app de historias) y una pulsación larga no pasa de
// historia. También se pausa si la app queda en segundo plano
const WR_MS=7000;let WS=0,WR=WR_MS;
function wrRun(ms){clearTimeout(WT);const w=st.wr;if(!w||w.i>=w.s.length-1)return;WS=Date.now();WR=ms;WT=setTimeout(wrNext,ms)}
function wrPause(){const e=$('#wr'),w=st.wr;if(!e||!w||w.paused)return;clearTimeout(WT);WR=Math.max(300,WR-(Date.now()-WS));w.paused=true;e.classList.add('paused')}
function wrResume(){const e=$('#wr'),w=st.wr;if(!e||!w||!w.paused)return;w.paused=false;e.classList.remove('paused');wrRun(WR)}
function wrTap(dir){const w=st.wr;if(!w)return;if(w.held){w.held=false;return}dir==='l'?wrPrev():wrNext()}
document.addEventListener('pointerdown',e=>{if(st.wr&&e.target.closest&&e.target.closest('#wr')&&!e.target.closest('.wr-x,.btn')){st.wr.pd=Date.now();wrPause()}});
const wrUp=()=>{const w=st.wr;if(w&&w.pd){w.held=Date.now()-w.pd>350;w.pd=0;wrResume()}};
document.addEventListener('pointerup',wrUp);document.addEventListener('pointercancel',wrUp);
document.addEventListener('visibilitychange',()=>{if(!st.wr)return;if(document.hidden)wrPause();else wrResume()});
function wrShow(){clearTimeout(WT);const w=st.wr,old=$('#wr');if(old)old.remove();if(!w)return;w.paused=false;w.held=false;const sl=w.s[w.i],last=w.i===w.s.length-1;
 $('#app').insertAdjacentHTML('beforeend',`<div id="wr" class="wr ${sl.k}" role="dialog" aria-modal="true" aria-label="Tu temporada en Pistea, historia ${w.i+1} de ${w.s.length}" tabindex="-1" style="${sl.s}">
 <div class="wr-bars" aria-hidden="true">${w.s.map((_,k)=>`<i class="${k<w.i?'done':k===w.i?'now':''}"></i>`).join('')}</div>
 <button class="wr-x" data-c="wrClose" aria-label="Cerrar">${ic('x')}</button>
 <div class="wr-sl" aria-live="polite">${sl.h}</div>
 ${last?(w.i?'<button class="wr-tap l only" data-c="wrTap|l" aria-label="Anterior"></button>':''):`<button class="wr-tap l" data-c="wrTap|l" aria-label="Anterior"></button><button class="wr-tap r" data-c="wrTap|r" aria-label="Siguiente"></button>`}</div>`);
 const e=$('#wr');if(e&&!e.contains(document.activeElement))e.focus({preventScroll:true});wrRun(WR_MS)}
function wrNext(){const w=st.wr;if(w&&w.i<w.s.length-1){w.i++;wrShow()}}
function wrPrev(){const w=st.wr;if(w&&w.i>0){w.i--;wrShow()}}
function wrClose(){clearTimeout(WT);const e=$('#wr');if(e)e.remove();st.wr=null}
function wrAgain(){if(st.wr){st.wr.i=0;wrShow()}}
// La tarjeta para compartir (1080 × 1920, como las historias)
async function wrShare(){const d=st.wr&&st.wr.d;if(!d)return;const c=document.createElement('canvas');c.width=1080;c.height=1920;const g=c.getContext('2d'),pe=persona(d),y=new Date(d.since).getUTCFullYear();
 try{await Promise.all([document.fonts.load('700 120px Cond'),document.fonts.load('600 40px Barlow'),document.fonts.load('500 40px Barlow')])}catch(e){}
 const CD='Cond, "Arial Narrow", sans-serif',BR='Barlow, system-ui, sans-serif',OR='#ff5a1f';
 const gr=g.createLinearGradient(0,0,1080,1920);gr.addColorStop(0,'#0f2a44');gr.addColorStop(1,'#16466f');g.fillStyle=gr;g.fillRect(0,0,1080,1920);
 g.fillStyle='rgba(255,255,255,.06)';g.beginPath();g.arc(960,260,330,0,7);g.fill();g.beginPath();g.arc(120,1650,260,0,7);g.fill();
 g.fillStyle='#fff';g.font='700 50px '+CD;g.fillText('Pistea Wrapped',80,130);g.fillStyle='rgba(255,255,255,.75)';g.font='500 40px '+BR;g.fillText(`Temporada ${String(y).slice(2)}/${String(y+1).slice(2)} · ${d.alias}`,80,190);
 g.fillStyle=OR;g.font='700 230px '+CD;g.fillText(fmt(d.desnivel),70,470);g.fillStyle='#fff';g.font='600 46px '+BR;g.fillText('metros de desnivel',80,540);
 const K=[[String(d.dias),d.dias===1?'día':'días'],[fmt(d.km),'km'],[Math.round(d.vmax)+'','km/h máx.'],[String(d.pistes||d.stations),d.pistes?'pistas selladas':'estaciones']];
 K.forEach((q,i)=>{const X=80+(i%2)*480,Y=740+Math.floor(i/2)*200;g.fillStyle='#fff';g.font='700 110px '+CD;g.fillText(q[0],X,Y);g.fillStyle='rgba(255,255,255,.75)';g.font='500 40px '+BR;g.fillText(q[1],X,Y+56)});
 g.fillStyle='rgba(255,255,255,.12)';g.fillRect(80,1110,920,1);
 g.fillStyle='rgba(255,255,255,.75)';g.font='500 40px '+BR;g.fillText('Soy',80,1210);g.fillStyle='#fff';g.font='700 120px '+CD;g.fillText(pe[0],76,1330);
 if(d.fav){g.fillStyle='rgba(255,255,255,.75)';g.font='500 40px '+BR;g.fillText('Mi pista',80,1450);g.fillStyle='#fff';g.font='700 76px '+CD;g.fillText(d.fav.name.slice(0,24),80,1530);g.fillStyle='rgba(255,255,255,.75)';g.font='500 38px '+BR;g.fillText(`${(SM[d.fav.station]||{n:''}).n} · ${d.fav.n} ${d.fav.n===1?'bajada':'bajadas'}`,80,1590)}
 g.fillStyle='rgba(255,255,255,.75)';g.font='500 36px '+BR;g.fillText('pistea.vercel.app',80,1850);
 c.toBlob(async b=>{const f=new File([b],'pistea_temporada.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:'Mi temporada en Pistea'});return}catch(e){if(e.name==='AbortError')return}}const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='pistea_temporada.png';a.click()})}
const wrCard=()=>st.me&&st.me.seasonDays>0?`<button class="wrc" data-c="wrapped"><span><small>Pistea Wrapped</small><b>Tu temporada, en historias</b><em>${st.me.seasonDays} ${st.me.seasonDays===1?'día':'días'} · tu pista, tu velocidad y tu tipo de esquiador</em></span>${ic('play')}</button>`:'';
// Mapa 3D a pantalla completa. Va en el documento, fuera de #app, para usar todo el ancho. Deja una entrada en el historial para
// que «atrás» (también el del móvil) lo cierre; el motor no añade las suyas (sus fichas se cierran con su propio botón), o su
// «atrás» al cerrar una pista se llevaría también esa entrada y cerraría el mapa entero.
function open3d(i,p){const s=SM[i];if(!s)return;const old=$('#v3d');if(old)old.remove();const q=new URLSearchParams({estacion:i});if(p)q.set('pista',p);
 document.body.insertAdjacentHTML('beforeend',`<div id="v3d" role="dialog" aria-modal="true" aria-label="Mapa 3D de ${esc(s.n)}"><header><button class="v3d-back" data-c="close3d" aria-label="Volver a ${esc(s.n)}">${ic('back')}<span>${esc(s.n)}</span></button><button class="v3d-go" data-c="go3d|${i}">${ic('go')}Grabar aquí</button></header><iframe src="${esc(st.maps||'/3d/')}?${q}" title="Mapa 3D de ${esc(s.n)}" allow="fullscreen; geolocation"></iframe></div>`);
 const f=$('#v3d iframe');f.addEventListener('load',()=>{try{const h=f.contentWindow.history;h.pushState=(_s,t,u)=>h.replaceState(null,t,u)}catch(e){}});
 if(!(history.state&&history.state.v3d))try{history.pushState({v3d:1},'')}catch(e){}}
function close3d(){const v=$('#v3d');if(v)v.remove();if(history.state&&history.state.v3d)history.back()}
function go3d(i){close3d();if(st.rec&&SM[st.rec.station]){ov0();tab('est');return flash('Tienes un día sin guardar. Guárdalo o descártalo antes de empezar otro.')}traquear(i)}
addEventListener('popstate',()=>{if(!(history.state&&history.state.v3d)){const v=$('#v3d');if(v)v.remove()}});
function ov0(){clearInterval(T);stopW();st.drView=null;const o=$('.ov');if(o)o.remove();st.rec=recLoad();if(st.me)render()}
function elegir(){if(st.rec&&SM[st.rec.station]){tab('est');return flash('Tienes un día sin guardar. Guárdalo o descártalo antes de empezar otro.')}ov(`<div class="top" style="padding-top:60px"><h1>¿Dónde esquías hoy?</h1><p class="mu" style="margin-top:6px">Elige la estación y empieza a grabar.</p></div>${st.sim&&!NAT?`<label style="display:flex;gap:10px;align-items:center;color:var(--tx);margin:0 0 14px"><input type="checkbox" id="real" style="width:auto"> Usar el GPS de este dispositivo (experimental)</label>`:''}<div class="grid">${S.map(s=>stCard(s,'traquear')).join('')}</div>`)}
function traquear(i){const s=SM[i];const rc=$('#real');if(rc)st.real=rc.checked;if(!st.sim||NAT)st.real=true;let c=3;stationFor(i);ov(`<div class="speed"><small>${s.n}</small><div class="n" id="sp">${c}</div><small>Preparando GPS…</small></div>`);
 const cd=setInterval(()=>{c--;if(c>0){$('#sp').textContent=c;return}clearInterval(cd);st.real?runReal(s):run(s)},800)}
// Simulación de GPS: en la app real, estos datos vienen del grabador nativo.
function run(s){let t=0,v=0,max=0,desc=0,bj=0,sum=0,ns=0,col={v:0,a:0,r:0,n:0},ph='sube',x=0,y=0;const tr=[[0,0]],sp=[];
 ov(`<div class="speed"><small>${s.n} · Grabando</small><div class="n" id="sp">0</div><small>km/h</small>
 <div class="kpis" style="margin:36px 0 14px;text-align:left"><div><b id="k1">0</b><small>m desnivel</small></div><div><b id="k2">0</b><small>bajadas</small></div><div><b id="k3">0:00</b><small>tiempo</small></div></div>
 <div class="card" id="sl" style="text-align:left">En el remonte</div><button class="btn" id="fin">Terminar el día</button></div>`);
 T=setInterval(()=>{t++;if(ph==='sube'){v=8+Math.random()*3;if(t%5===0){ph='baja';bj++;const c=['v','a','r','n'][Math.floor(Math.random()*4)];col[c]++;$('#sl').textContent='Bajada '+bj+' · pista '+{v:'verde',a:'azul',r:'roja',n:'negra'}[c]}}else{v=Math.min(v+6+Math.random()*9,70+Math.random()*30);desc+=v*.22;sum+=v;ns++;x+=3+Math.random()*5;y+=2+Math.random()*4;if(tr.length<60)tr.push([x,y]);if(t%5===3){ph='sube';$('#sl').textContent='En el remonte'}}max=Math.max(max,v);if(sp.length<400)sp.push(Math.round(v));
  $('#sp').textContent=Math.round(v);$('#k1').textContent=fmt(desc);$('#k2').textContent=bj;$('#k3').textContent=Math.floor(t/60)+':'+String(t%60).padStart(2,'0')},500);
 $('#fin').onclick=()=>{clearInterval(T);const d=desc*18+4000,k={v:col.v+4,a:col.a+5,r:col.r+4,n:col.n+1};saveDay(s,{station:s.id,desnivel:d,km:d/190,horas:3.4+Math.random(),bajadas:bj+12,vmax:Math.max(max,62),vmed:ns?sum/ns:30,col:k,track:tr,speed:sp,source:'sim'},$('#fin'))}}
async function saveDay(s,body,btn,after){btn.disabled=true;btn.textContent='Guardando…';try{const r=await api('days',{body});if(after)after();await refresh();resumen(s,r)}catch(e){btn.disabled=false;flash(e.message);
 // Rechazo definitivo (grabación corta, sin bajadas, fuera de la estación, ya guardado…): reintentar no sirve, se ofrece descartar
 if(after&&e.status>=400&&e.status<500&&e.status!==429){btn.textContent='Descartar el día';btn.onclick=()=>{after();ov0();render()}}else btn.textContent='Reintentar guardado'}}
// ---- Grabación real. En la app de Android la hace el grabador nativo (sigue con el teléfono bloqueado y apunta cada posición en un
// fichero); en un navegador, el GPS de la página. Las posiciones se guardan en el dispositivo mientras dura el día: si la app
// se cierra, se queda sin batería o falla la subida, el día se recupera desde el aviso de la portada.
const NAT=window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()?window.Capacitor.Plugins.Grabador:null;
const REC='pistea_rec',recLoad=()=>{try{return JSON.parse(localStorage.getItem(REC))}catch(e){return null}},recSave=r=>{try{localStorage.setItem(REC,JSON.stringify(r))}catch(e){}},recClear=()=>{try{localStorage.removeItem(REC)}catch(e){}};
const stopW=()=>{if(W){const f=W;W=null;try{f()}catch(e){}}curSave=null};
addEventListener('pagehide',()=>{if(curSave)curSave()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&curSave)curSave()});
const parseNat=row=>{const[t,lat,lon,acc,v,vacc,dir,dacc,alt,,,mk]=row.split(','),n=x=>x===''||x===undefined?null:+x;if(n(lat)==null||n(lon)==null||n(t)==null)return null;return{t:+t,lat:+lat,lon:+lon,alt:n(alt),acc:n(acc)??99,v:n(v),vacc:n(vacc),dir:n(dir),dacc:n(dacc),mock:mk==='1'}};
// Lo que el motor del día sabe de cada estación (pistas, remontes y proyección) y su relieve, que es el del mapa 3D. Se pide al
// empezar a grabar (va en la caché del navegador); sin conexión se graba igual y al guardar el servidor lo calcula todo
const STN={};
function stationFor(id){return STN[id]||(STN[id]=(async()=>{const pk=await(await fetch('/seg/'+id+'.json')).json();let q=null;
 try{const r=await fetch('/3d/estaciones/'+id+'/data/dem.u16d');if(r.ok&&window.DecompressionStream)q=heights(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())}catch(e){}
 return fromPack(pk,q)})().catch(()=>{delete STN[id];return null}))}
const upTo=(p,ms)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(null),ms))]);
const fxIn=a=>({t:a[0],lat:a[1],lon:a[2],alt:a[3],acc:a[4],v:a[5],dir:a[6]??null});   // una posición guardada en el navegador
async function runReal(s,rs){
 ov(`<div class="speed"><small>${s.n}</small><div class="n" id="sp">…</div><small>Cargando el mapa de pistas…</small></div>`);
 const SN=await upTo(stationFor(s.id),8000);   // sin el mapa (sin conexión) se graba igual: el servidor lo calcula al guardar
 const C=new Calc(SN),raw=[],add=f=>{C.add(f);raw.push(f)},t0=rs?rs.t0:Date.now();let id=rs&&rs.id,fx=rs&&!NAT?(rs.fx||[]):[],last=0,lock=null,sub=null,wid=null,next=0,ready=!NAT,pt=0;const q=[];
 const rec=()=>recSave({station:s.id,t0,native:!!NAT,id,fx:NAT?undefined:fx});
 ov(`<div class="speed"><small>${s.n} · GPS real</small><div class="n" id="sp">0</div><small>km/h</small><div class="kpis" style="margin:36px 0 14px;text-align:left"><div><b id="k1">0</b><small>m desnivel</small></div><div><b id="k2">0</b><small>bajadas</small></div><div><b id="k3">0:00</b><small>tiempo</small></div></div><div class="card live-st" id="sl" aria-live="polite">Esperando señal GPS…</div><button class="btn" id="fin">Terminar el día</button><small style="display:block;margin-top:12px">${SN?'':'Sin el mapa de pistas: se graba igual y al guardar se reconocen las pistas y el freeride. '}Si cierras esta pantalla, el día queda guardado en el dispositivo y lo recuperas desde Estaciones.</small></div>`);
 // La velocidad, con cada posición; lo demás (bajadas, desnivel, dónde se está), como mucho una vez por segundo
 const paint=()=>{const e=$('#sp');if(!e)return;e.textContent=Math.round(C.v);if(Date.now()-pt<1000)return;pt=Date.now();$('#k1').textContent=fmt(C.desc);$('#k2').textContent=C.runs;const fr=SN?C.freeride:0;$('#sl').innerHTML=`${esc(C.status())}${fr>=50?`<small>Hoy, ${fr>=1000?dec(fr/1000)+' km':fmt(fr)+' m'} de freeride</small>`:''}`};
 T=setInterval(()=>{const e=$('#k3');if(!e)return;const t=Math.floor((Date.now()-t0)/1000);e.textContent=Math.floor(t/3600)?Math.floor(t/3600)+':'+String(Math.floor(t/60)%60).padStart(2,'0')+':'+String(t%60).padStart(2,'0'):Math.floor(t/60)+':'+String(t%60).padStart(2,'0')},1000);
 W=()=>{if(!NAT)rec();if(sub)sub.remove();if(wid!=null)navigator.geolocation.clearWatch(wid);if(lock&&lock.release)lock.release().catch(()=>{})};
 const fail=m=>{flash(m);ov0()};
 if(NAT){
  try{sub=await NAT.addListener('fix',({n,row})=>{if(!ready){q.push([n,row]);return}if(n<next)return;next=n+1;const f=parseNat(row);if(f){add(f);paint()}});
   const stt=await NAT.status();
   if(!(stt.recording&&rs&&rs.id)){const r=await NAT.start({since:t0});id=r.id}else id=rs.id;
   rec();const rd=await NAT.read({id,from:0});rd.rows.forEach(r=>{const f=parseNat(r);if(f)add(f)});next=rd.next;ready=true;q.forEach(([n,row])=>{if(n>=next){next=n+1;const f=parseNat(row);if(f)add(f)}});paint()}
  catch(e){return fail(e.code==='denied'?'Sin permiso de ubicación. Actívalo en los ajustes del teléfono.':e.code==='off'?'La ubicación del teléfono está apagada.':e.code==='approximate'?'Activa la ubicación precisa para Pistea.':'No se pudo empezar a grabar: '+(e.message||e))}
 }else{
  if(!navigator.geolocation)return fail('Este dispositivo no tiene GPS.');
  fx.forEach(a=>add(fxIn(a)));rec();curSave=rec;paint();
  wid=navigator.geolocation.watchPosition(p=>{const c=p.coords,f={t:p.timestamp,lat:c.latitude,lon:c.longitude,alt:c.altitude,acc:c.accuracy,v:c.speed,dir:Number.isFinite(c.heading)?c.heading:null};add(f);fx.push([f.t,f.lat,f.lon,f.alt,f.acc,f.v,f.dir]);if(Date.now()-last>10000){last=Date.now();rec()}paint()},
   e=>{if(e.code===1)return fail('Sin permiso de ubicación. Actívalo para Pistea en los ajustes del navegador.');const l=$('#sl');if(l)l.textContent='Buscando la señal del GPS…'},{enableHighAccuracy:true,maximumAge:0,timeout:30000});   // sin señal o tiempo agotado (telecabina, túnel, pantalla apagada): se sigue grabando
  try{lock=await navigator.wakeLock.request('screen')}catch(e){}
 }
 const btn=$('#fin');if(!btn)return;
 btn.onclick=async()=>{stopW();clearInterval(T);if(NAT)try{await NAT.stop()}catch(e){}
  const p=C.payload(s)||(SN?null:{station:s.id,source:'gps'});if(!p){flash('No se ha detectado ninguna bajada. No se guarda el día.');recDrop(id);return ov0()}   // sin el mapa, decide el servidor
  p.total=Math.max(0,((C.lastT||Date.now())-t0)/36e5);p.trace=encodeTrace(raw);saveDay(s,p,btn,()=>recDrop(id))}}
function recDrop(id){recClear();st.rec=null;if(NAT&&id)NAT.clear({id}).catch(()=>{})}
const recBanner=()=>{const r=st.rec,s=r&&SM[r.station];if(!s)return '';const h=new Date(r.t0).toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),can=!r.native||st.recRun;
 return `<div class="card" style="border-color:var(--ac);margin-bottom:18px"><div class="eyebrow">Día sin guardar</div><div style="font-weight:600;margin:6px 0 2px">${esc(s.n)}</div><small>Empezó el ${h}. Está grabado en este dispositivo y aún no se ha subido.</small><div style="display:flex;gap:8px;margin-top:12px">${can?'<button class="btn" style="margin:0;padding:12px" data-c="recResume">Retomar</button>':''}<button class="btn ${can?'gh':''}" style="margin:0;padding:12px" data-c="recSaveDay">Guardar día</button><button class="btn gh" style="margin:0;padding:12px" data-c="recDiscard">Descartar</button></div></div>`};
const recResume=()=>{const r=st.rec;if(r&&SM[r.station])runReal(SM[r.station],r)};
async function recSaveDay(){const r=st.rec,s=r&&SM[r.station];if(!s)return recDiscard(true);const SN=await upTo(stationFor(s.id),8000),C=new Calc(SN),raw=[],add=f=>{C.add(f);raw.push(f)};
 try{if(r.native){if(st.recRun)await NAT.stop();const rd=await NAT.read({id:r.id,from:0});rd.rows.forEach(x=>{const f=parseNat(x);if(f)add(f)})}else(r.fx||[]).forEach(a=>add(fxIn(a)))}catch(e){return flash('No se pudo leer la grabación: '+(e.message||e))}
 const p=C.payload(s)||(SN?null:{station:s.id,source:'gps'});if(!p){flash('Ese día no tiene bajadas que guardar.');return recDiscard(true)}
 p.total=Math.max(0,((C.lastT||r.t0)-r.t0)/36e5);p.trace=encodeTrace(raw);saveDay(s,p,{},()=>recDrop(r.id))}
async function recDiscard(quiet){const r=st.rec;if(!quiet&&!confirm('¿Descartar el día sin guardar? No se podrá recuperar.'))return;if(NAT&&r&&r.id){try{if(st.recRun)await NAT.stop()}catch(e){}}recDrop(r&&r.id);render()}
// ---------- el día: lo que se ve al guardarlo y al abrirlo después (dayView) ----------
const CL={v:['Verdes','g','verde'],a:['Azules','b','azul'],r:['Rojas','r','roja'],n:['Negras','k','negra'],f:['Freeride','fr','de freeride'],x:['Sin pista','mu','']};
const len=m=>m>=1000?dec(m/1000)+' km':fmt(m)+' m',hm=t=>new Date(t).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}),cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const segName=g=>g[0]==='f'?(g[1]?esc(g[1]):'Freeride'):g[1]?esc(g[1]):g[0]==='x'?'Sin pista':'Pista '+CL[g[0]][2];
function dayHtml(s,d,o={}){const D=d.detail,sv=o.saved;
 const sp=d.speed&&d.speed.length>1?(()=>{const m=Math.max(...d.speed,1);return `<svg viewBox="0 0 300 80" width="100%" height="80" preserveAspectRatio="none"><path d="${d.speed.map((v,i)=>(i?'L':'M')+(i/(d.speed.length-1)*300).toFixed(1)+' '+(76-v/m*70).toFixed(1)).join('')}" fill="none" stroke="#1f6fe0" stroke-width="2" stroke-linejoin="round"/></svg>`})():'';
 const map=trkMap(d.track,s.id,true),present=map?[...new Set(d.track.map(p=>p[2]))]:[],fv=map?trkFit(d.track,s.id):null,ar=fv?Math.min(1.6,Math.max(.7,(fv[2]-fv[0])/(fv[3]-fv[1]))):1;
 // Por dónde: metros por color y freeride (motor nuevo) o, en los días antiguos, bajadas por color estimado
 const M=D?D.m:null,tot=M?['v','a','r','n','f'].reduce((a,k)=>a+(M[k]||0),0):0,col=d.col||{};
 const where=M&&tot?`<div class="card"><div class="stack">${['v','a','r','n','f'].map(k=>M[k]?`<i style="flex:${M[k]};background:var(--${CL[k][1]})"></i>`:'').join('')}</div><div class="legs">${['v','a','r','n','f'].filter(k=>M[k]>=20).map(k=>`<span style="--c:var(--${CL[k][1]})"><i></i>${CL[k][0]}<b>${len(M[k])}</b></span>`).join('')}</div>${M.f>=20?`<small style="display:block;margin-top:10px">Freeride: fuera de pista, a más de 30 m del borde de cualquier pista, o por un itinerario marcado.</small>`:''}</div>`
  :`<div class="card"><div class="stack">${['v','a','r','n'].map(k=>`<i style="flex:${col[k]||0};background:var(--${CL[k][1]})"></i>`).join('')}</div><div class="leg">${['v','a','r','n'].map(k=>`<span style="--c:var(--${CL[k][1]})">${CL[k][0]} ${col[k]||0}</span>`).join('')}</div><small style="display:block;margin-top:10px">Color estimado por la pendiente (día grabado antes de reconocer las pistas).</small></div>`;
 const runs=D&&D.runs.length?`<h2>Bajadas</h2><div class="card" style="padding:4px 14px">${D.runs.map((r,k)=>`<div class="run"><span class="no">${k+1}</span><div class="bd"><div class="sgs">${r[5].map(g=>`<span><i class="sg" style="--c:var(--${CL[g[0]][1]})"></i>${segName(g)} <em>${len(g[2])}${g[3]>=10?` · ${g[3]} km/h`:''}</em></span>`).join('<em aria-hidden="true">›</em>')}</div><small>${fmt(r[2])} m de desnivel, ${len(r[3])}, máx. ${r[4]} km/h</small></div><time>${hm(r[0])}</time></div>`).join('')}</div>`:'';
 const G={};if(D)for(const r of D.rides){const g=G[r[0]]||(G[r[0]]={n:0,w:0,k:r[5]});g.n++;g.w+=r[4]}
 const lifts=D&&D.rides.length?`<h2>Remontes</h2><div class="card" style="padding:2px 14px">${Object.entries(G).sort((a,b)=>b[1].n-a[1].n).map(([l,g])=>`<div class="row"><b style="font-weight:600">${esc(cap(l))}</b><small style="margin-left:auto;text-align:right">${g.n} ${g.n===1?'vez':'veces'}${g.k&&g.w>=60?`, ${Math.round(g.w/60)} min de cola`:''}</small></div>`).join('')}</div>${D.wait>=60?`<p class="credit" style="margin:6px 2px 0">En total, ${Math.round(D.wait/60)} min de cola y ${Math.round(D.lift/60)} min subiendo.</p>`:''}`:'';
 return `<div class="top" style="padding-top:60px"><div class="eyebrow">${esc(s.n)}${o.alias?`, ${esc(o.alias)}`:''}</div><h1>${sv?'Día guardado':cap(new Date(d.ts).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}))}</h1></div>
 <div class="hero" style="margin-bottom:12px"><small>Desnivel esquiado</small><div class="big" style="margin-top:6px">${fmt(d.desnivel)}<span class="mu" style="font-size:20px"> m</span></div>${sv?`<small style="display:block;margin-top:10px">Puesto ${sv.posStation} en ${esc(s.n)} y ${sv.after} en España</small>`:''}${d.freeride>=0.05?`<span class="fr-tag" style="margin-top:12px">${dec(d.freeride)} km de freeride</span>`:''}</div>
 ${novHtml(s,sv&&sv.nov)}
 <div class="kpis"><div><b>${dec(d.km)}</b><small>km</small></div><div><b>${d.bajadas}</b><small>bajadas</small></div><div><b>${d.vmax.toFixed(0)}</b><small>vel. máx km/h</small></div><div><b>${d.vmed.toFixed(0)}</b><small>vel. media km/h</small></div><div><b>${dec(d.horas)} h</b><small>esquiando</small></div><div><b>${dec(d.total||d.horas)} h</b><small>tiempo total</small></div></div>
 <h2>Recorrido</h2>${map?`<div class="dmap" style="aspect-ratio:${ar.toFixed(3)}" role="img" aria-label="Recorrido del día sobre la estación">${map}</div><div class="maplg">${[1,2,3,4,5,0].filter(c=>present.includes(c)).map(c=>`<span style="--c:${c?TC[c]:'#9fb1c4'}">${c?CL['varnf'[c-1]][0]:'Subidas'}</span>`).join('')}</div>`:`<div class="map" style="height:150px;margin-top:0">${trk(d.track,300,150)}</div>`}
 <h2>Por dónde has bajado</h2>${where}${runs}${lifts}
 ${sp?`<h2>Velocidad</h2><div class="card">${sp}</div>`:''}
 ${o.mine===false?'':'<button class="btn" data-c="shareDay" style="margin-top:20px">Compartir día</button>'}${sv?'<button class="btn gh" data-c="rankOf|España">Ver mi posición en el ranking</button>':''}`}
// Lo que trae el día al guardarlo (POST /api/days → nov): coronas, mejores marcas y pistas nuevas del pasaporte
function novHtml(s,nv){if(!nv||!(nv.nuevas.length||nv.pr.length||nv.top.length))return '';const pp=PP?ppStat(s.id):null;
 return `<div class="card nov">${nv.top.map(p=>`<div class="hi">${ic('crown')}<span><b>Corona en ${esc(p[0])}</b>${p[1]} km/h: nadie ha bajado más rápido esta temporada</span></div>`).join('')}
 ${nv.pr.map(p=>`<div>${ic('bolt')}<span><b>Tu mejor marca en ${esc(p[0])}</b>${p[1]} km/h, antes ${p[2]}</span></div>`).join('')}
 ${nv.nuevas.length?`<div data-c="ppView|${s.id}" role="button" tabindex="0">${ic('check')}<span><b>${nv.nuevas.length===1?'1 pista nueva':nv.nuevas.length+' pistas nuevas'} en tu pasaporte</b>${list(nv.nuevas.map(p=>esc(p[0])))}${pp&&pp.total?`. Llevas ${pp.done} de ${pp.total} en ${esc(s.n)}`:''}</span></div>`:''}</div>`}
function resumen(s,r){st.last={s,d:r.day};st.toast=r.before&&r.after<r.before?`Subes del puesto ${r.before} al ${r.after} de España`:0;ov(dayHtml(s,r.day,{saved:r}));render()}
async function dayView(id){try{const d=await api('day?id='+encodeURIComponent(id)),s=SM[d.station];if(!s)return;st.last={s,d};ov(dayHtml(s,d,{alias:d.me?'':d.alias,mine:d.me}))}catch(e){flash(e.message)}}
async function shareDay(){const{s,d}=st.last,c=document.createElement('canvas');c.width=1080;c.height=1920;const g=c.getContext('2d');
 try{await Promise.all([document.fonts.load('700 120px Cond'),document.fonts.load('600 40px Barlow'),document.fonts.load('500 40px Barlow')])}catch(e){}
 const CD='Cond, "Arial Narrow", sans-serif',BR='Barlow, system-ui, sans-serif',INK='#0f2a44',OR='#ff5a1f';
 g.fillStyle='#f3f7fb';g.fillRect(0,0,1080,1920);
 const img=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>{const j=new Image();j.onload=()=>r(j);j.onerror=()=>r(null);j.src='/img/'+s.id+'.webp'};i.src='/img/foto/'+s.id+'.webp?v='+FV});
 if(img){const k=Math.max(1080/img.width,1000/img.height),w=img.width*k,h=img.height*k;g.drawImage(img,(1080-w)/2,(1000-h)/2,w,h)}
 const gr=g.createLinearGradient(0,380,0,1000);gr.addColorStop(0,'rgba(9,30,52,0)');gr.addColorStop(1,'rgba(9,30,52,.85)');g.fillStyle=gr;g.fillRect(0,0,1080,1000);
 g.fillStyle='#fff';g.font='700 46px '+CD;g.fillText('Pistea',80,110);g.font='700 120px '+CD;g.fillText(s.n,76,900);
 g.font='500 40px '+BR;g.fillStyle='rgba(255,255,255,.9)';g.fillText(new Date(d.ts).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'}),80,960);
 g.fillStyle=OR;g.font='700 220px '+CD;g.fillText(fmt(d.desnivel),70,1240);g.fillStyle=INK;g.font='600 46px '+BR;g.fillText('metros de desnivel',80,1310);
 const K=[[dec(d.km),'km'],[String(d.bajadas),'bajadas'],[d.vmax.toFixed(0),'km/h máx.'],d.freeride>=0.1?[dec(d.freeride)+' km','de freeride']:[dec(d.horas)+' h','esquiando']];
 K.forEach((q,i)=>{const X=80+(i%2)*480,Y=1470+Math.floor(i/2)*190;g.fillStyle=INK;g.font='700 96px '+CD;g.fillText(q[0],X,Y);g.fillStyle='#587089';g.font='500 40px '+BR;g.fillText(q[1],X,Y+56)});
 g.fillStyle='#587089';g.font='500 36px '+BR;g.fillText(st.user.alias+' en pistea.vercel.app',80,1850);
 c.toBlob(async b=>{const f=new File([b],'pistea_dia.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:'Mi día en '+s.n});return}catch(e){if(e.name==='AbortError')return}}const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='pistea_dia.png';a.click()})}
fetch('/api/config').then(r=>r.json()).then(c=>{st.sim=!!c.sim;st.verify=!!c.verify;st.maps=c.maps||'/3d/';if(st.me)render()}).catch(()=>{});   // maps: dónde está el 3D (Cloudflare en producción)
// Confirmar el correo: aviso en la portada mientras no se haya hecho (sin verificar no se sale en rankings ni en la comunidad)
const verifyBanner=()=>!st.verify||!st.user||st.user.verified!==false?'':`<div class="card" style="border-color:var(--ac);margin-bottom:18px"><div class="eyebrow">Confirma tu correo</div><p style="margin:6px 0 4px">Te hemos enviado un enlace a <b>${esc(st.user.email)}</b>.</p><small>Hasta que lo confirmes, tus días cuentan para ti pero no sales en los rankings ni en la comunidad. Mira también en spam.</small><button class="btn gh" style="margin-top:12px;padding:12px" data-c="resendVerify|@">Reenviar el correo</button></div>`;
async function resendVerify(b){b.disabled=true;try{const r=await api('verify/resend',{body:{}});if(r.verified){await boot();return}flash('Correo enviado. Revisa tu bandeja y el spam.')}catch(e){flash(e.message);b.disabled=false}}
const qs=new URLSearchParams(location.search),rt=qs.get('reset'),vt=qs.get('verify');
if(rt&&/^[a-f0-9]{64}$/.test(rt)){st.resetToken=rt;st.mode='reset';st.loading=false;history.replaceState(null,'','/');render()}
else if(vt&&/^[a-f0-9]{64}$/.test(vt)){history.replaceState(null,'','/');render();api('verify',{body:{token:vt}}).then(()=>{st.info='Correo confirmado. Ya apareces en los rankings.';flash('Correo confirmado. Ya apareces en los rankings.')}).catch(e=>{st.err=e.message;flash(e.message)}).finally(boot)}
else{render();boot()}
addEventListener('online',()=>{if(st.offline)boot()});

// ---- Acciones de la interfaz. El HTML no lleva código: data-c (clic), data-s (enviar), data-i (escribir) y data-ch (cambiar)
// dicen «acción|argumento|…» y aquí se ejecuta, solo si está en esta lista. @ = el elemento, @v = su valor, @e = el evento.
const pickFile=()=>$('#av-file').click();
function togglePw(b){const p=$('#pw');p.type=p.type==='password'?'text':'password';b.textContent=p.type==='password'?'Mostrar':'Ocultar'}
function rankOf(n){st.amb=n;st.met='desnivel';ov0();tab('rec')}
const panelDatos=()=>{location.href='/panel'};
const ACT={panelDatos,pickAvatar,pickFile,ficha,traquear,setF,setS,setP,setA,blockUser,boot,changePw,togglePw,delAccount,delAvatar,editProfile,elegir,exportData,follow,go,kudo,logout,logoutAll,moderation,ov0,profile,recDiscard,recResume,recSaveDay,reportUser,resendVerify,resolveRep,setM,shareDay,showBlocks,rankOf,tab,unblock,search,savePw,sendReport,submitAuth,
 open3d,close3d,go3d,pisteF,pisteAll,dayView,ppView,pisteView,pvTab,wrapped,wrNext,wrPrev,wrTap,wrClose,wrAgain,wrShare,drSet,drPick,drTog,drSel,drZone,handleIn,useHandle,obNext,obBack,obSkip,obEnd,edSave,pwMeter};
function act(spec,el,ev){const[fn,...a]=String(spec).split('|'),f=Object.prototype.hasOwnProperty.call(ACT,fn)&&ACT[fn];if(typeof f!=='function')return;return f(...a.map(x=>x==='@'?el:x==='@v'?el.value:x==='@e'?ev:x))}
document.addEventListener('click',e=>{const el=e.target.closest('[data-c]');if(el)act(el.dataset.c,el,e)});
document.addEventListener('submit',e=>{const el=e.target.closest('[data-s]');if(el){e.preventDefault();act(el.dataset.s,el,e)}});
document.addEventListener('input',e=>{const el=e.target.closest('[data-i]');if(el)act(el.dataset.i,el,e)});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('[role=button][data-c]')){e.preventDefault();act(e.target.dataset.c,e.target,e);return}
 // Escape cierra lo que esté delante (no la grabación: para no pausar un día por accidente); las flechas pasan las historias
 if(e.key==='Escape'){if($('#wr'))return wrClose();if($('#v3d'))return close3d();const o=$('.ov');if(o&&!o.querySelector('.speed'))ov0();return}
 if($('#wr')&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();e.key==='ArrowRight'?wrNext():wrPrev()}});
document.addEventListener('change',e=>{const el=e.target.closest('[data-ch]');if(el)act(el.dataset.ch,el,e)});
