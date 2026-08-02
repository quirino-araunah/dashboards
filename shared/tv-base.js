/* ══════════════════════════════════════════════════════════
   TV BASE JS — Araunah Dashboard System
   Shared: fetch, formatters, clock, chart, ranking, carteira
   ══════════════════════════════════════════════════════════ */

var SUPABASE_URL = 'https://qzxabnagqlatytlvwpyq.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6eGFibmFncWxhdHl0bHZ3cHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NDE4NzAsImV4cCI6MjA5MTExNzg3MH0.6liZxZtFY4FE8suxG7Ko9BlCfVh7GIZLv84AO7FHcMY';


/* AUTH (19/jun) - TV de numeros (faturamento/ranking/fiscal) so p/ equipe autorizada.
   Le a sessao SSO compartilhada (.araunahtech.com.br). Editar acesso = TV_ALLOW abaixo. */
var AUTH_TOKEN=null, AUTH_EMAIL=null;
var TV_ALLOW=['thiago.quirino@araunah.com','joao.suss@araunah.com','higor.lamonier@araunah.com','yasmim.valim@araunah.com','rodrigo.brey@araunah.com','heros.aguiar@araunah.com'];
function _tvCookie(n){var m=document.cookie.match(new RegExp('(?:^|; )'+n.replace(/[.$?*|{}()[\]\\/+^]/g,'\\$&')+'=([^;]*)'));return m?decodeURIComponent(m[1]):null;}
/* ═══ AUTH v2 (10/jul) ═══
   Se supabase-js estiver carregado -> engine OFICIAL (autoRefreshToken + persistSession em cookie SSO):
   trava rotacao de refresh_token, respeita janela de reuso, tenta de novo em queda de rede, renova ao acordar.
   Substitui o refresh caseiro que deslogava a TV. Sem a lib -> cai no engine legado (fallback, inalterado). */
function _tvAuthorized(){return !!AUTH_TOKEN && TV_ALLOW.indexOf(AUTH_EMAIL)!==-1;}
var _tvMSLogin, _tvLogin;
var _TV_HAS_CB=(location.search.indexOf('code=')!==-1)||(location.search.indexOf('error=')!==-1)||(location.hash.indexOf('access_token=')!==-1);
var _TV_EXCHANGING=false;
function _tvShowConnecting(){var d=document.createElement('div');d.id='_tvConnecting';d.style.cssText='position:fixed;inset:0;z-index:99999;background:#0b1418;display:flex;align-items:center;justify-content:center;color:#00d4aa;font-family:system-ui,sans-serif;font-size:18px';d.textContent='Entrando...';document.body.appendChild(d);}
function _tvFailLogin(){var c=document.getElementById('_tvConnecting');if(c)c.remove();if(!_tvAuthorized())_tvShowLogin();}
function _tvShowLogin(){if(document.getElementById('_tvLoginOv'))return;var den=(typeof sessionStorage!=='undefined'&&sessionStorage.getItem('_tvDenied'))||'';var ov=document.createElement('div');ov.id='_tvLoginOv';ov.style.cssText='position:fixed;inset:0;z-index:99999;background:#0b1418;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif';ov.innerHTML='<div style="background:#13242b;border:1px solid #1e3a44;border-radius:14px;padding:32px 28px;width:340px;color:#e6eef0;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.5)"><div style="font-size:22px;font-weight:700;color:#00d4aa;margin-bottom:4px">COCKPIT</div><div style="font-size:12px;color:#7d99a3;margin-bottom:18px">Acesso restrito</div><button id="_tvMS" style="width:100%;padding:12px;border:0;border-radius:8px;background:#2f6fed;color:#fff;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:14px">Entrar com Microsoft</button><div style="font-size:11px;color:#456b75;margin-bottom:12px">ou e-mail / senha</div><input id="_tvE" type="email" placeholder="e-mail" style="width:100%;box-sizing:border-box;margin-bottom:10px;padding:11px;border-radius:8px;border:1px solid #1e3a44;background:#0b1418;color:#e6eef0;font-size:14px"><input id="_tvP" type="password" placeholder="senha" style="width:100%;box-sizing:border-box;margin-bottom:14px;padding:11px;border-radius:8px;border:1px solid #1e3a44;background:#0b1418;color:#e6eef0;font-size:14px"><button id="_tvB" style="width:100%;padding:10px;border:1px solid #1e3a44;border-radius:8px;background:transparent;color:#e6eef0;font-weight:600;font-size:13px;cursor:pointer">Entrar</button><div id="_tvM" style="font-size:12px;color:#ff6b6b;margin-top:10px;min-height:16px">'+(den?den:'')+'</div></div>';document.body.appendChild(ov);if(typeof sessionStorage!=='undefined')sessionStorage.removeItem('_tvDenied');var e=ov.querySelector('#_tvE'),p=ov.querySelector('#_tvP'),b=ov.querySelector('#_tvB'),m=ov.querySelector('#_tvM');ov.querySelector('#_tvMS').onclick=function(){_tvMSLogin();};function go(){b.disabled=true;m.textContent='...';_tvLogin(e.value.trim(),p.value,b,m);}b.onclick=go;p.addEventListener('keydown',function(ev){if(ev.key==='Enter')go();});}

if(typeof supabase!=='undefined'&&supabase.createClient){
  /* ---------- ENGINE OFICIAL (supabase-js) ---------- */
  var _COOKIE_S='Domain=.araunahtech.com.br; Path=/; SameSite=Lax; Secure';
  var _COOKIE_P='Domain=.araunahtech.com.br; Path=/; SameSite=Lax';
  function _tvCookieRead(base){
    var k0=_tvCookie('__Secure-'+base+'.0');if(k0===null)k0=_tvCookie(base+'.0');
    if(k0!==null){var all=k0;for(var i=1;i<40;i++){var c=_tvCookie('__Secure-'+base+'.'+i);if(c===null)c=_tvCookie(base+'.'+i);if(c===null)break;all+=c;}return all;}
    var s=_tvCookie('__Secure-'+base);if(s===null)s=_tvCookie(base);return s;
  }
  function _tvCookieClear(base){for(var i=0;i<40;i++){document.cookie='__Secure-'+base+'.'+i+'=; '+_COOKIE_S+'; Max-Age=0';document.cookie=base+'.'+i+'=; '+_COOKIE_P+'; Max-Age=0';}document.cookie='__Secure-'+base+'=; '+_COOKIE_S+'; Max-Age=0';document.cookie=base+'=; '+_COOKIE_P+'; Max-Age=0';}
  /* chunk pelo tamanho ENCODADO (limite Chrome=4096 bytes/cookie INCLUINDO nome; JSON denso infla ~3x no encodeURIComponent
     e cookie grande o Chrome DESCARTA EM SILENCIO -> corrente quebrada -> sessao ilegivel; bug da noite de 10/jul) */
  function _tvCookieWrite(base,value){_tvCookieClear(base);var i=0,idx=0;while(i<value.length){var take=Math.min(2000,value.length-i);var enc=encodeURIComponent(value.slice(i,i+take));while(enc.length>3500&&take>100){take=Math.max(100,Math.floor(take*3500/enc.length));enc=encodeURIComponent(value.slice(i,i+take));}document.cookie='__Secure-'+base+'.'+idx+'='+enc+'; '+_COOKIE_S+'; Max-Age='+(60*60*24*30);i+=take;idx++;}}
  /* sessao MINIMA no cookie: user do Azure vem gordo (identities/metadata ~4KB) e o painel so precisa do email */
  function _tvSlimSession(v){try{var o=JSON.parse(v);if(o&&o.access_token&&o.user){var u=o.user;o.user={id:u.id,aud:u.aud||'authenticated',role:u.role||'authenticated',email:u.email,phone:u.phone||'',app_metadata:{provider:(u.app_metadata&&u.app_metadata.provider)||'email'},user_metadata:{},identities:[],created_at:u.created_at,updated_at:u.updated_at,is_anonymous:false};return JSON.stringify(o);}}catch(e){}return v;}
  var _tvCookieStorage={getItem:function(k){var v=_tvCookieRead(k);return (v===null||v===undefined)?null:v;},setItem:function(k,v){try{_tvCookieWrite(k,_tvSlimSession(v));}catch(e){}},removeItem:function(k){try{_tvCookieClear(k);}catch(e){}}};
  var _tvSB=supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{storage:_tvCookieStorage,storageKey:'araunah-auth',autoRefreshToken:true,persistSession:true,detectSessionInUrl:true,flowType:'pkce'}});
  window._tvSB=_tvSB;
  function _tvApply(s){var em=((s&&s.user&&s.user.email)||'').toLowerCase();if(s&&s.access_token&&TV_ALLOW.indexOf(em)!==-1){AUTH_TOKEN=s.access_token;AUTH_EMAIL=em;return true;}return false;}
  _tvSB.auth.onAuthStateChange(function(evt,session){
    if(evt==='SIGNED_OUT'){AUTH_TOKEN=null;AUTH_EMAIL=null;if(!_TV_HAS_CB)_tvShowLogin();return;}/* nunca zerar em silencio */
    if(!session)return;
    var em=((session.user&&session.user.email)||'').toLowerCase();
    if(TV_ALLOW.indexOf(em)===-1){try{sessionStorage.setItem('_tvDenied','Conta '+(em||'?')+' sem acesso a esta TV.');}catch(e){}_tvSB.auth.signOut();return;}
    _tvApply(session);
    if(evt==='SIGNED_IN'&&_TV_HAS_CB){location.reload();}
  });
  try{_tvSB.auth.startAutoRefresh();}catch(e){}
  function _tvWake(){if(document.visibilityState==='visible'){try{_tvSB.auth.startAutoRefresh();}catch(e){}try{_tvSB.auth.getSession();}catch(e){}}}
  document.addEventListener('visibilitychange',_tvWake);
  window.addEventListener('online',_tvWake);
  _tvMSLogin=function(){try{_tvSB.auth.signInWithOAuth({provider:'azure',options:{scopes:'openid profile email',redirectTo:location.origin+location.pathname}});}catch(e){location.href=SUPABASE_URL+'/auth/v1/authorize?provider=azure&scopes=openid%20profile%20email&redirect_to='+encodeURIComponent(location.origin+location.pathname);}};
  _tvLogin=function(email,pass,b,m){_tvSB.auth.signInWithPassword({email:email,password:pass}).then(function(res){var d=res&&res.data,er=res&&res.error;if(er||!d||!d.session){m.textContent='Login invalido.';b.disabled=false;return;}var em=((d.user&&d.user.email)||'').toLowerCase();if(TV_ALLOW.indexOf(em)===-1){m.textContent='Conta sem acesso a esta TV.';b.disabled=false;_tvSB.auth.signOut();return;}location.reload();}).catch(function(){m.textContent='Erro de rede.';b.disabled=false;});};
  if(_TV_HAS_CB){document.addEventListener('DOMContentLoaded',function(){_tvShowConnecting();});}
  document.addEventListener('DOMContentLoaded',function(){
    _tvSB.auth.getSession().then(function(res){
      var s=res&&res.data&&res.data.session;
      if(_tvApply(s))return;
      /* migra sessao do cookie legado (formato antigo) sem forcar novo login */
      var lo=null;try{lo=JSON.parse(_tvCookieRead('araunah-auth'));}catch(e){}
      if(lo&&lo.access_token&&lo.refresh_token){
        _tvSB.auth.setSession({access_token:lo.access_token,refresh_token:lo.refresh_token}).then(function(r2){
          var s2=r2&&r2.data&&r2.data.session;
          if(_tvApply(s2)){location.reload();return;}
          if(_TV_HAS_CB)return;_tvShowLogin();
        }).catch(function(){if(!_TV_HAS_CB)_tvShowLogin();});
        return;
      }
      if(_TV_HAS_CB){setTimeout(function(){if(!_tvAuthorized())_tvFailLogin();},9000);return;}
      _tvShowLogin();
    }).catch(function(){if(!_TV_HAS_CB)_tvShowLogin();});
  });
}else{
  /* ---------- ENGINE LEGADO (fallback, sem a lib) ---------- */
  function _tvReadSession(){try{var k0=_tvCookie('__Secure-araunah-auth.0')||_tvCookie('araunah-auth.0');var all;if(k0!==null){all=k0;for(var i=1;i<20;i++){var c=_tvCookie('__Secure-araunah-auth.'+i)||_tvCookie('araunah-auth.'+i);if(c===null)break;all+=c;}}else{all=_tvCookie('__Secure-araunah-auth')||_tvCookie('araunah-auth');if(all===null)return null;}var o=JSON.parse(all);if(!o||!o.access_token)return null;if(o.expires_at&&o.expires_at*1000<Date.now())return null;return{token:o.access_token,email:((o.user&&o.user.email)||'').toLowerCase()};}catch(e){return null;}}
  function _tvB64urlJson(t){try{var p=t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(decodeURIComponent(escape(atob(p))));}catch(e){return {};}}
  function _tvHandleOAuth(){if(!location.hash||location.hash.indexOf('access_token=')===-1)return false;var h={};location.hash.substring(1).split('&').forEach(function(kv){var a=kv.split('=');h[a[0]]=decodeURIComponent(a[1]||'');});if(!h.access_token)return false;var claims=_tvB64urlJson(h.access_token);var em=(claims.email||'').toLowerCase();try{history.replaceState(null,'',location.pathname);}catch(e){}if(TV_ALLOW.indexOf(em)===-1){try{sessionStorage.setItem('_tvDenied',em||'?');}catch(e){}return false;}_tvStore({access_token:h.access_token,refresh_token:h.refresh_token||'',token_type:'bearer',expires_in:parseInt(h.expires_in||'3600',10),expires_at:parseInt(h.expires_at||'0',10)||(Math.floor(Date.now()/1000)+3600),user:{email:em}});return true;}
  function _tvB64url(buf){var s=btoa(String.fromCharCode.apply(null,new Uint8Array(buf)));return s.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  _tvMSLogin=function(){try{var a=new Uint8Array(32);crypto.getRandomValues(a);var v=_tvB64url(a.buffer);try{localStorage.setItem('_tvPkce',v);}catch(e){}crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)).then(function(hb){location.href=SUPABASE_URL+'/auth/v1/authorize?provider=azure&scopes=openid%20profile%20email&code_challenge='+_tvB64url(hb)+'&code_challenge_method=s256&redirect_to='+encodeURIComponent(location.origin+location.pathname);});}catch(e){location.href=SUPABASE_URL+'/auth/v1/authorize?provider=azure&scopes=openid%20profile%20email&redirect_to='+encodeURIComponent(location.origin+location.pathname);}};
  function _tvHandleCode(){var m=location.search.match(/[?&]code=([^&]+)/);if(!m)return;_TV_EXCHANGING=true;_tvShowConnecting();var code=decodeURIComponent(m[1]);var ver='';try{ver=localStorage.getItem('_tvPkce')||'';}catch(e){}try{history.replaceState(null,'',location.pathname);}catch(e){}fetch(SUPABASE_URL+'/auth/v1/token?grant_type=pkce',{method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({auth_code:code,code_verifier:ver})}).then(function(r){return r.json();}).then(function(d){if(!d.access_token){try{sessionStorage.setItem('_tvDenied',(d.error_description||d.msg||d.error||('Microsoft: '+JSON.stringify(d).slice(0,140))));}catch(e){}_tvFailLogin();return;}var em=((d.user&&d.user.email)||'').toLowerCase();if(TV_ALLOW.indexOf(em)===-1){try{sessionStorage.setItem('_tvDenied','Conta '+(em||'?')+' sem acesso a esta TV.');}catch(e){}_tvFailLogin();return;}_tvStore({access_token:d.access_token,refresh_token:d.refresh_token,token_type:'bearer',expires_in:d.expires_in,expires_at:d.expires_at,user:d.user});var chk=_tvReadSession();if(!chk){var c0=_tvCookie('__Secure-araunah-auth.0');var why;if(!c0){why='Navegador bloqueou o cookie da sessao. Libere cookies para araunahtech.com.br.';}else if(d.expires_at&&d.expires_at*1000<Date.now()){why='Relogio do aparelho esta errado (sessao nasce expirada). Ajuste data/hora e tente de novo.';}else{why='Sessao nao persistiu no navegador.';}try{sessionStorage.setItem('_tvDenied',why);}catch(e){}_tvFailLogin();return;}location.reload();}).catch(function(){try{sessionStorage.setItem('_tvDenied','Erro de rede no login.');}catch(e){}_tvFailLogin();});}
  var _tvRefreshing=false,_tvRefreshTimer=null;
  function _tvRawSession(){try{var k0=_tvCookie('__Secure-araunah-auth.0')||_tvCookie('araunah-auth.0');var all;if(k0!==null){all=k0;for(var i=1;i<20;i++){var c=_tvCookie('__Secure-araunah-auth.'+i)||_tvCookie('araunah-auth.'+i);if(c===null)break;all+=c;}}else{all=_tvCookie('__Secure-araunah-auth')||_tvCookie('araunah-auth');if(all===null)return null;}return JSON.parse(all);}catch(e){return null;}}
  function _tvScheduleRefresh(){var o=_tvRawSession();if(!o||!o.expires_at)return;var ms=(o.expires_at*1000)-Date.now()-(5*60*1000);if(ms<15000)ms=15000;if(_tvRefreshTimer)clearTimeout(_tvRefreshTimer);_tvRefreshTimer=setTimeout(function(){_tvRefresh();},ms);}
  function _tvRefresh(cb){if(_tvRefreshing){if(cb)cb(false);return;}var o=_tvRawSession();if(!o||!o.refresh_token){if(cb)cb(false);return;}_tvRefreshing=true;fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:o.refresh_token})}).then(function(r){return r.json();}).then(function(d){_tvRefreshing=false;if(!d.access_token){if(cb)cb(false);return;}var em=((d.user&&d.user.email)||(o.user&&o.user.email)||'').toLowerCase();_tvStore({access_token:d.access_token,refresh_token:d.refresh_token,token_type:'bearer',expires_in:d.expires_in,expires_at:d.expires_at,user:{email:em}});AUTH_TOKEN=d.access_token;AUTH_EMAIL=em;_tvScheduleRefresh();if(cb)cb(true);}).catch(function(){_tvRefreshing=false;if(cb)cb(false);});}
  function _tvStore(o){var u=(o&&o.user)||{};var raw=JSON.stringify({access_token:o.access_token,refresh_token:o.refresh_token||'',token_type:'bearer',expires_in:o.expires_in,expires_at:o.expires_at,user:{email:(u.email||'').toLowerCase()}}),M=3000,n=Math.max(1,Math.ceil(raw.length/M)),dom='Domain=.araunahtech.com.br; Path=/; SameSite=Lax; Secure';for(var i=0;i<20;i++){document.cookie='__Secure-araunah-auth.'+i+'=; '+dom+'; Max-Age=0';document.cookie='araunah-auth.'+i+'=; Domain=.araunahtech.com.br; Path=/; SameSite=Lax; Max-Age=0';}document.cookie='__Secure-araunah-auth=; '+dom+'; Max-Age=0';document.cookie='araunah-auth=; Domain=.araunahtech.com.br; Path=/; SameSite=Lax; Max-Age=0';for(var i=0;i<n;i++)document.cookie='__Secure-araunah-auth.'+i+'='+encodeURIComponent(raw.slice(i*M,(i+1)*M))+'; '+dom+'; Max-Age='+(60*60*24*30);}
  _tvLogin=function(email,pass,b,m){fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:email,password:pass})}).then(function(r){return r.json();}).then(function(d){if(!d.access_token){m.textContent='Login invalido.';b.disabled=false;return;}var em=((d.user&&d.user.email)||'').toLowerCase();if(TV_ALLOW.indexOf(em)===-1){m.textContent='Conta sem acesso a esta TV.';b.disabled=false;return;}_tvStore({access_token:d.access_token,refresh_token:d.refresh_token,token_type:'bearer',expires_in:d.expires_in,expires_at:d.expires_at,user:d.user});location.reload();}).catch(function(){m.textContent='Erro de rede.';b.disabled=false;});};
  _tvHandleOAuth();
  _tvHandleCode();
  (function(){var x=_tvReadSession();if(x){AUTH_TOKEN=x.token;AUTH_EMAIL=x.email;_tvScheduleRefresh();}})();
  setInterval(function(){var o=_tvRawSession();if(o&&o.refresh_token&&o.expires_at&&(o.expires_at*1000-Date.now())<5*60*1000){_tvRefresh();}},60000);
  document.addEventListener('DOMContentLoaded',function(){if(_tvAuthorized())return;if(_TV_EXCHANGING)return;var o=_tvRawSession();if(o&&o.refresh_token&&TV_ALLOW.indexOf(((o.user&&o.user.email)||'').toLowerCase())!==-1){_tvRefresh(function(ok){if(ok){location.reload();}else{_tvShowLogin();}});return;}_tvShowLogin();});
}

var refreshCountdown = 60;
var refreshTimer = null;
var clockTimer = null;

/* ═══ SUPABASE FETCH (paginated) ═══ */
function sbFetch(table, params) { return sbFetchAll(table, params); }
function sbFetchPage(table, params, offset, _retried) {
    if (!_tvAuthorized()) return Promise.resolve([]);
    var sep = params ? '&' : '';
    return fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + params + sep + 'limit=1000&offset=' + offset, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + (AUTH_TOKEN || SUPABASE_KEY) }
    }).then(function(r) {
        /* self-heal: token velho (TV dormiu/rede caiu) -> forca refresh e tenta 1x de novo */
        if (r.status === 401 && !_retried && window._tvSB) {
            return window._tvSB.auth.refreshSession().then(function(){ return sbFetchPage(table, params, offset, true); });
        }
        return r.json();
    });
}
function sbFetchAll(table, params) {
    var allRows = [];
    function fetchNext(offset) {
        return sbFetchPage(table, params, offset).then(function(rows) {
            if (!rows || !rows.length) return allRows;
            allRows = allRows.concat(rows);
            if (rows.length < 1000) return allRows;
            return fetchNext(offset + 1000);
        });
    }
    return fetchNext(0);
}

/* ═══ FORMATTERS ═══ */
function fmtBRL(v) {
    if (v >= 1000000) return 'R$\u00a0' + (v/1000000).toFixed(2).replace('.',',') + 'M';
    if (v >= 1000) return 'R$\u00a0' + (v/1000).toFixed(0) + 'K';
    return 'R$\u00a0' + v.toFixed(0);
}
function fmtBRLFull(v) {
    return 'R$\u00a0' + v.toLocaleString('pt-BR', {minimumFractionDigits:0, maximumFractionDigits:0});
}
function fmtPct(v) { return v.toFixed(1).replace('.',',') + '%'; }
function pctColor(v) { return v >= 80 ? 'var(--green)' : v >= 50 ? 'var(--amber)' : 'var(--red)'; }
function safeNum(v) { return parseFloat(v) || 0; }
function escHtml(s) { if (!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ═══ VERTICAL NORMALIZATION ═══ */
function normalizeVertical(v) {
    if (!v) return '';
    var u = v.toUpperCase().replace(/[ÁÀÃÂ]/g,'A').replace(/[ÉÈÊ]/g,'E').replace(/[ÍÌÎ]/g,'I').replace(/[ÓÒÕÔ]/g,'O').replace(/[ÚÙÛ]/g,'U');
    if (u.indexOf('AGRO') >= 0) return 'AGRO';
    if (u.indexOf('AGUA') >= 0) return 'AGUA';
    if (u.indexOf('FLOR') >= 0) return 'FLORESTAS';
    if (u.indexOf('CORP') >= 0) return 'CORPORATIVO';
    return u;
}

/* ═══ NAME MATCHING ═══ */
function matchPlanName(planName, repName) {
    if (!planName || !repName) return false;
    var pn = planName.toUpperCase().trim();
    var rn = repName.toUpperCase().trim();
    if (pn === rn) return true;
    return rn.indexOf(pn) === 0;
}

/* ═══ BUILD PROF MAPS ═══ */
function buildProfMaps(colab) {
    var profMap = {};
    var profVerticalMap = {};
    var profActive = {};
    for (var i = 0; i < colab.length; i++) {
        var c = colab[i];
        if (c.nome && c.nome_agrupado) profMap[c.nome] = c.nome_agrupado;
        if (c.vertical) {
            profVerticalMap[c.nome] = c.vertical;
            if (c.nome_agrupado) profVerticalMap[c.nome_agrupado] = c.vertical;
        }
        if (c.ativo) {
            profActive[c.nome] = true;
            if (c.nome_agrupado) profActive[c.nome_agrupado] = true;
        }
    }
    return { profMap: profMap, profVerticalMap: profVerticalMap, profActive: profActive };
}

/* ═══ BUILD CFOP MAP ═══ */
function buildCfopMap(operacao) {
    var cfopMap = {};
    for (var i = 0; i < operacao.length; i++) {
        cfopMap[operacao[i].cfop] = operacao[i];
    }
    return cfopMap;
}

/* ═══ FILTER ANTECIPADO (CFOP 5922/6922) ═══ */
function filterAntecipado(movRaw, cfopMap, profMap, profVerticalMap, verticalFilter, year) {
    var result = [];
    for (var i = 0; i < movRaw.length; i++) {
        var m = movRaw[i];
        var cfop = parseInt(m.cfop);
        if (cfop !== 5922 && cfop !== 6922) continue;
        m.representante = profMap[m.representante] || m.representante;
        if (!m.vertical) m.vertical = profVerticalMap[m.representante] || '';
        if (verticalFilter && normalizeVertical(m.vertical) !== verticalFilter) continue;
        m._valor = parseFloat(m.total_produto) || 0;
        if (!m.id_tempo) continue;
        var parts = m.id_tempo.split('-');
        if (parseInt(parts[0]) !== year) continue;
        result.push(m);
    }
    return result;
}

/* ═══ FILTER MOVIMENTO ═══ */
function filterMovimento(movRaw, cfopMap, profMap, profVerticalMap, verticalFilter, year) {
    var result = [];
    for (var i = 0; i < movRaw.length; i++) {
        var m = movRaw[i];
        var op = cfopMap[m.cfop];
        if (!op || !op.entra_meta) continue;
        m.representante = profMap[m.representante] || m.representante;
        if (!m.vertical) m.vertical = profVerticalMap[m.representante] || '';
        if (verticalFilter && normalizeVertical(m.vertical) !== verticalFilter) continue;
        m._valor = parseFloat(m.faturamento_sem_frete || m.total_produto) || 0;
        if (op.operacao_gerencial === 'DEVOLUÇÃO') m._valor = -Math.abs(m._valor);
        if (!m.id_tempo) continue;
        var parts = m.id_tempo.split('-');
        if (parseInt(parts[0]) !== year) continue;
        result.push(m);
    }
    return result;
}

/* ═══ FILTER PLAN DATA ═══ */
function filterPlanData(planData, verticalFilter) {
    if (!verticalFilter) return planData;
    return planData.filter(function(p) {
        return normalizeVertical(p.vertical) === verticalFilter;
    });
}

/* ═══ FILTER CARTEIRA ═══ */
function filterCarteira(carteira, profMap, profVerticalMap, verticalFilter) {
    if (!verticalFilter) return carteira;
    return carteira.filter(function(c) {
        var rep = c.representante || c.consultor || '';
        rep = profMap[rep] || rep;
        var vert = c.vertical || profVerticalMap[rep] || '';
        return normalizeVertical(vert) === verticalFilter;
    });
}

/* ═══ COMPUTE KPIs ═══ */
function computeKPIs(movFiltered, planData, currentPeriod, year, month, daysInMonth, todayDay) {
    var movMonth = movFiltered.filter(function(m) { return m.id_tempo === currentPeriod; });
    var realMonth = movMonth.reduce(function(s, m) { return s + m._valor; }, 0);
    var planMonth = planData.filter(function(p) { return p.id_tempo === currentPeriod; });
    var metaMonth = planMonth.reduce(function(s, p) { return s + safeNum(p.valor); }, 0);
    var atingMonth = metaMonth > 0 ? realMonth / metaMonth * 100 : 0;
    var faltaMes = Math.max(metaMonth - realMonth, 0);
    var ritmoDia = todayDay > 0 ? realMonth / todayDay : 0;
    var projecao = ritmoDia * daysInMonth;
    var daysRemaining = daysInMonth - todayDay;
    var precisaPorDia = daysRemaining > 0 ? faltaMes / daysRemaining : 0;

    var movYTD = movFiltered.filter(function(m) {
        var pp = m.id_tempo.split('-');
        return parseInt(pp[0]) === year && parseInt(pp[1]) <= parseInt(month);
    });
    var realYTD = movYTD.reduce(function(s, m) { return s + m._valor; }, 0);
    var planYTD = planData.filter(function(p) {
        var pp = p.id_tempo.split('-');
        return parseInt(pp[0]) === year && parseInt(pp[1]) <= parseInt(month);
    });
    var metaYTD = planYTD.reduce(function(s, p) { return s + safeNum(p.valor); }, 0);
    var atingYTD = metaYTD > 0 ? realYTD / metaYTD * 100 : 0;

    return {
        movMonth: movMonth, movYTD: movYTD,
        planMonth: planMonth, planYTD: planYTD,
        realMonth: realMonth, metaMonth: metaMonth, atingMonth: atingMonth,
        realYTD: realYTD, metaYTD: metaYTD, atingYTD: atingYTD,
        faltaMes: faltaMes, ritmoDia: ritmoDia, projecao: projecao,
        precisaPorDia: precisaPorDia, daysRemaining: daysRemaining
    };
}

/* ═══ CLOCK ═══ */
function updateClock() {
    var now = new Date();
    var h = String(now.getHours()).padStart(2,'0');
    var m = String(now.getMinutes()).padStart(2,'0');
    var s = String(now.getSeconds()).padStart(2,'0');
    var el = document.getElementById('tk-clock');
    if (el) el.textContent = h + ':' + m + ':' + s;
}
function startClock() {
    updateClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 1000);
}

/* ═══ COUNTDOWN ═══ */
function startCountdown(loadFn) {
    refreshCountdown = 60;
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(function() {
        refreshCountdown--;
        if (refreshCountdown <= 0) {
            clearInterval(refreshTimer);
            loadFn();
            return;
        }
        var mm = Math.floor(refreshCountdown / 60);
        var ss = String(refreshCountdown % 60).padStart(2,'0');
        var el = document.getElementById('ft-countdown');
        if (el) el.textContent = mm + ':' + ss;
    }, 1000);
}

/* ═══ FULLSCREEN ═══ */
function toggleFS() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function(){});
    } else {
        document.exitFullscreen().catch(function(){});
    }
}

/* ═══ THEME TOGGLE ═══ */
var _tileLayer = null;
var TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
var TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
function toggleTheme() {
    var html = document.documentElement;
    var current = html.getAttribute('data-theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('tv-theme', next); } catch(e) {}
    updateThemeBtn();
    /* Swap map tiles if map exists */
    if (typeof _map !== 'undefined' && _map && _tileLayer) {
        _map.removeLayer(_tileLayer);
        _tileLayer = L.tileLayer(next === 'light' ? TILE_LIGHT : TILE_DARK, {maxZoom:18,subdomains:'abcd'}).addTo(_map);
    }
}
function updateThemeBtn() {
    var btn = document.getElementById('themeBtn');
    if (!btn) return;
    var theme = document.documentElement.getAttribute('data-theme') || 'dark';
    btn.innerHTML = theme === 'dark' ? '&#9788; CLARO' : '&#9790; ESCURO';
}
/* Auto-load saved theme */
(function() {
    try {
        var saved = localStorage.getItem('tv-theme');
        if (saved) document.documentElement.setAttribute('data-theme', saved);
    } catch(e) {}
})();

/* ═══ RENDER TICKER ═══ */
function renderTicker(atingMonth, atingYTD, carteiraTotal, daysRemaining) {
    var tkMonthArrow = document.getElementById('tk-month-arrow');
    var tkMonthVal = document.getElementById('tk-month-val');
    if (tkMonthArrow) {
        tkMonthArrow.textContent = atingMonth >= 50 ? '▲' : '▼';
        tkMonthArrow.className = 'ticker-arrow ' + (atingMonth >= 50 ? 'ticker-up' : 'ticker-down');
    }
    if (tkMonthVal) {
        tkMonthVal.textContent = fmtPct(atingMonth);
        tkMonthVal.className = 'ticker-val ' + (atingMonth >= 50 ? 'ticker-up' : 'ticker-down');
    }
    var tkYtdArrow = document.getElementById('tk-ytd-arrow');
    var tkYtdVal = document.getElementById('tk-ytd-val');
    if (tkYtdArrow) {
        tkYtdArrow.textContent = atingYTD >= 50 ? '▲' : '▼';
        tkYtdArrow.className = 'ticker-arrow ' + (atingYTD >= 50 ? 'ticker-up' : 'ticker-down');
    }
    if (tkYtdVal) {
        tkYtdVal.textContent = fmtPct(atingYTD);
        tkYtdVal.className = 'ticker-val ' + (atingYTD >= 50 ? 'ticker-up' : 'ticker-down');
    }
    var tkCart = document.getElementById('tk-carteira');
    if (tkCart) tkCart.textContent = fmtBRL(carteiraTotal);
    var tkDias = document.getElementById('tk-dias');
    if (tkDias) tkDias.textContent = daysRemaining + ' dias restam';
}

/* ═══ RENDER HERO ═══ */
function renderHero(kpis, label, month, year) {
    var el = function(id) { return document.getElementById(id); };
    if (el('hero-period')) el('hero-period').textContent = label + ' — ' + month + '/' + year;
    if (el('hero-real')) el('hero-real').textContent = fmtBRL(kpis.realMonth);
    if (el('hero-meta')) el('hero-meta').textContent = fmtBRL(kpis.metaMonth);
    if (el('hero-pct')) { el('hero-pct').textContent = fmtPct(kpis.atingMonth); el('hero-pct').style.color = pctColor(kpis.atingMonth); }
    if (el('hero-progress')) { el('hero-progress').style.width = Math.min(kpis.atingMonth, 100) + '%'; el('hero-progress').style.background = pctColor(kpis.atingMonth); }
    if (el('hero-ritmo')) el('hero-ritmo').textContent = fmtBRL(kpis.ritmoDia);
    if (el('hero-proj')) { el('hero-proj').textContent = fmtBRL(kpis.projecao); el('hero-proj').style.color = kpis.projecao >= kpis.metaMonth ? 'var(--green)' : 'var(--red)'; }
    if (el('hero-falta')) el('hero-falta').textContent = fmtBRL(kpis.faltaMes);
    if (el('hero-precisa')) el('hero-precisa').textContent = fmtBRL(kpis.precisaPorDia);
    if (el('hero-dias-rest')) el('hero-dias-rest').textContent = kpis.daysRemaining;
}

/* ═══ RENDER RANKING ═══ */
function renderRanking(movMonth, movYTD, planMonth, planYTD, profMap) {
    var allReps = {};
    var i, rep;
    for (i = 0; i < movMonth.length; i++) {
        rep = movMonth[i].representante || 'N/D';
        if (!allReps[rep]) allReps[rep] = { realM: 0, realY: 0 };
        allReps[rep].realM += movMonth[i]._valor;
    }
    for (i = 0; i < movYTD.length; i++) {
        rep = movYTD[i].representante || 'N/D';
        if (!allReps[rep]) allReps[rep] = { realM: 0, realY: 0 };
        allReps[rep].realY += movYTD[i]._valor;
    }

    var planByRepM = {}, planByRepY = {};
    var repNames = Object.keys(allReps);
    for (i = 0; i < planMonth.length; i++) {
        var pcon = planMonth[i].consultor;
        var val = safeNum(planMonth[i].valor);
        for (var j = 0; j < repNames.length; j++) {
            if (matchPlanName(pcon, repNames[j])) { planByRepM[repNames[j]] = (planByRepM[repNames[j]] || 0) + val; break; }
        }
    }
    for (i = 0; i < planYTD.length; i++) {
        var pcon = planYTD[i].consultor;
        var val = safeNum(planYTD[i].valor);
        for (var j = 0; j < repNames.length; j++) {
            if (matchPlanName(pcon, repNames[j])) { planByRepY[repNames[j]] = (planByRepY[repNames[j]] || 0) + val; break; }
        }
    }

    var rows = [];
    var totalRealM = 0, totalMetaM = 0, totalRealY = 0, totalMetaY = 0;
    for (rep in allReps) {
        if (rep === 'N/D' || rep === 'Sem Representante' || rep === 'FLORESTAL') continue;
        var metaM = planByRepM[rep] || 0;
        var metaY = planByRepY[rep] || 0;
        rows.push({ nome: rep, realM: allReps[rep].realM, metaM: metaM, atingM: metaM > 0 ? allReps[rep].realM / metaM * 100 : 0, realY: allReps[rep].realY, metaY: metaY, atingY: metaY > 0 ? allReps[rep].realY / metaY * 100 : 0 });
        totalRealM += allReps[rep].realM; totalMetaM += metaM;
        totalRealY += allReps[rep].realY; totalMetaY += metaY;
    }
    rows.sort(function(a, b) { return b.realY - a.realY; });

    var container = document.getElementById('rankingList');
    if (!container) return;
    var html = '<div class="ranking-header"><span>#</span><span>CONSULTOR</span><span>MÊS</span><span>%</span><span></span><span>YTD</span><span>%</span></div>';
    var maxRows = Math.min(rows.length, 12);
    for (i = 0; i < maxRows; i++) {
        var r = rows[i];
        var barW = rows[0].realY > 0 ? (r.realY / rows[0].realY * 100) : 0;
        html += '<div class="ranking-row">';
        html += '<span class="' + (i < 3 ? 'ranking-pos top3' : 'ranking-pos') + '">' + (i + 1) + '</span>';
        html += '<span class="ranking-name">' + escHtml(r.nome) + '</span>';
        html += '<span class="ranking-val">' + fmtBRL(r.realM) + '</span>';
        html += '<span class="ranking-pct" style="color:' + pctColor(r.atingM) + '">' + (r.metaM > 0 ? fmtPct(r.atingM) : '—') + '</span>';
        html += '<div class="ranking-bar-wrap"><div class="ranking-bar" style="width:' + barW + '%;background:' + pctColor(r.atingY) + '"></div></div>';
        html += '<span class="ranking-val">' + fmtBRL(r.realY) + '</span>';
        html += '<span class="ranking-pct" style="color:' + pctColor(r.atingY) + '">' + (r.metaY > 0 ? fmtPct(r.atingY) : '—') + '</span>';
        html += '</div>';
    }
    var atingTotalM = totalMetaM > 0 ? totalRealM / totalMetaM * 100 : 0;
    var atingTotalY = totalMetaY > 0 ? totalRealY / totalMetaY * 100 : 0;
    html += '<div class="ranking-row total-row"><span></span><span class="ranking-name" style="font-weight:700">TOTAL</span>';
    html += '<span class="ranking-val">' + fmtBRL(totalRealM) + '</span>';
    html += '<span class="ranking-pct" style="color:' + pctColor(atingTotalM) + '">' + fmtPct(atingTotalM) + '</span><span></span>';
    html += '<span class="ranking-val">' + fmtBRL(totalRealY) + '</span>';
    html += '<span class="ranking-pct" style="color:' + pctColor(atingTotalY) + '">' + fmtPct(atingTotalY) + '</span></div>';

    container.innerHTML = html;
    var rc = document.getElementById('rank-count');
    if (rc) rc.textContent = rows.length + ' consultores';
}

/* ═══ RENDER DAILY CHART ═══ */
function renderDailyChart(movMonth, metaMonth, daysInMonth, todayDay, year, monthIdx, accentColor) {
    accentColor = accentColor || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00d4aa';
    var byDay = {}, i;
    for (i = 0; i < movMonth.length; i++) {
        var dt = movMonth[i].data_faturamento;
        if (!dt) continue;
        var day = parseInt(dt.split('-')[2]);
        if (!byDay[day]) byDay[day] = 0;
        byDay[day] += movMonth[i]._valor;
    }
    var metaDia = metaMonth / daysInMonth;
    var cumData = [], dailyData = [], cum = 0;
    var maxCum = metaDia * daysInMonth, maxDaily = metaDia;
    for (i = 1; i <= todayDay; i++) {
        var val = byDay[i] || 0;
        cum += val; cumData.push({ day: i, val: cum }); dailyData.push({ day: i, val: val });
        if (cum > maxCum) maxCum = cum; if (val > maxDaily) maxDaily = val;
    }
    var metaCumData = [];
    for (i = 1; i <= daysInMonth; i++) metaCumData.push({ day: i, val: metaDia * i });
    if (metaDia * daysInMonth > maxCum) maxCum = metaDia * daysInMonth;

    var W = 800, H = 200, padL = 60, padR = 10, padT = 10, padB = 28;
    var chartW = W - padL - padR, chartH = H - padT - padB;
    function xPos(day) { return padL + ((day - 1) / (daysInMonth - 1)) * chartW; }
    function yPosCum(val) { return padT + chartH - (val / maxCum) * chartH; }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:100%" preserveAspectRatio="none">';

    for (i = 0; i <= 4; i++) {
        var gy = padT + (chartH / 4) * i;
        var gval = maxCum * (1 - i / 4);
        svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="rgba(30,42,58,.5)" stroke-width="0.5"/>';
        svg += '<text x="' + (padL - 4) + '" y="' + (gy + 3) + '" text-anchor="end" fill="#5a6a7a" font-family="JetBrains Mono" font-size="8">' + fmtBRL(gval) + '</text>';
    }
    for (i = 1; i <= daysInMonth; i += (daysInMonth > 28 ? 2 : 1)) {
        var lx = xPos(i);
        var dayDate = new Date(year, monthIdx, i);
        var isWE = (dayDate.getDay() === 0 || dayDate.getDay() === 6);
        var isT = (i === todayDay);
        svg += '<text x="' + lx + '" y="' + (H - 4) + '" text-anchor="middle" fill="' + (isT ? accentColor : isWE ? '#ffa502' : '#5a6a7a') + '" font-family="JetBrains Mono" font-size="8" font-weight="' + (isT ? '700' : '400') + '">' + i + '</text>';
    }
    if (todayDay >= 1) {
        svg += '<line x1="' + xPos(todayDay) + '" y1="' + padT + '" x2="' + xPos(todayDay) + '" y2="' + (padT + chartH) + '" stroke="' + accentColor + '" stroke-width="1" stroke-dasharray="3,3" opacity="0.3"/>';
    }

    var metaPath = '';
    for (i = 0; i < metaCumData.length; i++) metaPath += (i === 0 ? 'M' : 'L') + xPos(metaCumData[i].day) + ',' + yPosCum(metaCumData[i].val);
    svg += '<path d="' + metaPath + '" fill="none" stroke="#ffa502" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>';

    if (cumData.length > 0) {
        var areaPath = 'M' + xPos(cumData[0].day) + ',' + (padT + chartH);
        for (i = 0; i < cumData.length; i++) areaPath += 'L' + xPos(cumData[i].day) + ',' + yPosCum(cumData[i].val);
        areaPath += 'L' + xPos(cumData[cumData.length - 1].day) + ',' + (padT + chartH) + 'Z';
        svg += '<path d="' + areaPath + '" fill="url(#areaGrad)" opacity="0.3"/>';
        svg += '<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + accentColor + '" stop-opacity="0.4"/><stop offset="100%" stop-color="' + accentColor + '" stop-opacity="0.02"/></linearGradient></defs>';

        var cumPath = '';
        for (i = 0; i < cumData.length; i++) cumPath += (i === 0 ? 'M' : 'L') + xPos(cumData[i].day) + ',' + yPosCum(cumData[i].val);
        svg += '<path d="' + cumPath + '" fill="none" stroke="' + accentColor + '" stroke-width="2"/>';

        for (i = 0; i < cumData.length; i++) {
            var hasData = (byDay[cumData[i].day] || 0) > 0;
            if (hasData || cumData[i].day === todayDay) {
                svg += '<circle cx="' + xPos(cumData[i].day) + '" cy="' + yPosCum(cumData[i].val) + '" r="' + (cumData[i].day === todayDay ? 4 : 2.5) + '" fill="' + (cumData[i].day === todayDay ? '#fff' : accentColor) + '" stroke="' + accentColor + '" stroke-width="1.5"/>';
            }
        }
        var last = cumData[cumData.length - 1];
        svg += '<text x="' + (xPos(last.day) + 6) + '" y="' + (yPosCum(last.val) + 3) + '" fill="' + accentColor + '" font-family="JetBrains Mono" font-size="10" font-weight="700">' + fmtBRL(last.val) + '</text>';
    }
    for (i = 0; i < dailyData.length; i++) {
        if (dailyData[i].val > 0) {
            var bx = xPos(dailyData[i].day);
            var bh = (dailyData[i].val / maxCum) * chartH;
            svg += '<rect x="' + (bx - 3) + '" y="' + (padT + chartH - bh) + '" width="6" height="' + bh + '" fill="' + accentColor + '" opacity="0.12" rx="1"/>';
        }
    }
    svg += '</svg>';

    var legend = '<div class="chart-legend">';
    legend += '<span><span class="chart-legend-dot" style="background:' + accentColor + '"></span>Acumulado: ' + fmtBRL(cum) + '</span>';
    legend += '<span><span class="chart-legend-dot" style="background:none;border:1px dashed #ffa502"></span>Meta: ' + fmtBRL(metaMonth) + '</span>';
    legend += '<span>Meta/dia: ' + fmtBRL(metaDia) + '</span>';
    legend += '<span>' + todayDay + ' de ' + daysInMonth + ' dias</span>';
    legend += '</div>';

    var chartEl = document.getElementById('dailyChart');
    if (chartEl) chartEl.innerHTML = '<div class="chart-svg-wrap">' + svg + '</div>' + legend;
    var chartLabel = document.getElementById('chart-meta-label');
    if (chartLabel) chartLabel.textContent = fmtBRL(cum) + ' / ' + fmtBRL(metaMonth);
}

/* ═══ RENDER CARTEIRA TABLE ═══ */
function renderCarteira(carteira, profMap, carteiraTotal) {
    var byRep = {}, pedidosSet = {}, i;
    for (i = 0; i < carteira.length; i++) {
        var rep = carteira[i].representante || carteira[i].consultor || 'N/D';
        rep = profMap[rep] || rep;
        if (!byRep[rep]) byRep[rep] = { valor: 0, pedidos: {} };
        byRep[rep].valor += safeNum(carteira[i].vlr_carteira != null ? carteira[i].vlr_carteira : carteira[i].vlr_total);
        var pedKey = (carteira[i].chave_cliente || carteira[i].nome_cliente || '') + '|' + (carteira[i].dt_pedido || '');
        byRep[rep].pedidos[pedKey] = true;
        pedidosSet[pedKey] = true;
    }
    var rows = [], rep;
    for (rep in byRep) rows.push({ nome: rep, valor: byRep[rep].valor, count: Object.keys(byRep[rep].pedidos).length });
    rows.sort(function(a, b) { return b.valor - a.valor; });
    var totalPedidos = Object.keys(pedidosSet).length;

    var html = '';
    for (i = 0; i < Math.min(rows.length, 14); i++) {
        html += '<tr><td><span class="cart-name">' + escHtml(rows[i].nome) + '</span></td>';
        html += '<td class="cart-val">' + fmtBRL(rows[i].valor) + '</td>';
        html += '<td class="cart-count">' + rows[i].count + '</td></tr>';
    }
    var body = document.getElementById('cartBody');
    if (body) body.innerHTML = html;
    var total = document.getElementById('cart-total');
    if (total) total.textContent = fmtBRL(carteiraTotal) + ' | ' + totalPedidos + ' pedidos';
}

/* ═══ DRILLDOWN MODAL ═══ */
function closeDrilldown(){var ov=document.getElementById('dd-overlay');if(ov)ov.remove();}

function openDrilldown(title,subtitle,bodyHtml){
    closeDrilldown();
    var ov=document.createElement('div');ov.id='dd-overlay';ov.className='dd-overlay';
    ov.onclick=function(e){if(e.target===ov)closeDrilldown();};
    ov.innerHTML='<div class="dd-modal"><div class="dd-header"><div><div class="dd-title">'+escHtml(title)+'</div>'+(subtitle?'<div class="dd-subtitle">'+escHtml(subtitle)+'</div>':'')+'</div><button class="dd-close" onclick="closeDrilldown()">✕</button></div><div class="dd-body">'+bodyHtml+'</div></div>';
    document.body.appendChild(ov);
    /* ESC to close */
    var esc=function(e){if(e.key==='Escape'){closeDrilldown();document.removeEventListener('keydown',esc);}};
    document.addEventListener('keydown',esc);
}

/* ═══ DRILLDOWN: CONSULTOR ═══ */
function ddConsultor(name){
    if(!window.G||!G.kpis)return;
    var pm=G.maps.profMap,pvm=G.maps.profVerticalMap;
    var vert=normalizeVertical(pvm[name]||'');
    var movM=G.kpis.movMonth.filter(function(m){return m.representante===name;});
    var movY=G.kpis.movYTD.filter(function(m){return m.representante===name;});
    var realM=movM.reduce(function(s,m){return s+m._valor;},0);
    var realY=movY.reduce(function(s,m){return s+m._valor;},0);
    /* Meta */
    var metaM=0,metaY=0;
    if(G.kpis.planMonth){G.kpis.planMonth.forEach(function(p){if(matchPlanName(p.consultor,name))metaM+=safeNum(p.valor);});}
    if(G.kpis.planYTD){G.kpis.planYTD.forEach(function(p){if(matchPlanName(p.consultor,name))metaY+=safeNum(p.valor);});}
    var pctM=metaM>0?realM/metaM*100:0,pctY=metaY>0?realY/metaY*100:0;
    /* Carteira */
    var cart=(G.carteira||[]).filter(function(c){var rep=pm[c.representante||c.consultor||'']||(c.representante||c.consultor||'');return rep===name||c.representante===name;});
    var cartTotal=cart.reduce(function(s,c){return s+safeNum(c.vlr_carteira!=null?c.vlr_carteira:c.vlr_total);},0);
    /* KPIs */
    var h='<div class="dd-kpis">';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Meta Mês</div><div class="dd-kpi-val" style="color:var(--text)">'+fmtBRL(metaM)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Real Mês</div><div class="dd-kpi-val" style="color:'+pctColor(pctM)+'">'+fmtBRL(realM)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">% Mês</div><div class="dd-kpi-val" style="color:'+pctColor(pctM)+'">'+fmtPct(pctM)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Carteira</div><div class="dd-kpi-val" style="color:var(--amber)">'+fmtBRL(cartTotal)+'</div></div>';
    h+='</div>';
    h+='<div class="dd-kpis" style="grid-template-columns:repeat(3,1fr)">';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Meta YTD</div><div class="dd-kpi-val" style="color:var(--text)">'+fmtBRL(metaY)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Real YTD</div><div class="dd-kpi-val" style="color:'+pctColor(pctY)+'">'+fmtBRL(realY)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">% YTD</div><div class="dd-kpi-val" style="color:'+pctColor(pctY)+'">'+fmtPct(pctY)+'</div></div>';
    h+='</div>';
    /* Top clientes do mês */
    var byCli={};
    movM.forEach(function(m){var c=(m.nome_cliente||'').toUpperCase().trim();if(!byCli[c])byCli[c]={val:0,prod:{}};byCli[c].val+=m._valor;byCli[c].prod[m.produto_nome||'']=true;});
    var cliRows=[];for(var c in byCli)cliRows.push({c:c,v:byCli[c].val,np:Object.keys(byCli[c].prod).length});
    cliRows.sort(function(a,b){return b.v-a.v;});
    if(cliRows.length>0){
        h+='<div class="dd-section"><div class="dd-section-title">Clientes do Mês ('+cliRows.length+')</div>';
        h+='<table class="dd-table"><thead><tr><th>Cliente</th><th>Valor</th><th>Produtos</th></tr></thead><tbody>';
        var tCli=0;
        cliRows.slice(0,15).forEach(function(r,i){tCli+=r.v;
            h+='<tr><td style="cursor:pointer;color:var(--text)" onclick="ddCliente(\''+r.c.replace(/'/g,"\\'")+'\')">'+(i<3?'<b>':'')+escHtml(r.c)+(i<3?'</b>':'')+'</td><td style="color:var(--accent);font-weight:700">'+fmtBRL(r.v)+'</td><td>'+r.np+'</td></tr>';
        });
        h+='<tr class="dd-tot"><td>TOTAL</td><td style="color:var(--accent)">'+fmtBRL(tCli)+'</td><td></td></tr>';
        h+='</tbody></table></div>';
    }
    /* Evolução mensal */
    if(G.movFiltered){
        var MN=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        h+='<div class="dd-section"><div class="dd-section-title">Evolução Mensal '+G.year+'</div>';
        h+='<table class="dd-table"><thead><tr><th>Mês</th><th>Meta</th><th>Real</th><th>%</th></tr></thead><tbody>';
        var sM=0,sR=0;
        for(var mo=1;mo<=12;mo++){
            var ms=String(mo).padStart(2,'0'),per=G.year+'-'+ms;
            var mMo=0;
            if(G.planData)(G.planData).forEach(function(p){if(p.id_tempo===per&&matchPlanName(p.consultor,name))mMo+=safeNum(p.valor);});
            var rMo=G.movFiltered.filter(function(m){return m.id_tempo===per&&m.representante===name;}).reduce(function(s,m){return s+m._valor;},0);
            var pMo=mMo>0?rMo/mMo*100:0;sM+=mMo;sR+=rMo;
            var iC=mo===G.monthNum,iF=mo>G.monthNum;
            if(mMo===0&&rMo===0&&iF)continue;
            h+='<tr style="'+(iC?'background:rgba(34,197,94,.06)':'')+(iF?'opacity:.4':'')+'"><td style="color:var(--text-muted);font-weight:600">'+MN[mo-1]+'</td><td>'+fmtBRL(mMo)+'</td><td style="color:var(--accent);font-weight:600">'+(rMo>0?fmtBRL(rMo):'—')+'</td><td style="color:'+pctColor(pMo)+';font-weight:700">'+(mMo>0&&rMo>0?fmtPct(pMo):'—')+'</td></tr>';
        }
        var pT=sM>0?sR/sM*100:0;
        h+='<tr class="dd-tot"><td>TOTAL</td><td>'+fmtBRL(sM)+'</td><td style="color:var(--accent)">'+fmtBRL(sR)+'</td><td style="color:'+pctColor(pT)+'">'+fmtPct(pT)+'</td></tr>';
        h+='</tbody></table></div>';
    }
    /* Carteira detalhe */
    if(cart.length>0){
        h+='<div class="dd-section"><div class="dd-section-title">Carteira de Pedidos ('+cart.length+')</div>';
        h+='<table class="dd-table"><thead><tr><th>Cliente</th><th>Produto</th><th>Valor</th><th>Entrega</th></tr></thead><tbody>';
        cart.sort(function(a,b){return safeNum(b.vlr_carteira||b.vlr_total)-safeNum(a.vlr_carteira||a.vlr_total);});
        cart.slice(0,20).forEach(function(c){
            var dp=(c.dt_previsao_entrega||'').split('-');
            var ov=c.dt_previsao_entrega&&new Date(c.dt_previsao_entrega+'T00:00:00')<new Date();
            h+='<tr style="'+(ov?'color:var(--red)':'')+'"><td>'+escHtml(c.nome_cliente||'')+'</td><td>'+escHtml(c.produto_nome||'')+'</td><td style="font-weight:700;color:'+(ov?'var(--red)':'var(--accent)')+'">'+fmtBRL(safeNum(c.vlr_carteira||c.vlr_total))+'</td><td>'+(dp.length===3?dp[2]+'/'+dp[1]+'/'+dp[0]:'')+'</td></tr>';
        });
        h+='</tbody></table></div>';
    }
    openDrilldown(name,vert?vert+' · Consultor':'Consultor',h);
}

/* ═══ DRILLDOWN: CLIENTE ═══ */
function ddCliente(name){
    if(!window.G||!G.kpis)return;
    var nameU=name.toUpperCase().trim();
    var pvm=G.maps.profVerticalMap;
    /* Faturamento mês */
    var movM=G.kpis.movMonth.filter(function(m){return(m.nome_cliente||'').toUpperCase().trim()===nameU;});
    var movY=G.kpis.movYTD.filter(function(m){return(m.nome_cliente||'').toUpperCase().trim()===nameU;});
    var realM=movM.reduce(function(s,m){return s+m._valor;},0);
    var realY=movY.reduce(function(s,m){return s+m._valor;},0);
    /* Consultor */
    var rep=movM.length>0?(movM[0].representante||''):(movY.length>0?(movY[0].representante||''):'');
    var vert=normalizeVertical(pvm[rep]||'');
    /* Meta do plano */
    var metaM=0,metaY=0;
    if(G.kpis.planMonth)G.kpis.planMonth.forEach(function(p){if((p.cliente||'').toUpperCase().trim()===nameU||matchPlanName(p.cliente,nameU))metaM+=safeNum(p.valor);});
    if(G.kpis.planYTD)G.kpis.planYTD.forEach(function(p){if((p.cliente||'').toUpperCase().trim()===nameU||matchPlanName(p.cliente,nameU))metaY+=safeNum(p.valor);});
    var pctM=metaM>0?realM/metaM*100:0;
    /* Carteira */
    var cart=(G.carteira||[]).filter(function(c){return(c.nome_cliente||'').toUpperCase().trim()===nameU;});
    var cartTotal=cart.reduce(function(s,c){return s+safeNum(c.vlr_carteira!=null?c.vlr_carteira:c.vlr_total);},0);
    /* KPIs */
    var h='<div class="dd-kpis">';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Mês</div><div class="dd-kpi-val" style="color:var(--accent)">'+fmtBRL(realM)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Meta Mês</div><div class="dd-kpi-val" style="color:var(--text)">'+fmtBRL(metaM)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">YTD</div><div class="dd-kpi-val" style="color:var(--accent)">'+fmtBRL(realY)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Carteira</div><div class="dd-kpi-val" style="color:var(--amber)">'+fmtBRL(cartTotal)+'</div></div>';
    h+='</div>';
    if(rep)h+='<div style="font-family:var(--mono);font-size:9px;color:var(--text-muted);margin-bottom:10px">Consultor: <span style="color:var(--text);font-weight:600;cursor:pointer" onclick="ddConsultor(\''+rep.replace(/'/g,"\\'")+'\')">' +escHtml(rep)+'</span>'+(vert?' · <span style="color:'+vertColorSafe(vert)+'">'+vert+'</span>':'')+'</div>';
    /* Produtos do mês */
    var byProd={};
    movM.forEach(function(m){var p=m.produto_nome||'(s/ prod.)';if(!byProd[p])byProd[p]={val:0,qt:0};byProd[p].val+=m._valor;byProd[p].qt+=safeNum(m.quantidade);});
    var prodRows=[];for(var p in byProd)prodRows.push({p:p,v:byProd[p].val,q:byProd[p].qt});
    prodRows.sort(function(a,b){return b.v-a.v;});
    if(prodRows.length>0){
        h+='<div class="dd-section"><div class="dd-section-title">Produtos do Mês</div>';
        h+='<table class="dd-table"><thead><tr><th>Produto</th><th>Qt</th><th>Valor</th></tr></thead><tbody>';
        prodRows.forEach(function(r){
            h+='<tr><td style="cursor:pointer" onclick="ddProduto(\''+r.p.replace(/'/g,"\\'")+'\')">' +escHtml(r.p)+'</td><td>'+r.q.toLocaleString('pt-BR',{maximumFractionDigits:0})+'</td><td style="color:var(--accent);font-weight:700">'+fmtBRL(r.v)+'</td></tr>';
        });
        h+='</tbody></table></div>';
    }
    /* Evolução mensal */
    if(G.movFiltered){
        var MN=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        h+='<div class="dd-section"><div class="dd-section-title">Histórico Mensal '+G.year+'</div>';
        h+='<table class="dd-table"><thead><tr><th>Mês</th><th>Meta</th><th>Real</th><th>%</th></tr></thead><tbody>';
        var sM=0,sR=0;
        for(var mo=1;mo<=12;mo++){
            var ms=String(mo).padStart(2,'0'),per=G.year+'-'+ms;
            var mMo=0;
            if(G.planData)(G.planData).forEach(function(p){if(p.id_tempo===per&&((p.cliente||'').toUpperCase().trim()===nameU||matchPlanName(p.cliente,nameU)))mMo+=safeNum(p.valor);});
            var rMo=G.movFiltered.filter(function(m){return m.id_tempo===per&&(m.nome_cliente||'').toUpperCase().trim()===nameU;}).reduce(function(s,m){return s+m._valor;},0);
            var pMo=mMo>0?rMo/mMo*100:0;sM+=mMo;sR+=rMo;
            var iC=mo===G.monthNum,iF=mo>G.monthNum;
            if(mMo===0&&rMo===0&&iF)continue;
            h+='<tr style="'+(iC?'background:rgba(34,197,94,.06)':'')+(iF?'opacity:.4':'')+'"><td style="color:var(--text-muted);font-weight:600">'+MN[mo-1]+'</td><td>'+fmtBRL(mMo)+'</td><td style="color:var(--accent);font-weight:600">'+(rMo>0?fmtBRL(rMo):'—')+'</td><td style="color:'+pctColor(pMo)+';font-weight:700">'+(mMo>0&&rMo>0?fmtPct(pMo):'—')+'</td></tr>';
        }
        var pT=sM>0?sR/sM*100:0;
        h+='<tr class="dd-tot"><td>TOTAL</td><td>'+fmtBRL(sM)+'</td><td style="color:var(--accent)">'+fmtBRL(sR)+'</td><td style="color:'+pctColor(pT)+'">'+fmtPct(pT)+'</td></tr>';
        h+='</tbody></table></div>';
    }
    /* Carteira detalhe */
    if(cart.length>0){
        h+='<div class="dd-section"><div class="dd-section-title">Carteira Pendente</div>';
        h+='<table class="dd-table"><thead><tr><th>Produto</th><th>Qt</th><th>Valor</th><th>Entrega</th></tr></thead><tbody>';
        cart.forEach(function(c){
            var dp=(c.dt_previsao_entrega||'').split('-');
            var ov=c.dt_previsao_entrega&&new Date(c.dt_previsao_entrega+'T00:00:00')<new Date();
            h+='<tr style="'+(ov?'color:var(--red)':'')+'"><td>'+escHtml(c.produto_nome||'')+'</td><td>'+safeNum(c.quantidade||c.volume_total).toLocaleString('pt-BR',{maximumFractionDigits:0})+'</td><td style="font-weight:700;color:'+(ov?'var(--red)':'var(--accent)')+'">'+fmtBRL(safeNum(c.vlr_carteira||c.vlr_total))+'</td><td>'+(dp.length===3?dp[2]+'/'+dp[1]+'/'+dp[0]:'')+'</td></tr>';
        });
        h+='</tbody></table></div>';
    }
    openDrilldown(name,rep?'Consultor: '+rep:'Cliente',h);
}

/* ═══ DRILLDOWN: PRODUTO ═══ */
function ddProduto(name){
    if(!window.G||!G.kpis)return;
    var nameU=(name||'').toUpperCase().trim();
    var movM=G.kpis.movMonth.filter(function(m){return(m.produto_nome||'').toUpperCase().trim()===nameU;});
    var movY=G.kpis.movYTD.filter(function(m){return(m.produto_nome||'').toUpperCase().trim()===nameU;});
    var realM=movM.reduce(function(s,m){return s+m._valor;},0);
    var realY=movY.reduce(function(s,m){return s+m._valor;},0);
    var qtM=movM.reduce(function(s,m){return s+safeNum(m.quantidade);},0);
    /* Meta */
    var metaM=0;
    if(G.kpis.planMonth)G.kpis.planMonth.forEach(function(p){if((p.produto||'').toUpperCase().trim()===nameU)metaM+=safeNum(p.valor);});
    var pctM=metaM>0?realM/metaM*100:0;
    /* KPIs */
    var h='<div class="dd-kpis">';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Mês</div><div class="dd-kpi-val" style="color:var(--accent)">'+fmtBRL(realM)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Meta</div><div class="dd-kpi-val" style="color:var(--text)">'+fmtBRL(metaM)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">YTD</div><div class="dd-kpi-val" style="color:var(--accent)">'+fmtBRL(realY)+'</div></div>';
    h+='<div class="dd-kpi"><div class="dd-kpi-label">Qt Mês</div><div class="dd-kpi-val" style="color:var(--blue)">'+qtM.toLocaleString('pt-BR',{maximumFractionDigits:0})+'</div></div>';
    h+='</div>';
    /* Por consultor */
    var byRep={};
    movM.forEach(function(m){var r=m.representante||'N/D';if(!byRep[r])byRep[r]={val:0};byRep[r].val+=m._valor;});
    var repRows=[];for(var r in byRep)repRows.push({n:r,v:byRep[r].val});
    repRows.sort(function(a,b){return b.v-a.v;});
    if(repRows.length>0){
        var mxR=repRows[0].v||1;
        h+='<div class="dd-section"><div class="dd-section-title">Por Consultor (Mês)</div>';
        repRows.forEach(function(r){
            var bw=Math.min(r.v/mxR*100,100);
            h+='<div class="dd-bar-row"><span class="dd-bar-label" style="cursor:pointer" onclick="ddConsultor(\''+r.n.replace(/'/g,"\\'")+'\')">' +escHtml(r.n)+'</span><div class="dd-bar-track"><div class="dd-bar-fill" style="width:'+bw+'%;background:var(--accent)"></div></div><span class="dd-bar-val">'+fmtBRL(r.v)+'</span></div>';
        });
        h+='</div>';
    }
    /* Top clientes */
    var byCli={};
    movM.forEach(function(m){var c=(m.nome_cliente||'').toUpperCase().trim();if(!byCli[c])byCli[c]={val:0,rep:m.representante};byCli[c].val+=m._valor;});
    var cliRows=[];for(var c in byCli)cliRows.push({c:c,v:byCli[c].val,rep:byCli[c].rep});
    cliRows.sort(function(a,b){return b.v-a.v;});
    if(cliRows.length>0){
        h+='<div class="dd-section"><div class="dd-section-title">Top Clientes (Mês)</div>';
        h+='<table class="dd-table"><thead><tr><th>Cliente</th><th>Consultor</th><th>Valor</th></tr></thead><tbody>';
        cliRows.slice(0,15).forEach(function(r){
            h+='<tr><td style="cursor:pointer" onclick="ddCliente(\''+r.c.replace(/'/g,"\\'")+'\')">' +escHtml(r.c)+'</td><td>'+escHtml(r.rep||'')+'</td><td style="color:var(--accent);font-weight:700">'+fmtBRL(r.v)+'</td></tr>';
        });
        h+='</tbody></table></div>';
    }
    /* Evolução mensal */
    if(G.movFiltered){
        var MN=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        h+='<div class="dd-section"><div class="dd-section-title">Evolução Mensal '+G.year+'</div>';
        h+='<table class="dd-table"><thead><tr><th>Mês</th><th>Real</th></tr></thead><tbody>';
        var sR=0;
        for(var mo=1;mo<=12;mo++){
            var ms=String(mo).padStart(2,'0'),per=G.year+'-'+ms;
            var rMo=G.movFiltered.filter(function(m){return m.id_tempo===per&&(m.produto_nome||'').toUpperCase().trim()===nameU;}).reduce(function(s,m){return s+m._valor;},0);
            sR+=rMo;
            var iC=mo===G.monthNum,iF=mo>G.monthNum;
            if(rMo===0&&iF)continue;
            h+='<tr style="'+(iC?'background:rgba(34,197,94,.06)':'')+(iF?'opacity:.4':'')+'"><td style="color:var(--text-muted);font-weight:600">'+MN[mo-1]+'</td><td style="color:var(--accent);font-weight:600">'+(rMo>0?fmtBRL(rMo):'—')+'</td></tr>';
        }
        h+='<tr class="dd-tot"><td>TOTAL</td><td style="color:var(--accent)">'+fmtBRL(sR)+'</td></tr>';
        h+='</tbody></table></div>';
    }
    openDrilldown(name,'Produto',h);
}

/* Helper for safe vert color in inline context */
function vertColorSafe(v){
    if(v==='AGRO')return '#22c55e';if(v==='AGUA')return '#2d8cf0';
    if(v==='FLORESTAS')return '#f0a500';if(v==='CORPORATIVO')return '#8b5cf6';
    return '#4d6278';
}

/* ═══ CLICKABLE NAME HELPERS ═══ */
/* Use these in render functions instead of plain escHtml */
function ddLink(type,name,displayName){
    var dn=displayName||name;
    var safe=escHtml(name).replace(/'/g,'&#39;');
    var fn=type==='consultor'?'ddConsultor':type==='cliente'?'ddCliente':'ddProduto';
    return '<span class="rn-click" onclick="'+fn+'(\''+safe+'\')" title="Clique para detalhes">'+escHtml(dn)+'</span>';
}

/* ═══ SHOW UI ═══ */
function showUI() {
    var el = function(id) { return document.getElementById(id); };
    if (el('loading')) el('loading').style.display = 'none';
    if (el('ticker')) el('ticker').style.display = 'flex';
    if (el('mainGrid')) el('mainGrid').style.display = 'grid';
    if (el('footerBar')) el('footerBar').style.display = 'flex';
    var hn = new Date();
    if (el('ft-updated')) el('ft-updated').textContent = String(hn.getHours()).padStart(2,'0') + ':' + String(hn.getMinutes()).padStart(2,'0');
    updateThemeBtn();
}
