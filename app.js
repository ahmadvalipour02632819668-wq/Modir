
// Apply Theme from LocalStorage
const savedTheme = localStorage.getItem('bm_theme') || 'default';
if (savedTheme !== 'default') document.documentElement.setAttribute('data-theme', savedTheme);

const SUPABASE_URL = 'https://fvhzshtgtkqzrgmblczh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RPqoUxTZxx-pCp06bwh0pg_dGjF5daZ';
if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  document.getElementById('app').innerHTML = '<div style="max-width:560px;margin:12vh auto;padding:24px;text-align:center;background:#fff;border-radius:18px;color:#23264a;font-family:Vazirmatn,sans-serif"><h2>خطا در بارگذاری کتابخانه اتصال</h2><p>ارتباط با سرور کتابخانه برقرار نشد. اینترنت یا دسترسی به CDN را بررسی و صفحه را دوباره بارگذاری کنید.</p><button onclick="location.reload()" style="padding:10px 20px;border:0;border-radius:10px;background:#2d3463;color:#fff">تلاش مجدد</button></div>';
  throw new Error('Supabase client library failed to load from primary and fallback CDNs');
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// Register the PWA service worker on every normal visit, not only when push notifications are enabled.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('./sw.js', document.baseURI), { scope: new URL('./', document.baseURI).pathname })
      .then(() => navigator.serviceWorker.ready)
      .catch(error => console.warn('PWA service worker registration failed:', error));
  }, { once: true });
}

let deferredInstallPrompt = null;
let installPromptDismissed = false;
function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
async function installPwa() {
  if (isAppInstalled()) return;
  if (deferredInstallPrompt) {
    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === 'accepted') {
      document.querySelectorAll('[data-install]').forEach(button => button.remove());
      document.getElementById('pwa-install-banner')?.remove();
    }
    return;
  }
  const help = /iphone|ipad|ipod/i.test(navigator.userAgent)
    ? 'برای نصب در آیفون، دکمه اشتراک‌گذاری Safari را بزنید و «افزودن به صفحه اصلی» را انتخاب کنید.'
    : 'برای نصب، منوی سه‌نقطه مرورگر را باز کنید و «Install app» یا «Add to Home screen» را انتخاب کنید.';
  alert(help);
}
function installTileHtml() {
  if (isAppInstalled()) return '';
  return `<button class="tile" type="button" data-install aria-label="نصب برنامه">
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="5" width="28" height="38" rx="5"/><path d="M24 14v15m-7-7 7 7 7-7M19 36h10"/></svg>
    <span>نصب برنامه</span>
  </button>`;
}
function renderInstallBanner() {
  const view = document.getElementById('view');
  if (!view || S.view !== 'dash' || isAppInstalled() || installPromptDismissed || !deferredInstallPrompt || document.getElementById('pwa-install-banner')) return;
  const banner = document.createElement('section');
  banner.id = 'pwa-install-banner';
  banner.style.cssText = 'margin:14px 16px 18px;padding:16px;border-radius:18px;background:linear-gradient(135deg,#2d3463,#46528f);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 8px 24px #20264a22';
  banner.innerHTML = '<div style="min-width:0"><b style="display:block;font-size:15px;margin-bottom:5px">📲 نصب اپلیکیشن ساختمان</b><span style="font-size:12px;opacity:.9">برای دسترسی سریع‌تر، برنامه را روی گوشی نصب کنید.</span></div><div style="display:flex;align-items:center;gap:8px;flex-shrink:0"><button id="pwa-install-action" style="border:0;border-radius:12px;padding:10px 16px;background:#fff;color:#2d3463;font:inherit;font-weight:800">نصب</button><button id="pwa-install-close" aria-label="بستن" style="border:0;background:transparent;color:#fff;font-size:22px;padding:2px 5px">×</button></div>';
  view.prepend(banner);
  document.getElementById('pwa-install-action').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    banner.remove();
  });
  document.getElementById('pwa-install-close').addEventListener('click', () => { installPromptDismissed = true; banner.remove(); });
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  renderInstallBanner();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.getElementById('pwa-install-banner')?.remove();
});

const PUSH_VAPID_PUBLIC_KEY = 'BMb3MKzCKqT82g57EkjMcb2b8pu3bH3UNmxZ5rtubHvXIM08iGJKOuFyYyaeH41UbbLQ5uXI2PGrgJa90u0mvzs';
let pushServiceWorkerRegistration = null;
let pushPromptShown = false;
function pushBase64UrlToBytes(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
}
async function getPushServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('مرورگر شما اعلان مستقیم را پشتیبانی نمی‌کند');
  if (!window.isSecureContext) throw new Error('برای اعلان موبایلی باید سایت با HTTPS باز شود');
  if (!pushServiceWorkerRegistration) {
    pushServiceWorkerRegistration = await navigator.serviceWorker.register(new URL('./sw.js', document.baseURI), { scope: new URL('./', document.baseURI).pathname });
    await navigator.serviceWorker.ready;
  }
  return pushServiceWorkerRegistration;
}
async function enableMobilePush() {
  if (!S.token) throw new Error('ابتدا وارد حساب شوید');
  if (!('Notification' in window)) throw new Error('مرورگر شما اعلان را پشتیبانی نمی‌کند');
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') throw new Error('اجازه نمایش اعلان داده نشد. می‌توانید از تنظیمات مرورگر آن را فعال کنید.');
  const registration = await getPushServiceWorker();
  const applicationServerKey = pushBase64UrlToBytes(PUSH_VAPID_PUBLIC_KEY);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const currentKey = subscription.options?.applicationServerKey;
    const currentBytes = currentKey ? new Uint8Array(currentKey) : null;
    const sameKey = currentBytes && currentBytes.length === applicationServerKey.length &&
      applicationServerKey.every((byte, index) => byte === currentBytes[index]);
    if (!sameKey) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  if (!subscription) subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, applicationServerKey
  });
  const json = subscription.toJSON();
  const { error } = await sb.rpc('app_push_save_subscription', {
    p_token: S.token, p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth, p_user_agent: navigator.userAgent
  });
  if (error) throw error;
}
async function detachPushSubscription(token) {
  if (!token || !('serviceWorker' in navigator)) return;
  const registration = await getPushServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription?.endpoint) return;
  const { error } = await sb.rpc('app_push_remove_subscription', {
    p_token: token, p_endpoint: subscription.endpoint
  });
  if (error) throw error;
}
function maybeAskForPushPermission() {
  if (!S.token || !('Notification' in window) || pushPromptShown) return;
  // Refresh a previously granted subscription after VAPID key rotation.
  if (Notification.permission === 'granted') {
    enableMobilePush().catch(error => {
      console.warn('Push subscription refresh failed:', error);
      if (String(error?.message || '').includes('این اشتراک اعلان قبلاً به حساب دیگری متصل شده است')) {
        toast('اعلان‌های این گوشی برای حساب دیگری فعال است. برای جابه‌جایی، ابتدا از حساب قبلی خارج شوید و دوباره وارد شوید.', true);
      }
    });
    return;
  }
  pushPromptShown = true;
  const permissionBlocked = Notification.permission === 'denied';
  const message = permissionBlocked
    ? 'دسترسی اعلان‌ها در تنظیمات مرورگر مسدود شده است. برای فعال‌سازی، مجوز اعلان این سایت را از تنظیمات مرورگر روی اجازه قرار دهید.'
    : 'برای دریافت اطلاعیه‌ها و پیام‌های مهم ساختمان، اجازه نمایش اعلان‌ها را صادر کنید.';
  const actionButton = permissionBlocked ? '' : '<button type="button" class="btn sf" id="allow-push-now" style="width:100%;margin-top:10px">اجازه می‌دهم</button>';
  const closeLabel = permissionBlocked ? 'متوجه شدم' : 'فعلاً نه';
  const prompt = modal('<div style="text-align:center;padding:10px 4px"><div style="font-size:38px;margin-bottom:8px">🔔</div><h2 style="margin:0 0 8px">فعال‌سازی اعلان‌های ساختمان</h2><p class="sub" style="line-height:1.9">' + esc(message) + '</p>' + actionButton + '<button type="button" class="btn lt" id="skip-push-now" style="width:100%;margin-top:8px">' + closeLabel + '</button><p id="push-prompt-status" class="sub" style="margin:8px 0 0"></p></div>');
  $('#skip-push-now', prompt)?.addEventListener('click', () => prompt.remove());
  $('#allow-push-now', prompt)?.addEventListener('click', async e => {
    const button = e.currentTarget;
    const status = $('#push-prompt-status', prompt);
    button.disabled = true;
    button.textContent = 'در حال فعال‌سازی...';
    try {
      await enableMobilePush();
      prompt.remove();
      toast('اعلان‌های موبایلی فعال شد');
    } catch (error) {
      if (status) status.textContent = error.message || 'فعال‌سازی اعلان‌ها ناموفق بود';
      button.disabled = false;
      button.textContent = 'تلاش دوباره';
    }
  });
}
async function sendMobilePush(event, title, body, targetAccountId = null) {
  if (!S.token) return null;
  try {
    const { data, error } = await sb.functions.invoke('send-web-push', {
      body: { token: S.token, event, title, body, target_account_id: targetAccountId, url: new URL('./', document.baseURI).pathname }
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'ارسال اعلان انجام نشد');
    if (data.sent === 0) console.info('Mobile push had no active recipient subscriptions:', data);
    return data;
  } catch (error) {
    console.warn('Mobile push failed:', error);
    return null;
  }
}


const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const CATS = { charge:'شارژ ماهیانه', water:'قبض آب', gas:'قبض گاز', electric:'برق عمومی', repair:'دریافت هزینه تعمیرات و بازسازی', parking:'اجاره پارکینگ', debt:'پرداخت بدهی معوق', other:'سایر درآمدها', bill:'کل صورتحساب ماه' };
const OCC = ['مالک ساکن','مالک','مستأجر'];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => new Intl.NumberFormat('fa-IR').format(Math.round(Number(n) || 0));
const fa = v => String(v ?? '').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const money = n => `<span style="font-feature-settings:'tnum';white-space:nowrap;color:${Number(n)<0?'var(--danger)':'inherit'}">${fmt(n)}</span>`;

const toNum = v => {
  if (!v) return 0;
  const str = String(v).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,\u066C\u066B\s]/g, '').replace(/[^\d.-]/g, '');
  return Number(str) || 0;
};

function setTheme(theme) {
  if (theme === 'default') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('bm_theme', theme);
  $$('.theme-dot').forEach(d => d.classList.toggle('active', d.dataset.t === theme));
}

function jalaliToday() {
  try {
    const p = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', { year:'numeric', month:'numeric', day:'numeric' }).formatToParts(new Date());
    const g = t => Number(p.find(x => x.type === t)?.value);
    return { y: g('year'), m: g('month'), d: g('day') };
  } catch {
    const d = new Date();
    return { y: d.getFullYear() - 621, m: d.getMonth() + 1, d: d.getDate() };
  }
}
const TODAY = jalaliToday();
function jalaliDatePicker(label, name, value='', id='', required=true) {
  const v=normalizeJalaliDigits(value), p=/^(\d{4})\/(\d{2})\/(\d{2})$/.exec(v);
  const y=p?+p[1]:TODAY.y, mo=p?+p[2]:TODAY.m, d=p?+p[3]:0, years=Array.from({length:201},(_,i)=>1300+i);
  const yearOpts=years.map(n=>'<option value="'+n+'" '+(n===y?'selected':'')+'>'+fa(n)+'</option>').join('');
  const monthOpts=MONTHS.map((n,i)=>'<option value="'+(i+1)+'" '+(i+1===mo?'selected':'')+'>'+n+'</option>').join('');
  return '<label class="f">'+label+'<div class="jalali-calendar" data-jalali-picker><div class="jalali-calendar-head"><select data-jp-month aria-label="ماه">'+monthOpts+'</select><select data-jp-year aria-label="سال">'+yearOpts+'</select></div><div class="jalali-calendar-week">'+['ش','ی','د','س','چ','پ','ج'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="jalali-calendar-days" data-jp-days>'+jalaliCalendarDays(y,mo,d)+'</div></div><input type="hidden" '+(id?'id="'+id+'" ':'')+(name?'name="'+name+'" ':'')+(required?'required ':'')+'value="'+(p?v:'')+'"></label>';
}
function jalaliCalendarDays(y,m,selected) {
  const first=jalaliToGregorianDate(y+'/'+String(m).padStart(2,'0')+'/01');
  const offset=(new Date(first+'T00:00:00Z').getUTCDay()+1)%7, count=jalaliMonthDays(y,m);
  return Array.from({length:offset},()=>'<span class="jalali-calendar-empty"></span>').join('')+
    Array.from({length:count},(_,i)=>{const day=i+1;return '<button type="button" class="jalali-day '+(day===selected?'selected':'')+'" data-jp-day="'+day+'" aria-label="روز '+fa(day)+'">'+fa(day)+'</button>';}).join('');
}
document.addEventListener('change',e=>{
  const picker=e.target.closest('[data-jalali-picker]'); if(!picker)return;
  const y=Number(picker.querySelector('[data-jp-year]').value),m=Number(picker.querySelector('[data-jp-month]').value);
  const hidden=picker.parentElement.querySelector('input[type="hidden"]'),old=Number(hidden.value.split('/')[2])||0,max=jalaliMonthDays(y,m),day=Math.min(old,max);
  picker.querySelector('[data-jp-days]').innerHTML=jalaliCalendarDays(y,m,day);
  hidden.value=day?y+'/'+String(m).padStart(2,'0')+'/'+String(day).padStart(2,'0'):'';
});
document.addEventListener('click',e=>{
  const dayButton=e.target.closest('[data-jp-day]'); if(!dayButton)return;
  const picker=dayButton.closest('[data-jalali-picker]'); if(!picker)return;
  const y=Number(picker.querySelector('[data-jp-year]').value),m=Number(picker.querySelector('[data-jp-month]').value),d=Number(dayButton.dataset.jpDay);
  const hidden=picker.parentElement.querySelector('input[type="hidden"]');
  hidden.value=y+'/'+String(m).padStart(2,'0')+'/'+String(d).padStart(2,'0');
  picker.querySelector('[data-jp-days]').innerHTML=jalaliCalendarDays(y,m,d);
});


function debounce(fn, ms = 300) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function toast(msg, err = false) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.className = 'toast on' + (err ? ' err' : '');
  clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast', 3200);
}
const showErr = e => toast(e?.message === 'NETWORK_ERROR' ? 'اتصال به سرور برقرار نیست' : (e?.message || 'خطا'), true);

function attachNumericInputIn(root, ...selectors) {
  selectors.forEach(sel => {
    $$(sel, root).forEach(el => {
      el.addEventListener('input', e => {
        const n = toNum(e.target.value); e.target.value = n ? fmt(n) : '';
      });
    });
  });
}
const attachNumericInput = (...sels) => attachNumericInputIn(document, ...sels);

async function notifyBale(msg, imageBase64 = null) {
  try {
    if (!S.token || !S.me?.building_id) throw new Error('اطلاعات ساختمان یا نشست کاربر موجود نیست');
    const payload = { app_token: S.token, building_id: Number(S.me.building_id), text: msg };
    if (imageBase64) payload.image = imageBase64;
    const { data, error } = await sb.functions.invoke('send-bale', { body: payload });
    if (error) {
      let detail = error.message || 'ارسال به بله ناموفق بود';
      try {
        const response = error.context;
        if (response && typeof response.clone === 'function') {
          const body = await response.clone().json();
          if (body?.error) detail = body.error;
        }
      } catch (_) {}
      throw new Error(detail);
    }
    if (!data?.success) throw new Error(data?.error || 'ارسال به بله ناموفق بود');
    S.lastBaleError = '';
    console.log('✅ Bale: پیام با موفقیت ارسال شد');
    return true;
  } catch(e) {
    S.lastBaleError = e?.message || 'ارسال به بله ناموفق بود';
    console.warn('❌ Bale: ارسال پیام ناموفق بود:', e);
    return false;
  }
}

const S = {
  unitCount: 10,
  token: sessionStorage.getItem('bm_token'),
  me: JSON.parse(sessionStorage.getItem('bm_me') || 'null'),
  view: 'dash', y: TODAY.y, m: TODAY.m, building: 'مجتمع نگین ۲', txFilter: null, renderId: 0, lastBaleError: '',
};
localStorage.removeItem('bm_token');

function isNetworkError(msg) { return !!msg && /failed to fetch|network|fetch|timeout|ECONN|ERR_NETWORK|ERR_INTERNET/i.test(String(msg)); }
async function api(fn, args = {}) {
  let timeoutId;
  try {
    const request = sb.rpc(fn, args);
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('NETWORK_ERROR')), 20000);
    });
    const { data, error } = await Promise.race([request, timeout]);
    if (error) {
      const rawMsg = error.message || '';
      if (rawMsg.includes('AUTH_REQUIRED')) { logout(true); throw new Error('AUTH_ERROR'); }
      if (isNetworkError(rawMsg)) throw new Error('NETWORK_ERROR');
      throw new Error(rawMsg.replace(/^AUTH_REQUIRED:\s*/, '') || 'خطا در ارتباط با سرور');
    }
    return data;
  } catch (e) {
    if (isNetworkError(e.message) || e.message === 'NETWORK_ERROR') throw new Error('NETWORK_ERROR');
    throw e;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
const T = (fn, args = {}) => api(fn, { p_token: S.token, ...args });

/* Modir AI assistant: short-lived conversational context; no private account/finance data is sent. */
let modirAiBusy = false;
let modirAiHistory = [];
let modirAiHistoryToken = '';
function modirAiMount(){
 const launch=document.getElementById('modir-ai-launch'), panel=document.getElementById('modir-ai-panel');
 if(!launch||!panel)return;
 if(modirAiHistoryToken!==S.token){modirAiHistory=[];modirAiHistoryToken=S.token||'';}
 launch.style.display=S.token?'flex':'none';
  const faqBox=document.getElementById('modir-ai-faq');
  if(faqBox&&S.me?.is_admin){
   const managerFaqs=['شارژ ماهانه را چطور ثبت کنم؟','قبض آب یا گاز را چطور ثبت و تقسیم کنم؟','هزینه تعمیرات را چطور ثبت کنم؟','پرداخت ساکن را چطور تأیید کنم؟','درخواست‌های ساکنان را کجا بررسی کنم؟','چطور برای ساکنان اطلاعیه بفرستم؟','بدهی واحدها را چطور ببینم؟','مشخصات واحدها را چطور ویرایش کنم؟','اتصال ربات بله به گروه ساختمان چطور کار می‌کند؟'];
   faqBox.innerHTML=managerFaqs.map(q=>'<button type="button" data-faq="'+q+'" style="border:1px solid var(--border,#dfe2ec);border-radius:16px;background:var(--card,#fff);color:var(--text,#222);padding:7px 10px;font:11px Vazirmatn,sans-serif;cursor:pointer">'+q+'</button>').join('');
  }
  const savedPos=(()=>{try{return JSON.parse(localStorage.getItem('modir_ai_avatar_pos')||'null')}catch(_){return null}})();
  if(savedPos&&Number.isFinite(savedPos.x)&&Number.isFinite(savedPos.y)){launch.style.left=Math.max(4,Math.min(innerWidth-62,savedPos.x))+'px';launch.style.top=Math.max(4,Math.min(innerHeight-62,savedPos.y))+'px';launch.style.right='auto';}
  let dragState=null,dragged=false;
  const placePanel=()=>{if(!panel.classList.contains('open'))return;const r=launch.getBoundingClientRect(),w=panel.offsetWidth||Math.min(390,innerWidth-76),h=panel.offsetHeight||Math.min(560,innerHeight-36),gap=12;let left=r.left>innerWidth/2?r.left-w-gap:r.right+gap;left=Math.max(6,Math.min(innerWidth-w-6,left));let top=Math.max(6,Math.min(innerHeight-h-6,r.top+r.height/2-h/2));panel.style.left=left+'px';panel.style.right='auto';panel.style.top=top+'px';panel.style.transform='none';};
  launch.onpointerdown=e=>{if(e.button!==undefined&&e.button!==0)return;const r=launch.getBoundingClientRect();dragState={id:e.pointerId,startX:e.clientX,startY:e.clientY,left:r.left,top:r.top};dragged=false;launch.setPointerCapture?.(e.pointerId);};
  launch.onpointermove=e=>{if(!dragState||dragState.id!==e.pointerId)return;const dx=e.clientX-dragState.startX,dy=e.clientY-dragState.startY;if(Math.abs(dx)+Math.abs(dy)>5)dragged=true;if(!dragged)return;const x=Math.max(4,Math.min(innerWidth-launch.offsetWidth-4,dragState.left+dx)),y=Math.max(4,Math.min(innerHeight-launch.offsetHeight-4,dragState.top+dy));launch.style.left=x+'px';launch.style.top=y+'px';launch.style.right='auto';launch.classList.add('dragging');placePanel();};
  const finishDrag=e=>{if(!dragState||dragState.id!==e.pointerId)return;if(dragged){const r=launch.getBoundingClientRect();try{localStorage.setItem('modir_ai_avatar_pos',JSON.stringify({x:r.left,y:r.top}))}catch(_){}}launch.classList.remove('dragging');dragState=null;};
  launch.onpointerup=finishDrag;launch.onpointercancel=finishDrag;
  launch.onclick=()=>{if(dragged){dragged=false;return;}panel.classList.toggle('open');if(panel.classList.contains('open')){placePanel();document.getElementById('modir-ai-input')?.focus();}};
  window.addEventListener('resize',()=>{if(panel.classList.contains('open'))placePanel();});
 document.getElementById('modir-ai-close').onclick=()=>panel.classList.remove('open');
 const form=document.getElementById('modir-ai-compose');
 if(form.dataset.ready)return;form.dataset.ready='1';
 document.getElementById('modir-ai-faq')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-faq]');if(!b)return;
  const input=document.getElementById('modir-ai-input');input.value=b.dataset.faq;form.requestSubmit();
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(modirAiBusy||!S.token)return;
  const input=document.getElementById('modir-ai-input'),send=document.getElementById('modir-ai-send');
  const question=input.value.trim();if(!question)return;
  const box=document.getElementById('modir-ai-messages');
  const user=document.createElement('div');user.className='modir-ai-msg user';user.textContent=question;box.appendChild(user);input.value='';
  modirAiHistory.push({role:'user',text:question});
  modirAiBusy=true;send.disabled=true;send.textContent='...';
  const wait=document.createElement('div');wait.className='modir-ai-msg bot';wait.textContent='در حال بررسی سؤال شما...';box.appendChild(wait);box.scrollTop=box.scrollHeight;
  try{
   const response=await fetch(SUPABASE_URL+'/functions/v1/modir-assistant',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY},body:JSON.stringify({token:S.token,question,today_ym:(TODAY.y*100+TODAY.m),history:modirAiHistory.slice(-12)})});
   const data=await response.json();if(!response.ok||!data.answer)throw new Error(data.error||'پاسخ‌گویی موقتاً امکان‌پذیر نیست.');
    wait.textContent=data.answer;
    const answerText=String(data.answer||'');
    const shortcuts=[
     {key:'announcements',label:'رفتن به اعلانات',re:/اعلان|اطلاعیه/},
     {key:'requests',label:S.me?.is_admin?'رفتن به درخواست‌ها':'ارتباط با مدیر',re:/درخواست|ارتباط با مدیر/},
     {key:'tx',label:'رفتن به تراکنش‌ها',re:/شارژ|قبض|بدهی|مانده حساب|پرداخت|تراکنش|رسید/},
     {key:'pay',label:'تأیید پرداخت‌ها',re:/تأیید پرداخت/,admin:true},
     {key:'settings',label:'تنظیمات',re:/تنظیمات|پروفایل|گزارش فعالیت/,admin:true},
     {key:'profile',label:'رفتن به پروفایل',re:/پروفایل|اطلاعات حساب/},
     {key:'units',label:'مدیریت واحدها',re:/مدیریت واحد|واحدها/,admin:true},
     {key:'services',label:'مشاهده خدمات',re:/منو|خدمات سامانه|بخش.?های سامانه/}
    ];
    const linkBox=document.createElement('div');linkBox.className='modir-ai-links';
    shortcuts.filter(s=>s.re.test(answerText)&&(!s.admin||S.me?.is_admin)).forEach(s=>{const a=document.createElement('a');a.href='#'+s.key;a.className='modir-ai-link';a.textContent='↗ '+s.label;a.addEventListener('click',ev=>{ev.preventDefault();panel.classList.remove('open');go(s.key);});linkBox.appendChild(a);});
    if(linkBox.childElementCount)wait.appendChild(linkBox);
   modirAiHistory.push({role:'model',text:data.answer});
   modirAiHistory=modirAiHistory.slice(-12);
  }catch(err){modirAiHistory.pop();wait.textContent=err.message||'ارتباط با دستیار برقرار نشد. دوباره تلاش کنید.';}
  finally{modirAiBusy=false;send.disabled=false;send.textContent='ارسال';input.focus();box.scrollTop=box.scrollHeight;}
 });
}

const monthOptions = (sel, withAll = false) => (withAll ? `<option value="">همه ماه‌ها</option>` : '') + MONTHS.map((n, i) => `<option value="${i+1}" ${+sel === i+1 ? 'selected' : ''}>${n}</option>`).join('');
const yearOptions = (sel) => { const ys = []; for (let y = TODAY.y + 1; y >= 1403; y--) ys.push(y); return ys.map(y => `<option value="${y}" ${+y === +sel ? 'selected' : ''}>${fa(y)}</option>`).join(''); };
const unitOptions = (sel, withBuilding = true, withAll = false) => (withAll ? `<option value="">همه</option>` : '') + (withBuilding ? `<option value="0" ${+sel === 0 ? 'selected' : ''}>ساختمان</option>` : '') + Array.from({length:(S.unitCount || 10)}, (_,i) => `<option value="${i+1}" ${+sel === i+1 ? 'selected' : ''}>واحد ${fa(i+1)}</option>`).join('');

let periodAbort = null;
function bindPeriod(cb) {
  periodAbort?.abort(); periodAbort = new AbortController(); const opt = { signal: periodAbort.signal };
  $('#pk-m')?.addEventListener('change', e => { S.m = +e.target.value; cb(); }, opt);
  $('#pk-y')?.addEventListener('change', e => { S.y = +e.target.value; cb(); }, opt);
}
function periodPicker() { return `<div style="display:flex;gap:10px;margin-bottom:20px"><select id="pk-m" style="width:120px">${monthOptions(S.m)}</select><select id="pk-y" style="width:100px">${yearOptions(S.y)}</select></div>`; }

function closeModal(bg) {
  if (!bg?.isConnected) return;
  if (history.state?.modal) history.back();
  else bg.remove();
}

function modal(html) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal"><button class="x" aria-label="بستن">×</button>${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg || e.target.classList.contains('x')) closeModal(bg); });
  document.body.appendChild(bg);
  history.pushState({ ...(history.state || {}), app: true, modal: true, view: S.view || 'dash' }, '', '#modal');
  return bg;
}

function smsLink(phone, text) {
  if (!phone) return ''; const safe = String(phone).replace(/[^\d+\-]/g, '').trim(); if (!safe) return '';
  const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'; return `sms:${safe}${sep}body=${encodeURIComponent(text)}`;
}
function smsBtn(phone, text, label = 'پیامک') {
  if (!phone) return `<span class="muted" title="شماره ثبت نشده">—</span>`;
  return `<a class="btn lt sm" href="${smsLink(phone, text)}" style="padding:4px 8px;font-size:12px;">✉ ${esc(label)}</a>`;
}

async function compressImage(file) {
  return new Promise(resolve => {
    if (!(file instanceof File) || !file.type.startsWith('image/')) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas'); const MAX = 1000;
        let w = img.naturalWidth || img.width; let h = img.naturalHeight || img.height;
        if (!w || !h) { resolve(null); return; }
        const scale = Math.min(1, MAX / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d'); if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.62));
      };
      img.onerror = () => resolve(null); img.src = ev.target.result;
    };
    reader.onerror = () => resolve(null); reader.readAsDataURL(file);
  });
}

const N='var(--navy)', P='var(--peach)';
const ICONS = {
  settings:`<svg class="settings-gear-icon" viewBox="0 0 48 48" aria-hidden="true">
    <g class="gear-main" fill="${P}" stroke="${N}" stroke-width="1.2">
      <rect x="15.8" y="3.5" width="4.4" height="7" rx="1.2"/><rect x="15.8" y="25.5" width="4.4" height="7" rx="1.2"/>
      <rect x="3.5" y="15.8" width="7" height="4.4" rx="1.2"/><rect x="25.5" y="15.8" width="7" height="4.4" rx="1.2"/>
      <rect x="7.1" y="7.1" width="4.4" height="7" rx="1.2" transform="rotate(-45 9.3 10.6)"/>
      <rect x="24.5" y="24.5" width="4.4" height="7" rx="1.2" transform="rotate(-45 26.7 28)"/>
      <rect x="24.5" y="7.1" width="4.4" height="7" rx="1.2" transform="rotate(45 26.7 10.6)"/>
      <rect x="7.1" y="24.5" width="4.4" height="7" rx="1.2" transform="rotate(45 9.3 28)"/>
      <circle cx="18" cy="18" r="10.2"/><circle cx="18" cy="18" r="4.2" fill="#fff" stroke="${P}" stroke-width="2"/>
    </g>
    <g class="gear-small" fill="${N}" stroke="${P}" stroke-width="1">
      <rect x="31.3" y="22.5" width="3.4" height="5.5" rx="1"/><rect x="31.3" y="36" width="3.4" height="5.5" rx="1"/>
      <rect x="23.5" y="30.3" width="5.5" height="3.4" rx="1"/><rect x="37" y="30.3" width="5.5" height="3.4" rx="1"/>
      <rect x="25.7" y="24.7" width="3.4" height="5.5" rx="1" transform="rotate(-45 27.4 27.4)"/>
      <rect x="36.2" y="35.2" width="3.4" height="5.5" rx="1" transform="rotate(-45 37.9 37.9)"/>
      <rect x="36.2" y="24.7" width="3.4" height="5.5" rx="1" transform="rotate(45 37.9 27.4)"/>
      <rect x="25.7" y="35.2" width="3.4" height="5.5" rx="1" transform="rotate(45 27.4 37.9)"/>
      <circle cx="33" cy="32" r="6.5"/><circle cx="33" cy="32" r="2.5" fill="#fff" stroke="${N}" stroke-width="1.2"/>
    </g>
  </svg>`,
  dash:`<svg viewBox="0 0 48 48"><path d="M8 22 24 8l16 14v16a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="${P}"/><rect x="19" y="27" width="10" height="14" rx="2" fill="#fff"/></svg>`,
  units:`<svg viewBox="0 0 48 48"><rect x="8" y="8" width="20" height="34" rx="3" fill="${N}"/><rect x="24" y="18" width="16" height="24" rx="3" fill="${P}"/><g><rect class="unit-window-light light-a" x="12" y="13" width="4" height="4" rx="1"/><rect class="unit-window-light light-b" x="19" y="13" width="4" height="4" rx="1"/><rect class="unit-window-light light-c" x="12" y="21" width="4" height="4" rx="1"/><rect class="unit-window-light light-d" x="19" y="21" width="4" height="4" rx="1"/><rect class="unit-window-light light-e" x="12" y="29" width="4" height="4" rx="1"/></g></svg>`,
  announcements:`<svg viewBox="0 0 48 48"><rect x="8" y="14" width="30" height="22" rx="5" fill="${N}"/><path d="M10 17l13 9 13-9" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="38" cy="13" r="5" fill="${P}"/></svg>`,
  requests:`<svg viewBox="0 0 48 48"><path d="M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H20l-8 7v-7a4 4 0 0 1-4-4z" fill="${N}"/><g fill="${P}"><circle cx="17" cy="20" r="2.6"/><circle cx="24" cy="20" r="2.6"/><circle cx="31" cy="20" r="2.6"/></g></svg>`,
  'neighbor-alerts':`<svg viewBox="0 0 48 48"><path d="M24 5 42 38H6L24 5Z" fill="${P}"/><path d="M24 17v10" stroke="${N}" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="33" r="2" fill="${N}"/></svg>`,
  tx:`<svg viewBox="0 0 48 48"><rect x="6" y="12" width="30" height="20" rx="4" fill="${P}"/><rect x="12" y="18" width="30" height="20" rx="4" fill="${N}"/><path d="M18 26h10M18 31h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  pay:`<svg viewBox="0 0 48 48"><rect x="7" y="12" width="30" height="22" rx="4" fill="${N}"/><path d="M12 19h10M12 24h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="35" cy="33" r="8" fill="${P}"/><path d="M31.5 33l2.5 2.5 4.5-5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  report:`<svg viewBox="0 0 48 48"><path d="M12 6h24v36l-4-3-4 3-4-3-4 3-4-3-4 3z" fill="${N}"/><g stroke="${P}" stroke-width="2.6" stroke-linecap="round"><path d="M18 15h12M18 21h12M18 27h12"/></g></svg>`,
  rates:`<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="${N}"/><circle cx="24" cy="24" r="6" fill="${P}"/><g stroke="${N}" stroke-width="5" stroke-linecap="round"><path d="M24 4v4M24 40v4M4 24h4M40 24h4"/></g></svg>`,
  activity:`<svg viewBox="0 0 48 48"><path d="M14 33a14 14 0 1 1 20 0" stroke="${N}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M19 28a7 7 0 1 1 10 0" stroke="${N}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="24" cy="23" r="3.5" fill="${P}"/><path d="M24 26v14" stroke="${P}" stroke-width="4" stroke-linecap="round"/></svg>`,
  profile:`<svg viewBox="0 0 48 48"><circle cx="24" cy="17" r="8" fill="${N}"/><path d="M9 41a15 15 0 0 1 30 0z" fill="${P}"/></svg>`,
  services:`<svg viewBox="0 0 48 48"><g fill="none" stroke="currentColor" stroke-width="3"><rect x="8" y="8" width="13" height="13" rx="4"/><rect x="27" y="8" width="13" height="13" rx="4"/><rect x="8" y="27" width="13" height="13" rx="4"/><rect x="27" y="27" width="13" height="13" rx="4"/></g></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`
};
const LINE_ICONS = {
  dash:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M9 22 24 9l15 13v16a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3z"/><path d="M20 41V29h8v12"/></svg>`,
  tx:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><rect x="7" y="11" width="30" height="20" rx="4"/><path d="M13 18h10M13 23h6"/><path d="M33 30v10m0 0-3-3m3 3 3-3M40 40V30m0 0-3 3m3-3 3 3" stroke-linecap="round"/></svg>`,
  pay:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><rect x="8" y="14" width="32" height="22" rx="4"/><path d="M14 25h7" stroke-linecap="round"/></svg>`,
  requests:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H20l-8 7v-7a4 4 0 0 1-4-4z"/></svg>`,
  report:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M12 7h24v34l-4-3-4 3-4-3-4 3-4-3-4 3z"/><path d="M18 16h12M18 23h12" stroke-linecap="round"/></svg>`,
  services: null,
};
LINE_ICONS.services = ICONS.services;
LINE_ICONS.settings = ICONS.settings;
const ico = k => ICONS[k] || ICONS.services;

document.addEventListener('pointerdown', e => {
  const b = e.target.closest('.btn,.tile,.win');
  if (!b) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
  const c = document.createElement('span');
  c.className = 'ripple';
  c.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s/2}px;top:${e.clientY - r.top - s/2}px`;
  b.appendChild(c);
  setTimeout(() => c.remove(), 650);
});

function countUp(root = document) {
  $$('[data-count]', root).forEach(el => {
    const to = Number(el.dataset.count) || 0, t0 = performance.now(), d = 900;
    const step = t => {
      const p = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(to * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
const BAL_KEY = 'bm_hide_bal';
function bindEyes(root = document) {
  const apply = () => $$('.bc-amt', root).forEach(a => a.classList.toggle('blur', sessionStorage.getItem(BAL_KEY) === '1'));
  apply();
  $$('.eye', root).forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    sessionStorage.setItem(BAL_KEY, sessionStorage.getItem(BAL_KEY) === '1' ? '0' : '1');
    apply();
  }));
}
const EYE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;

async function renderLogin() {
  $('#app').innerHTML = '<div class="login"><div class="art"><img class="logo" src="icone-512.png" alt="" aria-hidden="true"><h1 id="login-title">Resident Manager</h1><p>سامانه مدیریت مجتمع‌های مسکونی</p></div><div class="form"><div class="card" style="max-width:520px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px"><button type="button" class="btn sf" id="tab-login">ورود</button><button type="button" class="btn lt" id="tab-register">ثبت‌نام</button></div><section id="login-panel"><h2>ورود به سامانه</h2><p class="sub">نام کاربری و گذرواژه خود را وارد کنید.</p><form id="lg" class="grid" style="gap:14px"><label class="f">نام کاربری<input id="lg-user" autocomplete="username" dir="ltr" required maxlength="32"></label><label class="f">گذرواژه<input id="lg-pass" type="password" autocomplete="current-password" dir="ltr" required inputmode="numeric" autocorrect="off" autocapitalize="off" spellcheck="false"></label><button class="btn sf" type="submit" id="lg-btn">ورود</button><p id="lg-err" style="color:var(--danger);margin:0;min-height:24px" role="status"></p><a href="#" id="forgot-pass" style="text-align:center;font-size:13px;color:var(--muted);display:block">فراموشی گذرواژه</a></form></section><section id="register-panel" class="hidden"><h2>ثبت‌نام در سامانه</h2><p class="sub">ماهیت ثبت‌نام را انتخاب کنید و اطلاعات مربوط به آن را تکمیل کنید.</p><form id="registration-form" class="grid" style="gap:12px"><label class="f">ماهیت ثبت‌نام<select id="reg-type" required><option value="">انتخاب کنید</option><option value="manager">مدیر ساختمان و ایجاد ساختمان جدید</option><option value="resident_owner">مالک ساکن</option><option value="owner">مالک غیرساکن</option><option value="tenant">مستأجر</option></select></label><div id="reg-specific" class="grid" style="gap:12px"></div><div style="border-top:1px solid var(--line);padding-top:14px"><h3>مشخصات فردی و حساب کاربری</h3><div class="grid g2"><label class="f">نام و نام خانوادگی<input name="full_name" required maxlength="120"></label><label class="f">شماره موبایل<input name="phone" required inputmode="tel" maxlength="30"></label><label class="f">ایمیل<input name="email" type="email" required maxlength="254" dir="ltr"></label><label class="f">نام کاربری انگلیسی<input name="username" required pattern="[A-Za-z][A-Za-z0-9_]{2,31}" minlength="3" maxlength="32" dir="ltr"></label><label class="f" style="grid-column:1/-1">گذرواژه (۴ تا ۸ رقم)<input name="password" type="password" required inputmode="numeric" pattern="[0-9]{4,8}" minlength="4" maxlength="8" dir="ltr" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false"></label></div></div><button class="btn sf" id="register-submit" type="submit">ارسال درخواست ثبت‌نام</button><p id="register-message" style="margin:0;min-height:24px" role="status"></p></form></section></div></div></div>';

  const specific=$('#reg-specific'), type=$('#reg-type');
  const input=(label,name,attrs)=>'<label class="f">'+label+'<input name="'+name+'" '+(attrs||'')+'></label>';
  const date=(label,name)=>jalaliDatePicker(label,name);
  let buildings=[];
  const loadBuildings=async()=>{
    const info=await api('app_public_info'); buildings=Array.isArray(info?.buildings)?info.buildings:[];
    const sel=specific.querySelector('[name="building_id"]');
    if(sel){
      sel.innerHTML=buildings.length?'<option value="">انتخاب ساختمان</option>'+buildings.map(b=>'<option value="'+Number(b.id)+'">'+esc(b.name)+' ('+fa(b.units_count)+' واحد)</option>').join(''):'<option value="">در حال حاضر ساختمانِ دارای ظرفیت ثبت‌نام وجود ندارد</option>';
      sel.addEventListener('change',()=>{
        const u=specific.querySelector('[name="unit_no"]'),b=buildings.find(x=>Number(x.id)===Number(sel.value));
        if(u){const n=Math.min(40,Number(b?.units_count||0));u.innerHTML='<option value="">انتخاب واحد</option>'+Array.from({length:n},(_,i)=>'<option value="'+(i+1)+'">واحد '+fa(i+1)+'</option>').join('');}
      });
    }
  };
  const draw=()=>{
    const v=type.value;
    if(v==='manager'){
      specific.innerHTML='<h3>اطلاعات ساختمان جدید</h3>'+input('نام ساختمان','building_name','required maxlength="120"')+input('نشانی کامل ساختمان','address','required maxlength="300"')+input('تعداد واحدها (حداکثر ۴۰)','units_count','type="number" min="1" max="40" value="10" required')+'<label style="display:flex;align-items:center;gap:9px"><input type="checkbox" name="manager_is_resident" id="manager-resident"> من در این ساختمان ساکن هستم</label><div id="manager-resident-fields" class="grid g2 hidden">'+input('شماره واحد','manager_unit_no','type="number" min="1" max="40"')+input('متراژ واحد (مترمربع)','manager_area','type="number" min="1" step="0.01"')+input('تعداد افراد ساکن در واحد شما','manager_persons','type="number" min="1" max="30"')+date('تاریخ شروع پرداخت هزینه‌ها','manager_start_date_jalali')+'</div>';
      $('#manager-resident').addEventListener('change',e=>{const box=$('#manager-resident-fields');box.classList.toggle('hidden',!e.target.checked);box.querySelectorAll('input:not([type="hidden"]),select').forEach(x=>x.required=e.target.checked);});
    } else if(['resident_owner','owner','tenant'].includes(v)){
      const isOwner=v==='owner',isTenant=v==='tenant';
      specific.innerHTML='<h3>اطلاعات ساختمان و واحد</h3><label class="f">انتخاب ساختمان<select name="building_id" required><option value="">در حال دریافت...</option></select></label><label class="f">شماره واحد<select name="unit_no" required><option value="">ابتدا ساختمان را انتخاب کنید</option></select></label>'+input('متراژ واحد (مترمربع)','area','type="number" min="1" step="0.01" required')+(isOwner?date('تاریخ خرید ملک','start_date_jalali'):input('تعداد افراد ساکن در واحد شما واحد','persons','type="number" min="1" max="30" required')+date(isTenant?'تاریخ شروع قرارداد اجاره':'تاریخ شروع پرداخت هزینه‌های ساختمان','start_date_jalali'))+'<p class="sub">درخواست شما برای مدیر ساختمان ارسال می‌شود و پس از تأیید فعال خواهد شد.</p>';
      loadBuildings().catch(()=>{const sel=specific.querySelector('[name="building_id"]');if(sel)sel.innerHTML='<option value="">خطا در دریافت ساختمان‌ها</option>';});
    } else specific.innerHTML='';
  };

  type.addEventListener('change',draw);
  $('#tab-login').addEventListener('click',()=>{$('#login-panel').classList.remove('hidden');$('#register-panel').classList.add('hidden');$('#tab-login').className='btn sf';$('#tab-register').className='btn lt';});
  $('#tab-register').addEventListener('click',()=>{$('#login-panel').classList.add('hidden');$('#register-panel').classList.remove('hidden');$('#tab-login').className='btn lt';$('#tab-register').className='btn sf';});

  let loginLockCountdownTimer=null;
  const showLoginFeedback=r=>{
    const el=$('#lg-err');
    if(loginLockCountdownTimer){clearInterval(loginLockCountdownTimer);loginLockCountdownTimer=null;}
    if(r?.code==='LOGIN_LOCKED'){
      let left=Math.max(1,Number(r.lock_seconds)||1);
      const endsAt=Date.now()+left*1000;
      const draw=()=>{
        left=Math.max(0,Math.ceil((endsAt-Date.now())/1000));
        if(left<=0){
          el.textContent='زمان محدودیت ورود به پایان رسید. اکنون می‌توانید دوباره تلاش کنید.';
          if(loginLockCountdownTimer){clearInterval(loginLockCountdownTimer);loginLockCountdownTimer=null;}
          return;
        }
        const m=Math.floor(left/60),s=left%60;
        const time=m?(`${m} دقیقه و ${s} ثانیه`):(`${s} ثانیه`);
        el.textContent=(r.error||'ورود موقتاً به دلیل چند تلاش ناموفق مسدود شده است')+'. زمان باقی‌مانده: '+time;
      };
      draw();
      loginLockCountdownTimer=setInterval(draw,1000);
      return;
    }
    if(r?.code==='INVALID_CREDENTIALS'&&Number.isFinite(Number(r.attempts_remaining))){
      const n=Math.max(0,Number(r.attempts_remaining));
      el.textContent='نام کاربری یا گذرواژه اشتباه است. '+(n>0?(`${n} تلاش دیگر تا محدودیت موقت باقی مانده است.`):'تلاش بعدی ممکن است باعث محدودیت ورود شود.');
      return;
    }
    el.textContent=r?.error||'ورود ناموفق بود. دوباره بررسی کنید.';
  };
  $('#lg').addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=$('#lg-btn'),old=btn.textContent,login=$('#lg-user').value.trim(),password=$('#lg-pass').value;
    if(loginLockCountdownTimer){clearInterval(loginLockCountdownTimer);loginLockCountdownTimer=null;}
    $('#lg-err').textContent='';
    const deviceId=(()=>{
      const key='modir_device_id';
      try{
        let id=localStorage.getItem(key);
        if(!id){
          id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():('dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
          localStorage.setItem(key,id);
        }
        return id;
      }catch(_){
        let id=sessionStorage.getItem(key);
        if(!id){
          id=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():('dev-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
          sessionStorage.setItem(key,id);
        }
        return id;
      }
    })();
    const getDeviceLabel=async()=>{
      const ua=navigator.userAgent||'';
      let device=/Android/i.test(ua)?'Android':/iPhone/i.test(ua)?'iPhone':/iPad/i.test(ua)?'iPad':/Windows/i.test(ua)?'Windows':/Macintosh/i.test(ua)?'Mac':/Linux/i.test(ua)?'Linux':'دستگاه';
      let osVersion='';
      let browser=/Edg\//i.test(ua)?'Edge':/SamsungBrowser\//i.test(ua)?'Samsung Internet':/Firefox\//i.test(ua)?'Firefox':/Chrome\//i.test(ua)?'Chrome':/Safari\//i.test(ua)?'Safari':'مرورگر';
      let browserVersion='';
      try{
        const uaData=navigator.userAgentData;
        if(uaData&&typeof uaData.getHighEntropyValues==='function'){
          const high=await uaData.getHighEntropyValues(['model','platform','platformVersion','fullVersionList']);
          const platform=high.platform||uaData.platform||'';
          if(/Android/i.test(platform)){
            device='Android'+(high.model?' '+high.model.trim():'');
          }else if(/Windows/i.test(platform))device='Windows';
          else if(/macOS/i.test(platform))device='Mac';
          if(high.platformVersion)osVersion=high.platformVersion;
          const brands=Array.isArray(high.fullVersionList)?high.fullVersionList:[];
          const preferred=brands.find(x=>/Microsoft Edge/i.test(x.brand))||brands.find(x=>/Google Chrome/i.test(x.brand))||brands.find(x=>/Chromium/i.test(x.brand));
          if(preferred){browser=/Edge/i.test(preferred.brand)?'Edge':'Chrome';browserVersion=preferred.version||'';}
        }
      }catch(_){}
      if(/^Android(?:\s|$)/.test(device)&&device==='Android'){
        const model=ua.match(/;\s*([^;)]+?)\s+Build\//i);
        if(model&&model[1]&&!/wv|\b(?:K|U)\d{3,}\b/i.test(model[1]))device+=' '+model[1].trim();
      }
      if(!browserVersion){
        const match=ua.match(/(?:Edg|SamsungBrowser|Firefox|Chrome|Version)\/([\d.]+)/i);
        if(match)browserVersion=match[1];
      }
      const details=[device,osVersion?'OS '+osVersion:'',browser+(browserVersion?' '+browserVersion:'')].filter(Boolean);
      return details.join(' · ').slice(0,80);
    };
    const clearPreviousAccountData=()=>{
      ['bm_token','bm_me','bm_superadmin_token','bm_superadmin_account'].forEach(k=>sessionStorage.removeItem(k));
      localStorage.removeItem('bm_token');
      S.token=null;S.me=null;S.view='dash';S.txFilter=null;S.avatarData=null;
    };
    const attemptLogin=async replaceId=>{
      btn.disabled=true;btn.textContent='در حال بررسی...';
      try{
        const deviceLabel=await getDeviceLabel();
        const r=await api('app_login_unified',{
          p_login:login,p_password:password,
          p_replace_session_id:replaceId||null,p_device_label:deviceLabel,p_device_id:deviceId
        });
        if(!r?.ok){
          if(r.code==='SESSION_LIMIT'&&Array.isArray(r.sessions)){
            const bg=modal(`<h2>حداکثر دو نشست فعال</h2><p class="sub">این حساب هم‌اکنون در دو دستگاه فعال است. برای ورود در این دستگاه، یکی از نشست‌های زیر را خارج کنید.</p><div class="grid" style="gap:10px" id="active-session-list">${r.sessions.map((s,i)=>`<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><b>${esc(s.device_label||'دستگاه ناشناس')}</b><div class="sub" style="margin:3px 0 0">شروع نشست: ${esc(new Date(s.created_at).toLocaleString('fa-IR'))}</div></div><button type="button" class="btn rd sm" data-revoke-session="${esc(s.session_id)}">خروج از این دستگاه</button></div>`).join('')}</div><p class="sub" style="margin:14px 0 0">با انتخاب یک نشست، همان نشست باطل و ورود این دستگاه انجام می‌شود.</p>`);
            bg.querySelectorAll('[data-revoke-session]').forEach(b=>b.addEventListener('click',async()=>{
              bg.querySelectorAll('button').forEach(x=>x.disabled=true);
              try{
                if(history.state?.modal){
                  await new Promise(resolve=>{window.addEventListener('popstate',resolve,{once:true});closeModal(bg);});
                }else{bg.remove();}
                await attemptLogin(b.dataset.revokeSession);
              }catch(err){$('#lg-err').textContent=err?.message||'ورود ناموفق بود';}
            }));
            return;
          }
          if(r.code==='INVALID_CREDENTIALS'||r.code==='LOGIN_LOCKED') showLoginFeedback(r);
          else $('#lg-err').textContent=r?.error||(r.code==='SESSION_CHANGED'?'وضعیت نشست‌ها تغییر کرده است؛ دوباره تلاش کنید':'ورود ناموفق بود');
          return;
        }
        clearPreviousAccountData();
        if(r.kind==='superadmin'){
          sessionStorage.setItem('bm_superadmin_token',r.token);
          sessionStorage.setItem('bm_superadmin_account',JSON.stringify(r.account||{}));
          window.location.href='superadmin.html';return;
        }
        S.token=r.token;S.me=r.account;S.unitCount=Number(r.account.units_count||10);S.building=r.account.building_name||'';
        sessionStorage.setItem('bm_token',S.token);sessionStorage.setItem('bm_me',JSON.stringify(S.me));
        renderShell();
        if(!S.me?.is_admin) await sendMobilePush('resident_login','ورود ساکن',`${S.me?.full_name||'ساکن'} از ${S.me?.unit_no?'واحد '+fa(S.me.unit_no):'حساب کاربری'} وارد برنامه شد.`);
      }finally{btn.disabled=false;btn.textContent=old;}
    };
    try{await attemptLogin(null);}catch(err){showErr(err);}
  });

  $('#registration-form').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,data=new FormData(form),v=type.value,btn=$('#register-submit'),msg=$('#register-message');
    if(!v){msg.textContent='ماهیت ثبت‌نام را انتخاب کنید';return;}
    const val=k=>String(data.get(k)||'').trim().replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));btn.disabled=true;btn.textContent='در حال ارسال...';msg.textContent='';msg.style.color='var(--muted)';
    try{
      let r;
      if(v==='manager'){
        const resident=$('#manager-resident')?.checked||false;
        r=await api('app_submit_registration',{p_building_name:val('building_name'),p_address:val('address'),p_username:val('username'),p_password:val('password'),p_full_name:val('full_name'),p_phone:val('phone'),p_email:val('email'),p_units_count:Number(val('units_count')),p_manager_is_resident:resident,p_manager_unit_no:resident?Number(val('manager_unit_no')):null,p_manager_area:resident?Number(val('manager_area')):null,p_manager_persons:resident?Number(val('manager_persons')):null,p_manager_start_date_jalali:resident?val('manager_start_date_jalali'):null});
      }else{
        r=await api('app_submit_member_registration',{p_building_id:Number(val('building_id')),p_unit_no:Number(val('unit_no')),p_occupancy:v==='resident_owner'?'مالک ساکن':v==='owner'?'مالک':'مستأجر',p_username:val('username'),p_password:val('password'),p_full_name:val('full_name'),p_phone:val('phone'),p_email:val('email'),p_area:Number(val('area')),p_persons:v==='owner'?null:Number(val('persons')),p_start_date_jalali:val('start_date_jalali')});
      }
      if(!r?.ok)throw new Error(r?.error||'ثبت درخواست ناموفق بود');
      msg.style.color='var(--success)';msg.textContent=r.message||'درخواست ثبت شد و پس از تأیید فعال می‌شود.';form.reset();specific.innerHTML='';type.value='';
    }catch(err){msg.style.color='var(--danger)';msg.textContent=err.message||'خطا در ثبت درخواست';}
    finally{btn.disabled=false;btn.textContent='ارسال درخواست ثبت‌نام';}
  });

  $('#forgot-pass').addEventListener('click',e=>{
    e.preventDefault();
    modal('<h2>بازیابی گذرواژه</h2><p class="sub" style="line-height:2">برای حفظ امنیت حساب، بازیابی مستقیم با نام کاربری و شماره موبایل غیرفعال شده است. لطفاً از مدیر ساختمان بخواهید گذرواژه شما را از بخش مدیریت واحدها بازنشانی کند. پس از ورود، گذرواژه خود را تغییر دهید.</p>');
  });
}
async function logout(silent = false) {
  if(!silent && !confirm('آیا قصد خروج از حساب را دارید؟')) return;
  const token = S.token; S.renderId++;
  if (token) {
    try { await detachPushSubscription(token); } catch (err) { console.warn('Could not detach previous account push subscription:', err); }
    try { await api('app_logout', { p_token: token }); } catch {}
  }
  S.token = null; S.me = null; S.view = 'dash'; S.txFilter = null; S.avatarData = null;
  const aiPanel=document.getElementById('modir-ai-panel'),aiLaunch=document.getElementById('modir-ai-launch'); if(aiPanel)aiPanel.classList.remove('open'); if(aiLaunch)aiLaunch.style.display='none'; const aiMessages=document.getElementById('modir-ai-messages'); if(aiMessages)aiMessages.innerHTML='<div class="modir-ai-msg bot">سلام! سؤال یا مشکلتان درباره کار با سامانه مدیر را بنویسید تا راهنمایی‌تان کنم. لطفاً رمز عبور یا اطلاعات شخصی را ارسال نکنید.</div>'; const aiInput=document.getElementById('modir-ai-input'); if(aiInput)aiInput.value='';
  ['bm_token','bm_me','bm_superadmin_token','bm_superadmin_account'].forEach(k=>sessionStorage.removeItem(k));
  localStorage.removeItem('bm_token');
  renderLogin();
}

function getMenuItems() {
  const a = S.me?.is_admin;
  return [
    ['dash', 'داشبورد'], a && ['units', 'مدیریت واحدها'], ['announcements', 'اعلانات'],
    ['neighbor-alerts', 'زنگ همسایگی'], ['requests', a ? 'درخواست‌ها' : 'ارتباط با مدیر'], ['tx', 'تراکنش‌ها'],
    a && ['pay', 'تایید پرداخت‌ها'], ['report', 'گزارش ماهانه'],
    ['settings', 'تنظیمات'], ['profile', 'پروفایل'], a && ['activity', 'گزارش فعالیت‌ها'],
  ].filter(Boolean);
}

function navItems() {
  const a = S.me?.is_admin;
  return [
    ['tx', 'تراکنش‌ها'], a ? ['pay', 'تایید پرداخت'] : ['requests', 'ارتباط با مدیر'],
    ['dash', 'خانه'], ['report', 'گزارش'], ['services', 'خدمات'],
  ];
}

async function viewServices(el) {
  const items = getMenuItems().filter(([k]) => k !== 'dash');
  const a = S.me?.is_admin;
  const groups = [
    ['امور مالی', ['tx', 'pay', 'report']],
    ['ساختمان و ساکنین', ['units', 'announcements', 'neighbor-alerts', 'requests']],
    [a ? 'مدیریت سامانه' : 'حساب کاربری', ['settings']],
  ];
  el.innerHTML = groups.map(([t, keys]) => {
    const list = items.filter(([k]) => keys.includes(k));
    if (!list.length) return '';
    return `<div><div class="sec-title" style="margin-top:6px">${esc(t)}</div>
      <div class="tiles">${list.map(([k, l], i) => `<button class="tile" data-v="${k}" style="animation-delay:${i * 50}ms">${k === 'neighbor-alerts' ? `<svg class="neighbor-alert-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 42 38H6L24 5Z" fill="#ef4444"><animate attributeName="opacity" values="1;0.35;1" dur="0.8s" repeatCount="indefinite"/></path><path d="M24 17v10" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="33" r="2" fill="#fff"/></svg>` : ico(k)}<span>${esc(l)}</span></button>`).join('')}</div></div>`;
  }).join('');
  $$('.tile', el).forEach(b => b.addEventListener('click', () => go(b.dataset.v)));
}

function alertSeenKey() {
  return 'bm_alerts_seen:' + String(S.me?.id || S.me?.account_id || S.me?.username || S.me?.building_id || 'account');
}
function getSeenAlertIds() {
  try {
    const value = JSON.parse(localStorage.getItem(alertSeenKey()) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch (_) { return new Set(); }
}
function saveSeenAlertIds(seen) {
  localStorage.setItem(alertSeenKey(), JSON.stringify([...seen].slice(-3000)));
}
function markAlertSeen(id) {
  const seen = getSeenAlertIds();
  seen.add(String(id));
  saveSeenAlertIds(seen);
}
function markAlertPrefixSeen(prefix) {
  const seen = getSeenAlertIds();
  (window.__modirCurrentAlerts || []).filter(item => item.id.startsWith(prefix)).forEach(item => seen.add(item.id));
  saveSeenAlertIds(seen);
}
async function collectAlertItems() {
  const jobs = [
    T('app_get_announcements').catch(() => []),
    T('app_neighbor_alert_list').catch(() => []),
    T('app_get_polls').catch(() => [])
  ];
  if (S.me?.is_admin) jobs.push(
    T('app_admin_list_membership_registrations').catch(() => []),
    T('app_get_payment_requests').catch(() => []),
    T('app_get_requests').catch(() => []),
    T('app_manager_neighbor_alert_summary').catch(() => [])
  );
  const data = await Promise.all(jobs);
  const announcements = Array.isArray(data[0]) ? data[0] : [];
  const neighborAlerts = Array.isArray(data[1]) ? data[1] : [];
  const polls = Array.isArray(data[2]) ? data[2] : [];
  const items = [
    ...announcements.map(x => ({ id:'announcement:'+x.id, type:'announcement', title:'اعلان جدید', detail:x.title || 'اعلان ساختمان', date:x.created_at, view:'announcements' })),
    ...neighborAlerts.filter(x => String(x.status || '').toLowerCase() !== 'acknowledged').map(x => ({ id:'neighbor:'+x.id, type:'neighbor', title:'هشدار همسایگی جدید', detail:'یادآوری جدید برای واحد شما', date:x.created_at, view:'neighbor-alerts' })),
    ...polls.filter(x => x.is_active).map(x => ({ id:'poll:'+x.id, type:'poll', title:'نظرسنجی جدید', detail:x.title || 'نظرسنجی ساختمان', date:x.created_at, view:'announcements' }))
  ];
  if (S.me?.is_admin) {
    const registrations = Array.isArray(data[3]) ? data[3] : [];
    const payments = Array.isArray(data[4]) ? data[4] : [];
    const requests = Array.isArray(data[5]) ? data[5] : [];
    const summary = Array.isArray(data[6]) ? data[6] : [];
    items.push(
      ...registrations.map(x => ({ id:'registration:'+x.id, type:'registration', title:'درخواست عضویت جدید', detail:(x.full_name || 'عضو جدید') + (x.unit_no ? ' · واحد '+x.unit_no : ''), date:x.created_at, view:'requests' })),
      ...payments.filter(x => String(x.status || '').toLowerCase() === 'pending').map(x => ({ id:'payment:'+x.id, type:'payment', title:'پرداخت جدید برای تأیید', detail:x.full_name || x.description || 'درخواست تأیید پرداخت', date:x.created_at, view:'pay' })),
      ...requests.filter(x => !['done','rejected','closed'].includes(String(x.status || '').toLowerCase())).map(x => ({ id:'request:'+x.id, type:'request', title:'درخواست جدید', detail:x.subject || x.title || x.description || 'درخواست ساکن', date:x.created_at, view:'requests' })),
      ...summary.filter(x => Number(x.pending) > 0).map(x => ({ id:'neighbor-summary:'+x.target_unit_no+':'+x.category+':'+x.pending, type:'neighbor', title:'هشدار همسایگی بررسی‌نشده', detail:'واحد '+x.target_unit_no+' · '+x.pending+' مورد', date:null, view:'neighbor-alerts' }))
    );
  }
  return items.filter(x => x.id && x.id.split(':').length > 1);
}
function renderAlertCenter(items) {
  const seen = getSeenAlertIds();
  const unread = items.filter(x => !seen.has(x.id));
  window.__modirCurrentAlerts = items;
  const panel = $('#alert-center');
  if (!panel) return;
  panel.innerHTML = `<div class="alert-center-backdrop" data-alert-close></div><section class="alert-center-panel" role="dialog" aria-label="موارد جدید">
    <div class="alert-center-head"><b>موارد جدید</b><button type="button" class="ic-btn" data-alert-close aria-label="بستن">×</button></div>
    <div class="alert-center-list">${unread.length ? unread.map(x => `<button type="button" class="alert-center-item" data-alert-id="${esc(x.id)}" data-alert-view="${esc(x.view)}"><span class="alert-center-dot"></span><span><b>${esc(x.title)}</b><small>${esc(x.detail || '')}</small></span></button>`).join('') : '<p class="sub" style="padding:20px;text-align:center">مورد جدیدی برای نمایش وجود ندارد.</p>'}</div>
  </section>`;
  panel.style.display = 'block';
  panel.querySelectorAll('[data-alert-close]').forEach(b => b.addEventListener('click', () => { panel.style.display='none'; }));
  panel.querySelectorAll('[data-alert-id]').forEach(b => b.addEventListener('click', async () => {
    markAlertSeen(b.dataset.alertId);
    panel.style.display = 'none';
    await refreshManagerAlertBadge();
    go(b.dataset.alertView || 'dash');
  }));
}
async function refreshManagerAlertBadge() {
  const badge = $('#manager-alert-count');
  if (!badge || !S.me) return;
  try {
    const items = await collectAlertItems();
    window.__modirCurrentAlerts = items;
    const seen = getSeenAlertIds();
    const unread = items.filter(x => !seen.has(x.id)).length;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.style.display = unread ? 'block' : 'none';
    badge.title = unread + ' مورد جدید';
  } catch (error) {
    console.warn('Alert count could not be refreshed:', error);
  }
}

async function renderShell() {
  const renderId = ++S.renderId;
  $('#app').innerHTML = `<div class="loading-screen"><div class="spinner"></div><p class="sub">در حال اتصال به سرور...</p></div>`;
  try {
    const account = await T('app_me');
    if (renderId !== S.renderId) return;
    S.me = account; S.unitCount = Number(account.units_count || S.unitCount || 10); S.building = account.building_name || S.building; sessionStorage.setItem('bm_me', JSON.stringify(S.me));
    modirAiMount();
  } catch (e) {
    if (e.message === 'AUTH_ERROR') { logout(true); return; }
    if (e.message === 'NETWORK_ERROR') { showConnectionError(); return; }
    showErr(e); return;
  }

  try { S.avatarData = await T('app_profile_avatar_get'); } catch (avatarErr) { console.warn('Profile photo could not be loaded:', avatarErr); S.avatarData = null; }

  const curTheme = localStorage.getItem('bm_theme') || 'default';

  $('#app').innerHTML = `
    <header class="top">
      <div class="top-in">
        <button class="ic-btn avatar" id="who-btn" aria-label="رفتن به تنظیمات" title="تنظیمات">${S.avatarData ? `<img src="${esc(S.avatarData)}" alt="عکس پروفایل" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : ICONS.profile.replace('<svg','<svg width="26" height="26"')}</button>
        <div class="appbar-title" id="appbar-title"></div>
        <button class="ic-btn" id="go-req" aria-label="${S.me.is_admin ? 'اعلان‌های مدیر' : 'پیام‌ها'}" title="${S.me.is_admin ? 'موارد نیازمند رسیدگی' : 'پیام‌ها'}" style="position:relative">${S.me.is_admin ? '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>' : '<svg width="26" height="26" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"><path d="M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H20l-8 7v-7a4 4 0 0 1-4-4z"/><g fill="#fff" stroke="none"><circle cx="17" cy="20" r="2.4"/><circle cx="24" cy="20" r="2.4"/><circle cx="31" cy="20" r="2.4"/></g></svg>'}<span id="manager-alert-count" style="display:none;position:absolute;top:-3px;right:-3px;min-width:19px;height:19px;padding:0 5px;border-radius:99px;background:#ef4444;color:#fff;font-size:11px;font-weight:900;line-height:19px;text-align:center;border:2px solid var(--navy)"></span></button>
        <button class="ic-btn logout-top" id="direct-logout" title="خروج از حساب">${ICONS.logout.replace('<svg','<svg width="22" height="22"')}</button>
        <div id="alert-center" style="display:none"></div>
      </div>
    </header>
    <main id="view"></main>
    <nav class="bnav"><div class="bnav-in">
      <div class="bnav-bg"></div>
      <div class="bnav-diamond" id="bnav-dia"><span></span></div>
      <div class="bnav-items">
        ${navItems().map(([k, l]) => `<button data-v="${k}">${LINE_ICONS[k] || ico(k)}<span>${esc(l)}</span></button>`).join('')}
      </div>
    </div></nav>`;

  $('#direct-logout').addEventListener('click', () => logout());
  $('#who-btn').addEventListener('click', () => go('settings'));
  
  $$('.theme-dot').forEach(d => d.addEventListener('click', () => setTheme(d.dataset.t)));

  $('#go-req').addEventListener('click', async () => {
    const panel = $('#alert-center');
    if (panel?.style.display === 'block') { panel.style.display = 'none'; return; }
    try { renderAlertCenter(await collectAlertItems()); }
    catch (error) { console.warn('Alert center could not be opened:', error); }
  });
  refreshManagerAlertBadge();
  if (window.__modirManagerAlertTimer) clearInterval(window.__modirManagerAlertTimer);
  window.__modirManagerAlertTimer = setInterval(() => {
    if (document.visibilityState === 'visible') refreshManagerAlertBadge();
  }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshManagerAlertBadge();
  });
  document.querySelectorAll('.bnav-items button').forEach(b => b.addEventListener('click', () => go(b.dataset.v)));
  window.addEventListener('resize', debounce(() => renderShellHeaderState(false), 100));
  if ('serviceWorker' in navigator && window.isSecureContext) getPushServiceWorker().catch(err => console.warn('Service worker registration failed:', err));
  go(S.view);
  setTimeout(maybeAskForPushPermission, 500);
}

function go(v, isBackNavigation = false) {
  const views = {
    dash: viewDash, announcements: viewAnnouncements, 'neighbor-alerts': viewNeighborAlerts, requests: viewRequests, tx: viewTx, pay: viewPay,
    report: viewReport, units: viewUnits, rates: viewRates, charge: viewRates, settings: viewSettings, activity: viewActivity, profile: viewProfile, services: viewServices,
  };
  if (!views[v]) v = 'dash';
  S.view = v;
  const el = $('#view'); if (!el) return;
  el.innerHTML = `<p class="sub">در حال بارگذاری...</p>`;
  renderShellHeaderState();
  if (S.me?.is_admin) refreshManagerAlertBadge();
  const currentRenderId = ++S.renderId;
  Promise.resolve(views[v](el)).then(() => { if (v === 'dash') renderInstallBanner(); }).catch(e => {
    if (currentRenderId !== S.renderId) return;
    if (e.message === 'AUTH_ERROR') { logout(true); return; }
    if (e.message === 'NETWORK_ERROR') {
      el.innerHTML = `<div class="card" style="text-align:center;padding:60px 20px"><div style="font-size:48px;margin-bottom:16px">📡</div><h2>اتصال به سرور برقرار نیست</h2><p class="sub">لطفاً اینترنت خود را بررسی کنید</p><button class="btn sf" data-retry>تلاش مجدد</button></div>`;
      $('[data-retry]', el)?.addEventListener('click', () => go(v)); return;
    }
    showErr(e); el.innerHTML = `<div class="card" style="color:var(--danger)">خطا: ${esc(e.message)}</div>`;
  });
  if (!isBackNavigation && S.me) {
    const currentState = history.state;
    if (v !== 'dash' && currentState?.view !== v) { history.pushState({ app: true, view: v }, '', `#${encodeURIComponent(v)}`); }
  }
}

function renderShellHeaderState(resetScroll = true) {
  const all = [...getMenuItems(), ['services', 'خدمات']];
  const current = all.find(t => t[0] === S.view);
  const t = $('#appbar-title');
  if (t) t.innerHTML = S.view === 'dash'
    ? `${esc(S.building)}<small>${S.me?.is_admin ? 'پنل مدیریت' : 'واحد ' + fa(S.me?.unit_no || '')}</small>`
    : esc(current ? current[1] : '');
  const btns = $$('.bnav-items button');
  let active = btns.find(b => b.dataset.v === S.view) || btns.find(b => b.dataset.v === 'services');
  btns.forEach(b => b.classList.toggle('on', b === active));
  const dia = $('#bnav-dia'), wrap = $('.bnav-in');
  if (dia && active && wrap) {
    const wr = wrap.getBoundingClientRect(), br = active.getBoundingClientRect();
    const center = (br.left + br.width / 2) - wr.left;
    dia.style.right = (wr.width - center) + 'px';
    $('.bnav-bg')?.style.setProperty('--notch-x', center + 'px');
    const key = active.dataset.v;
    const label = $('span', active)?.textContent?.trim() || '';
    $('span', dia).innerHTML = (LINE_ICONS[key] || ico(key)) + `<small>${esc(label)}</small>`;
    dia.classList.remove('bump'); void dia.offsetWidth; dia.classList.add('bump');
  }
  if (resetScroll) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

function showConnectionError() {
  $('#app').innerHTML = `
    <div class="offline-screen">
      <div class="offline-icon">📡</div>
      <h1>اتصال به سرور برقرار نیست</h1>
      <p class="sub" style="max-width:420px">لطفاً اتصال اینترنت خود را بررسی کنید و دوباره تلاش کنید. اطلاعات حساب شما حفظ شده است.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
        <button class="btn sf" id="retry" style="min-width:180px">تلاش مجدد</button>
        <button class="btn lt" id="lo2" style="min-width:180px">خروج از حساب</button>
      </div>
    </div>`;
  $('#retry').addEventListener('click', renderShell);
  $('#lo2').addEventListener('click', () => logout(true));
}

const mustChangeBanner = () => S.me?.must_change_password ? `<div class="card" style="background:#fef3c7;color:#92400e;margin-bottom:20px">رمز عبور شما هنوز پیش‌فرض است. از بخش <a href="#" id="go-profile">پروفایل</a> آن را تغییر دهید.</div>` : '';

function billCard(r, rep) {
  // RPC JSON may arrive as an array or as a serialized JSON string; normalize before calculating shares.
  let rawExpenses = r.expenses;
  if (typeof rawExpenses === 'string') {
    try { rawExpenses = JSON.parse(rawExpenses); } catch (_) { rawExpenses = []; }
  }
  const expenseItems = Array.isArray(rawExpenses)
    ? rawExpenses
    : Array.isArray(rawExpenses?.items) ? rawExpenses.items : [];
  const isExpenseFor = (x, category, words) => {
    const key = String(x.category_name ?? x.category ?? '').trim().toLowerCase();
    return key === category || words.some(word => String(x.description || '').includes(word));
  };
  const sumExpense = (category, words) => expenseItems
    .filter(x => isExpenseFor(x, category, words))
    .reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
  const chargeExpense = sumExpense('charge', ['شارژ']);
  // Use both report sources defensively: a zero/missing dedicated field must not hide a valid water share in expenses.
  const waterExpense = Math.max(Number(r.water_expense) || 0, sumExpense('water', ['آب']));
  const gasExpense = sumExpense('gas', ['گاز']);
  const repairExpense = sumExpense('repair', ['پس‌انداز', 'تعمیر']);
  const parkingExpense = sumExpense('parking', ['پارکینگ']);
  const chg = (Number(r.charge) || 0) + chargeExpense;
  const w = (Number(r.water) || 0) + waterExpense;
  const g = (Number(r.gas) || 0) + gasExpense;
  const rep_amt = (Number(r.repair) || 0) + repairExpense;
  const park = (Number(r.parking) || 0) + parkingExpense;
  const extraExpenses = expenseItems.filter(x =>
    !isExpenseFor(x, 'charge', ['شارژ']) &&
    !isExpenseFor(x, 'water', ['آب']) &&
    !isExpenseFor(x, 'gas', ['گاز']) &&
    !isExpenseFor(x, 'repair', ['پس‌انداز', 'تعمیر']) &&
    !isExpenseFor(x, 'parking', ['پارکینگ'])
  );
  const prev = Number(r.prev_debt) || 0;
  const paid = Number(r.paid_this_month) || 0;
  const rem = Number(r.remaining) || 0;

  // Match Negin2: each bill category is settled only against payments recorded for that category.
  const settlementStatus = (amount, isPaid) => amount <= 0 || isPaid
    ? '<span class="chip ok">پرداخت شده</span>'
    : '<span class="chip no">پرداخت نشده</span>';
  const chargeStatus = settlementStatus(chg, r.ok_charge);
  const waterStatus = settlementStatus(w, r.ok_water);
  const gasStatus = settlementStatus(g, r.ok_gas);
  const repairStatus = settlementStatus(rep_amt, r.ok_repair);
  const parkingStatus = settlementStatus(park, r.ok_parking);
  const extraSettlements = extraExpenses.map(item => ({ item }));

  return `
  <div class="card" style="padding:0;overflow:hidden">
    <div class="bank-card" style="border-radius:20px 20px 0 0;box-shadow:none"><i class="shine"></i>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <b style="font-size:15px">صورتحساب ${esc(rep.month_name || '')} ${fa(rep.year)}</b>
        <span class="chip" style="background:rgba(247,174,116,.2);color:var(--peach)">${esc(r.occupancy)}</span>
      </div>
      <div class="bc-row"><span>${esc(r.full_name || '')}</span><span>واحد ${fa(r.unit_no || '')}</span></div>
         <div class="bc-row" style="margin-top:16px;align-items:flex-end;justify-content:space-between;">
        <div>
          <small style="color:#c9cce6">مانده قابل پرداخت (تومان)</small>
          <div style="display:flex;align-items:center;gap:10px"><button class="eye" type="button">${EYE}</button><span class="bc-amt" data-count="${rem}">${fmt(rem)}</span></div>
        </div>
        ${rem > 0 ? `<button class="btn sf sm" onclick="payModal(${r.unit_no || 'null'}, '${r.account_id || ''}')" style="background:var(--peach);color:var(--navy);border:none;padding:8px 16px;font-size:13px;font-weight:900;box-shadow:0 4px 12px rgba(247,174,116,.3);">💸 پرداخت بدهی</button>` : ''}
      </div>
    <div style="padding:10px 24px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px dashed var(--line)">
        <span>شارژ ماهانه: <b>${money(chg)}</b> تومان</span>
        <span>${chargeStatus}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px dashed var(--line)">
        <span>سهم قبض آب: <b>${money(w)}</b> تومان${''}</span>
        <span>${waterStatus}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px dashed var(--line)">
        <span>سهم قبض گاز: <b>${money(g)}</b> تومان${''}</span>
        <span>${gasStatus}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px dashed var(--line)">
        <span>پس‌انداز: <b>${money(rep_amt)}</b> تومان${''}</span>
        <span>${repairStatus}</span>
      </div>
      ${park > 0 ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px dashed var(--line)"><span>اجاره پارکینگ: <b>${money(park)}</b> تومان</span><span>${parkingStatus}</span></div>` : ''}
      ${extraSettlements.map(({item:x}) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 0;border-bottom:1px dashed var(--line)"><span>${esc(x.description || x.category_name || 'هزینه تسهیمی')}: <b>${money(x.amount)}</b> تومان</span><span>${settlementStatus(x.amount, Number(r.remaining) <= 0)}</span></div>`).join('')}
    </div>
    <div style="background:var(--bg);padding:20px 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:16px;border-top:1px solid var(--line)";color:#000">
      <div><small style="color:var(--muted);display:block">بدهی قبلی</small><b style="color:#000">${money(prev)}</b> <span style="color:#000">تومان</span></div>
      <div><small style="color:var(--muted);display:block">پرداختی این ماه</small><b style="color:#000">${money(paid)}</b> <span style="color:#000">تومان</span></div>
    </div>
  </div>`;
}
function reminderText(r, rep) {
  return `${S.building} - واحد ${r.unit_no}\nصورتحساب ${rep.month_name} ${rep.year}:\n` +
    `شارژ ${fmt(r.charge)} | آب ${fmt(r.water)} | گاز ${fmt(r.gas)} | پس‌انداز ${fmt(r.repair)}` +
    (r.parking ? ` | پارکینگ ${fmt(r.parking)}` : '') +
    `\nبدهی قبلی: ${fmt(r.prev_debt)}\nمانده قابل پرداخت: ${fmt(r.remaining)} تومان`;
}

function reqTable(list, admin) {
  if (!list || !list.length) return `<p class="sub">موردی نیست</p>`;
  const st = s => s === 'approved' ? '<span class="chip ok">تایید شد</span>' : s === 'rejected' ? '<span class="chip no">رد شد</span>' : '<span class="chip pd">منتظر تایید</span>';
  return `<div class="tbl-wrap" style="border:1px solid var(--line)"><table><thead><tr>
    ${admin ? '<th>واحد</th>' : ''}<th>ماه</th><th>مبلغ</th><th>وضعیت</th>${admin ? '<th></th>' : ''}
  </tr></thead><tbody>
    ${list.map(p => `<tr>
      ${admin ? `<td><b>واحد ${fa(p.unit_no)}</b><br><span style="font-size:12px;color:var(--muted)">${esc(p.full_name || '')}</span></td>` : ''}
      <td>${MONTHS[p.month - 1]} ${fa(p.year)}</td>
      <td>${money(p.amount)}</td>
      <td>${st(p.status)}</td>
      <td>${admin && p.status === 'pending' ? `<button class="btn sm" data-ap="${p.id}">بررسی</button>` : ''}</td>
    </tr>`).join('')}
  </tbody></table></div>`;
}


// Scroll-controlled visual only: does not change payments, balances or database.
let cleanupPaymentScroll = null;
function setupPaymentScrollAnimation(root, unitMap) {
  if (cleanupPaymentScroll) { cleanupPaymentScroll(); cleanupPaymentScroll = null; }
  const map = root.querySelector('#building-map');
  const incomeSource = root.querySelector('#monthly-income-card');
  const debtSource = root.querySelector('#overdue-debt-card');
  if (!map || !incomeSource || !debtSource) return;

  const entries = [...root.querySelectorAll('.animated-unit')].flatMap(unit => {
    const data = unitMap[Number(unit.dataset.u)];
    if (!data) return [];
    return [
      { source: incomeSource, target: unit.querySelector('.unit-paid'), amount: Number(data.paid_this_month), kind: 'paid' },
      { source: debtSource, target: unit.querySelector('.unit-debt'), amount: Number(data.remaining), kind: 'debt' }
    ].filter(x => x.target && Number.isFinite(x.amount) && x.amount > 0);
  });
  if (!entries.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const chips = entries.map(({ amount, kind }) => {
    const chip = document.createElement('div');
    chip.className = 'fly-payment' + (kind === 'debt' ? ' fly-debt' : '');
    chip.textContent = fmt(amount) + ' تومان';
    chip.style.display = 'none';
    document.body.appendChild(chip);
    return chip;
  });
  let raf = 0;
  const clamp = x => Math.max(0, Math.min(1, x));
  const cleanup = () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    if (raf) cancelAnimationFrame(raf);
    chips.forEach(c => c.remove());
    entries.forEach(x => { x.target.style.opacity = ''; });
    if (cleanupPaymentScroll === cleanup) cleanupPaymentScroll = null;
  };
  const update = () => {
    raf = 0;
    if (!root.isConnected || S.view !== 'dash') { cleanup(); return; }
    const mr = map.getBoundingClientRect();
    const viewport = window.innerHeight;
    const progress = clamp((viewport * .85 - mr.top) / Math.max(180, viewport * .55));
    entries.forEach(({ source, target, kind }, i) => {
      const chip = chips[i];
      const src = source.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      // Keep red and green flights visually staggered but tied to scrolling.
      const stagger = entries.length > 1 ? i / (entries.length - 1) * .30 : 0;
      const p = clamp((progress - stagger) / .70);
      target.style.opacity = p >= .99 ? '1' : '0';
      if (p <= 0 || p >= .99) { chip.style.display = 'none'; return; }
      chip.style.display = 'block';
      const x0 = src.left + src.width / 2;
      const y0 = src.top + src.height / 2;
      const x1 = t.left + t.width / 2;
      const y1 = t.top + t.height / 2;
      const ease = p * p * (3 - 2 * p);
      chip.style.left = (x0 + (x1 - x0) * ease) + 'px';
      chip.style.top = (y0 + (y1 - y0) * ease - (kind === 'debt' ? -18 : 22) * Math.sin(Math.PI * p)) + 'px';
      chip.style.transform = `translate(-50%,-50%) scale(${.78 + .22 * ease})`;
      chip.style.opacity = String(Math.min(1, p * 8, (1 - p) * 8));
    });
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
  cleanupPaymentScroll = cleanup;
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  schedule();
}

async function viewDash(el) {
  const rep = await T('app_report', { p_year: S.y, p_month: S.m });
  const managerResidencyUnits = S.me.is_admin ? await T('app_get_units') : [];
  const managerResidencyIssues = S.me.is_admin ? (managerResidencyUnits.length ? managerResidencyUnits.filter(u=>u.residency_issue) : [{unit_no:null,residency_issue:'هنوز واحدی برای ساختمان ثبت نشده است'}]) : [];
  const residencyWarning = managerResidencyIssues.length ? `<div class="card" style="margin-bottom:16px;border-color:var(--danger);background:var(--bg)"><b style="color:var(--danger)">ثبت هرگونه تراکنش مالی تا تعیین تکلیف و تأیید تمام واحدها مسدود است.</b><p class="sub" style="margin:8px 0 0">واحدهای نیازمند اقدام: ${managerResidencyIssues.map(u=>(u.unit_no?'واحد '+fa(u.unit_no)+': ':'')+esc(u.residency_issue)).join(' · ')}</p><button class="btn sf sm" style="margin-top:10px" data-go="units">تعیین وضعیت واحدها</button></div>` : '';
  const missing = rep.missing_rates?.length ? `<div class="card" style="background:#fee2e2;color:#991b1b;margin-bottom:20px">مبالغ شارژ/پس‌انداز برای این ماه‌ها تعریف نشده: ${rep.missing_rates.map(fa).join('، ')}</div>` : '';

  if (!S.me.is_admin) {
    const r = rep.rows[0]; const reqs = await T('app_get_payment_requests');
    el.innerHTML = `${mustChangeBanner()}
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:8px">
        <div><h1>سلام ${esc(S.me.full_name || ('واحد ' + fa(S.me.unit_no)))} 👋</h1><p class="sub" style="margin:0">صورتحساب ${rep.month_name} ${fa(rep.year)}</p></div>
        ${periodPicker()}
      </div>
      <div><div class="sec-title">دسترسی سریع</div>
        <div class="quick">${[['pay','پرداخت بدهی'],['tx','تراکنش‌ها'],['announcements','اعلانات'],['requests','ارتباط با مدیر']].map(([k,l]) => `<button class="tile" data-go="${k}">${ico(k)}<span>${l}</span></button>`).join('') + installTileHtml()}</div></div>
      ${missing}
      <div style="margin-top:20px">${r ? billCard(r, rep) : '<p class="sub">صورتحسابی ثبت نشده.</p>'}</div>
      <div class="sec-title">سابقه پرداخت‌ها</div>
      ${reqTable(reqs.slice(0, 8), false)}`;
    bindPeriod(() => go('dash'));
    $('#go-profile')?.addEventListener('click', e => { e.preventDefault(); go('profile'); });
    $$('[data-go]', el).forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
   $$('[data-install]', el).forEach(b => b.addEventListener('click', installPwa));
    countUp(el); bindEyes(el);
    return;
  }

  const fund = await T('app_fund_summary', { p_year: S.y, p_month: S.m });
  const rows = rep.rows || [];
  const unitMap = {};
  rows.forEach(r => {
    if (r.unit_no == null) return;
    if (!unitMap[r.unit_no]) unitMap[r.unit_no] = { unit_no: r.unit_no, remaining: 0, current_due: 0, paid_this_month: 0, accounts: [], display_name: '' };
    const u = unitMap[r.unit_no];
    u.remaining += Number(r.remaining) || 0;
    u.current_due += Number(r.current_due) || 0;
    u.paid_this_month += Number(r.paid_this_month) || 0;
    u.accounts.push(r);
    if (!u.display_name && r.full_name) u.display_name = r.full_name;
  });
  const mapUnits = []; for (let i = 1; i <= (S.unitCount || 10); i++) { mapUnits.push(unitMap[i] || { unit_no: i, remaining: 0, current_due: 0, accounts: [], display_name: '-' }); }
  const floors = []; const orderedUnits = [...mapUnits].reverse(); for (let i = 0; i < orderedUnits.length; i += 4) floors.push(orderedUnits.slice(i, i + 4));
  const totalDebt = mapUnits.reduce((s, r) => s + Math.max(0, r.remaining), 0);
  const winBg = r => r.remaining <= 0 ? '#e9f8ef' : r.remaining > r.current_due ? '#fdeeee' : '#fff4e8';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:8px">
      <div><h1>داشبورد مدیریت</h1><p class="sub" style="margin:0">خلاصه وضعیت صندوق در ${rep.month_name} ${fa(rep.year)}</p></div>
      ${periodPicker()}
    </div>
    ${missing}
    ${residencyWarning}
    ${mustChangeBanner()}
    <div><div class="sec-title">دسترسی سریع</div>
      <div class="quick">${[['units','واحدها'],['pay','تایید پرداخت'],['announcements','اعلانات'],['settings','تنظیمات']].map(([k,l]) => `<button class="tile" data-go="${k}">${ico(k)}${k==='pay' && +fund.pending_payments ? `<i class="badge">${fa(fund.pending_payments)}</i>` : ''}<span>${l}</span></button>`).join('') + installTileHtml()}</div></div>
    <div class="grid dashboard-money-grid" style="margin:14px 0 12px">
      <div class="bank-card"><i class="shine"></i>
        <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px">صندوق ساختمان</b><span style="color:#ffd27a;font-size:20px">★</span></div>
        <div class="bc-row"><span>موجودی فعلی (تومان)</span></div>
        <div class="bc-row" style="margin-top:4px;justify-content:flex-start"><button class="eye" type="button">${EYE}</button><span class="bc-amt" data-count="${fund.balance}">${fmt(fund.balance)}</span></div>
        <div class="bc-row" style="margin-top:14px"><span></span><button class="pill" type="button" data-go="tx">گردش حساب</button></div>
      </div>
      <div class="bank-card soft" id="monthly-income-card"><i class="shine"></i>
        <b style="font-size:15px">درآمد این ماه</b>
        <div class="bc-row"><span>تومان</span></div>
        <div class="bc-amt" data-count="${fund.month_income ?? fund.month_expense}" style="margin-top:4px">${fmt(fund.month_income ?? fund.month_expense)}</div>
        <div class="bc-row" style="margin-top:14px"><span></span><button class="pill" type="button" data-go="report">گزارش ماه</button></div>
      </div>
      <div class="bank-card peach" id="overdue-debt-card"><i class="shine"></i>
        <b style="font-size:15px">مطالبات معوق</b>
        <div class="bc-row" style="color:#fff"><span>تومان</span></div>
        <div class="bc-amt" data-count="${totalDebt}" style="margin-top:4px">${fmt(totalDebt)}</div>
        <div class="bc-row" style="margin-top:14px"><span></span><button class="pill" type="button" data-go="units">مشاهده واحدها</button></div>
      </div>
    </div>
    <div class="grid dashboard-detail-grid">
      <div class="card" id="building-map"><h2>نقشه ساختمان</h2>
        <div class="dashboard-units-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:12px">
          ${floors.map(fl => fl.map(r => r ? `<button class="win animated-unit" data-u="${r.unit_no}" style="background:${winBg(r)}">
            <span style="font-size:11px;font-weight:700;color:#555">واحد ${fa(r.unit_no)}</span>
            <span style="font-size:11px;font-weight:900;color:#111">${esc(r.display_name)}</span>
            <div class="unit-finance">
              ${r.paid_this_month > 0 ? `<div class="unit-paid"><span>پرداختی این ماه</span><strong>${fmt(r.paid_this_month)} تومان</strong></div>` : ''}
              ${r.remaining > 0 ? `<div class="unit-debt"><span>بدهی باقی‌مانده</span><strong>${fmt(r.remaining)} تومان</strong></div>` : ''}
              ${r.remaining <= 0 && r.paid_this_month <= 0 ? `<div class="unit-settled">تسویه</div>` : ''}
            </div>
          </button>` : '').join('')).join('')}
        </div>
      </div>
      <div class="grid" style="align-content:start">
        <div class="card"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><h2 style="margin:0">پرداخت‌های منتظر تایید</h2><button class="btn lt sm" id="go-pay">مشاهده</button></div><div style="font-size:36px;font-weight:900;color:var(--warning)">${fa(fund.pending_payments)}</div></div>
        <div class="card"><h2>قبض‌های این ماه</h2><div style="font-size:13px;color:var(--muted);line-height:2">قبض آب: ${fmt(rep.water_total)} تومان<br>قبض گاز: ${fmt(rep.gas_total)} تومان</div></div>
      </div>
    </div>`;

  bindPeriod(() => go('dash'));
  $$('[data-go]', el).forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
   $$('[data-install]', el).forEach(b => b.addEventListener('click', installPwa));
  countUp(el); bindEyes(el);
  setupPaymentScrollAnimation(el, unitMap);
  $('#go-pay')?.addEventListener('click', () => go('pay'));
  $('#go-profile')?.addEventListener('click', e => { e.preventDefault(); go('profile'); });
  $$('.win', el).forEach(b => b.addEventListener('click', () => {
    const uData = mapUnits.find(x => x.unit_no == b.dataset.u); if (!uData) return;
    const cardsHtml = uData.accounts.length ? uData.accounts.map(r => billCard(r, rep)).join('<hr style="border:0;border-top:1px dashed var(--line);margin:20px 0">') : '<p class="sub" style="text-align:center;padding:20px">حسابی برای این واحد ثبت نشده است.</p>';
    const smsHtml = uData.accounts.map(r => r.phone ? smsBtn(r.phone, reminderText(r, rep), `پیامک به ${r.full_name || r.occupancy}`) : '').join('');
const m = modal(`
  <div style="margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <h2 style="margin:0">صورتحساب واحد ${fa(uData.unit_no)}</h2>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <!-- پرداخت برای هر حساب در کارت صورتحساب همان حساب انجام می‌شود. -->
      ${smsHtml}
    </div>
  </div>
  ${cardsHtml}
  <div style="margin-top:20px"><button class="btn lt sm" id="m-tx">تراکنش‌های این واحد</button></div>
`);

// پرداخت از دکمه مستقل هر کارت صورتحساب انجام می‌شود.
  }));
}


async function renderPollsInAnnouncements(el) {
  const admin = !!S.me.is_admin;
  let polls = [];
  try {
    const value = await T('app_get_polls');
    polls = Array.isArray(value) ? value : [];
  } catch (err) { console.error('app_get_polls failed:', err); }
  const pollCreateForm = admin ? `
    <form id="poll-create-form" class="card grid" style="gap:12px;margin-bottom:20px;border-color:var(--accent)">
      <h2 style="margin:0">📊 ایجاد نظرسنجی</h2>
      <label class="f">عنوان نظرسنجی
        <input id="poll-title" maxlength="180" required placeholder="مثلاً انتخاب زمان نظافت راه‌پله">
      </label>
      <label class="f">توضیحات (اختیاری)
        <textarea id="poll-description" rows="2" maxlength="1000"></textarea>
      </label>
      <label class="f">گزینه‌ها (هر گزینه در یک خط؛ حداقل ۲ گزینه)
        <textarea id="poll-options" rows="4" required placeholder="شنبه&#10;یکشنبه&#10;دوشنبه"></textarea>
      </label>
      <label style="display:flex;align-items:center;gap:8px"><input id="poll-active" type="checkbox" checked> بلافاصله فعال شود</label>
      <button class="btn">ثبت نظرسنجی</button>
    </form>` : '';

  const pollCards = (polls || []).map(p => {
    const options = (p.options || []).map(o => `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)">
        <span>${esc(o.text)}</span>
        <strong style="white-space:nowrap">${fa(Number(o.votes || 0))} رأی · ${fa(Math.round(Number(o.percent || 0)))}٪</strong>
      </div>`).join('');
    const canVote = p.is_active && !p.my_vote;
    const voteForm = canVote ? `
      <form data-vote-form="${p.id}" style="margin-top:12px">
        <div style="display:grid;gap:9px">
          ${(p.options || []).map(o => `<label style="display:flex;align-items:center;gap:8px"><input type="radio" name="poll-option-${p.id}" value="${o.id}" required> ${esc(o.text)}</label>`).join('')}
        </div>
        <button class="btn sm" style="margin-top:12px">ثبت رأی نهایی</button>
      </form>` : '';
    const voteStatus = p.my_vote
      ? '<p class="sub" style="margin:12px 0 0">✅ رأی شما ثبت شده است؛ امکان تغییر رأی وجود ندارد.</p>'
      : (!p.is_active ? '<p class="sub" style="margin:12px 0 0">این نظرسنجی بسته شده است.</p>' : '');
    const adminToggle = admin ? `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn ${p.is_active ? 'rd' : 'sf'} sm" data-poll-toggle="${p.id}" data-next="${p.is_active ? 'false' : 'true'}">
          ${p.is_active ? 'غیرفعال‌کردن نظرسنجی' : 'فعال‌کردن نظرسنجی'}
        </button>
        <button class="btn rd sm" data-poll-delete="${p.id}">حذف کامل نظرسنجی</button>
      </div>` : '';
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">
          <h2 style="margin:0">${esc(p.title)}</h2>
          <span class="chip ${p.is_active ? 'ok' : 'ex'}">${p.is_active ? 'فعال' : 'غیرفعال'}</span>
        </div>
        ${p.description ? `<p class="sub" style="white-space:pre-wrap">${esc(p.description)}</p>` : ''}
        <div style="margin-top:10px">${options}</div>
        <p class="sub" style="font-size:12px;margin:10px 0 0">مجموع آرای ثبت‌شده: ${fa(Number(p.total_votes || 0))}</p>
        ${voteForm}${voteStatus}
        ${adminToggle ? `<div style="margin-top:14px">${adminToggle}</div>` : ''}
      </div>`;
  }).join('');


  const section = document.createElement('section');
  section.style.marginTop = '24px';
  section.innerHTML = `
    <h2 style="margin:0 0 12px">📊 نظرسنجی‌های ساختمان</h2>
    ${pollCreateForm}
    <div class="grid g2">${pollCards || '<div class="card sub">در حال حاضر نظرسنجی‌ای وجود ندارد.</div>'}</div>
  `;
  el.appendChild(section);
  if (admin) {
    $('#poll-create-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const title = $('#poll-title').value.trim();
      const description = $('#poll-description').value.trim();
      const options = $('#poll-options').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      if (options.length < 2) { toast('حداقل دو گزینه وارد کنید', true); return; }
      if (options.length > 20) { toast('حداکثر ۲۰ گزینه می‌توانید ثبت کنید', true); return; }
      if (options.some(x => x.length > 120)) { toast('طول هر گزینه نباید بیشتر از ۱۲۰ نویسه باشد', true); return; }
      if (new Set(options.map(x => x.toLocaleLowerCase())).size !== options.length) { toast('گزینه‌های تکراری مجاز نیستند', true); return; }
      try {
        const isActive = $('#poll-active').checked;
        await T('app_admin_create_poll', {
          p_title: title,
          p_description: description,
          p_options: options,
          p_is_active: isActive
        });
        if (isActive) {
          const pollText = `📊 نظرسنجی جدید ساختمان\n\n${title}${description ? `\n${description}` : ''}\n\nگزینه‌ها:\n${options.map((x, i) => `${i + 1}) ${x}`).join('\n')}\n\nبرای ثبت رأی وارد برنامه مدیریت ساختمان شوید.`;
          const sent = await notifyBale(pollText);
        await sendMobilePush('poll_created', 'نظرسنجی جدید: ' + title, description || options.join('، '));
          toast(sent ? 'نظرسنجی ایجاد و در گروه بله اعلام شد' : 'نظرسنجی ایجاد شد؛ ارسال اعلان به بله ناموفق بود', !sent);
        } else {
          toast('نظرسنجی به‌صورت غیرفعال ایجاد شد');
        }
        go('announcements');
      } catch (err) { showErr(err); }
    });

    $$('[data-poll-toggle]').forEach(b => b.addEventListener('click', async () => {
      try {
        await T('app_admin_set_poll_active', {
          p_poll_id: Number(b.dataset.pollToggle),
          p_active: b.dataset.next === 'true'
        });
        toast('وضعیت نظرسنجی تغییر کرد');
        go('announcements');
      } catch (err) { showErr(err); }
    }));

    $$('[data-poll-delete]').forEach(b => b.addEventListener('click', async () => {
      const ok = confirm('این نظرسنجی، همه گزینه‌ها و تمام آرای آن برای همیشه حذف می‌شود و دیگر در صفحه هیچ‌کس نمایش داده نخواهد شد. ادامه می‌دهید؟');
      if (!ok) return;
      b.disabled = true;
      try {
        await T('app_admin_delete_poll', { p_poll_id: Number(b.dataset.pollDelete) });
        toast('نظرسنجی به‌طور کامل حذف شد');
        go('announcements');
      } catch (err) {
        b.disabled = false;
        showErr(err);
      }
    }));


  }
  $$('[data-vote-form]').forEach(form => form.addEventListener('submit', async e => {
    e.preventDefault();
    const pollId = Number(form.dataset.voteForm);
    const selected = form.querySelector('input[type="radio"]:checked');
    if (!selected) { toast('یک گزینه را انتخاب کنید', true); return; }
    const submit = form.querySelector('button');
    if (submit) submit.disabled = true;
    try {
      await T('app_vote_poll', { p_poll_id: pollId, p_option_id: Number(selected.value) });
      let baleSent = false;
      try {
        const allPolls = await T('app_get_polls');
        const current = (allPolls || []).find(p => Number(p.id) === pollId);
        if (current) {
          const lines = (current.options || []).map(o =>
            `• ${o.text}: ${o.votes} رأی (${Number(o.percent || 0).toFixed(1)}٪)`
          );
          const resultsText = `📊 به‌روزرسانی نتیجه نظرسنجی\n${current.title}\n\n${lines.join('\n')}\n\nمجموع آرا: ${current.total_votes}`;
          baleSent = await notifyBale(resultsText);
        }
      } catch (notifyErr) {
        console.warn('Poll results notification failed:', notifyErr);
      }
      toast(
        baleSent
          ? 'رأی ثبت شد؛ نتیجه به‌روز در گروه بله ارسال شد'
          : 'رأی شما ثبت شد؛ ارسال نتیجه به بله انجام نشد',
        !baleSent
      );
      go('announcements');
    } catch (err) {
      if (submit) submit.disabled = false;
      showErr(err);
    }
  }));
}

async function viewAnnouncements(el) {
  markAlertPrefixSeen('announcement:');
  const list = await T('app_get_announcements');
  const adminForm = S.me.is_admin ? `<form id="af" class="card grid g3" style="margin-bottom:20px;border-color:var(--accent)"><h2 style="grid-column:1/-1;margin:0">ارسال اعلان جدید</h2><label class="f">عنوان<input id="a-title" required maxlength="180"></label><label class="f">نوع<select id="a-type"><option value="general">اطلاعیه عمومی</option><option value="meeting">دعوت به جلسه</option></select></label><label class="f" style="grid-column:1/-1">متن کامل<textarea id="a-content" rows="3" required maxlength="5000"></textarea></label><div style="grid-column:1/-1"><button class="btn">ثبت اعلان</button></div></form>` : '';
  el.innerHTML = `<h1>اعلانات ساختمان</h1><p class="sub">اطلاعیه‌ها و دعوت‌نامه‌ها</p>${adminForm}<div class="grid g2">${list.map(a => `<div class="card"><div style="display:flex;justify-content:space-between;margin-bottom:8px;gap:8px;flex-wrap:wrap"><h2 style="margin:0">${esc(a.title)}</h2><span class="chip ${a.type === 'meeting' ? 'pd' : 'ex'}">${a.type === 'meeting' ? 'جلسه' : (a.type === 'resident_message' ? 'پیام گروهی ساکن' : 'اطلاعیه')}</span></div><p style="white-space:pre-wrap;margin:0 0 16px">${esc(a.content)}</p><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><span style="font-size:12px;color:var(--muted)">${new Date(a.created_at).toLocaleDateString('fa-IR')}</span>${S.me.is_admin ? `<button class="btn rd sm" data-del="${a.id}">حذف</button>` : ''}</div></div>`).join('') || '<div class="card sub">هیچ اعلانی وجود ندارد.</div>'}</div>`;
  if (S.me.is_admin) {
    $('#af')?.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        const title = $('#a-title').value; const content = $('#a-content').value; const type = $('#a-type').value;
        await T('app_admin_save_announcement', { p_title: title, p_content: content, p_type: type });
        notifyBale(`📢 اعلان جدید در ساختمان:\n\n🔹 ${title}\n\n${content}`);
        await sendMobilePush('announcement_created', title, content);
        toast('ثبت شد'); go('announcements');
      } catch (err) { showErr(err); }
    });
    $$('[data-del]').forEach(b => b.addEventListener('click', async () => { if (!confirm('حذف شود؟')) return; try { await T('app_admin_delete_announcement', { p_id: +b.dataset.del }); toast('حذف شد'); go('announcements'); } catch (e) { showErr(e); } }));
  }
  await renderPollsInAnnouncements(el);
}

async function viewNeighborAlerts(el) {
  markAlertPrefixSeen('neighbor:');
  markAlertPrefixSeen('neighbor-summary:');
  const categoryLabels = {
    noise: 'سروصدای غیرمتعارف',
    quiet_hours: 'رعایت ساعات استراحت',
    common_areas: 'رعایت فضای مشاع',
    other: 'سایر موارد همسایگی'
  };
  const [units, received, summary] = await Promise.all([
    T('app_neighbor_alert_units'),
    T('app_neighbor_alert_list'),
    S.me?.is_admin ? T('app_manager_neighbor_alert_summary') : Promise.resolve([])
  ]);
  const unitList = Array.isArray(units) ? units : [];
  const incoming = Array.isArray(received) ? received : [];
  const managerRows = Array.isArray(summary) ? summary : [];
  const options = unitList.map(n => `<option value="${Number(n)}">واحد ${fa(n)}</option>`).join('');
  const form = `
    <form id="neighbor-alert-form" class="card grid" style="gap:12px;margin:14px 0;border-color:var(--accent)">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:30px">🔔</span>
        <div><h2 style="margin:0">ارسال زنگ همسایگی</h2><p class="sub" style="margin:3px 0 0">یک یادآوری محترمانه و محرمانه برای یک واحد</p></div>
      </div>
      <label class="f">واحد مقصد
        <select id="neighbor-target-unit" required ${options ? '' : 'disabled'}>
          <option value="">انتخاب واحد</option>${options}
        </select>
      </label>
      <label class="f">موضوع
        <select id="neighbor-category" required>
          <option value="noise">سروصدای غیرمتعارف</option>
          <option value="quiet_hours">رعایت ساعات استراحت</option>
          <option value="common_areas">رعایت فضای مشاع</option>
          <option value="other">سایر موارد همسایگی</option>
        </select>
      </label>
      <button class="btn neighbor-emergency-btn" id="neighbor-alert-submit" type="submit" ${options ? '' : 'disabled'}>🚨 ارسال یادآوری محرمانه</button>
      <p class="sub" style="margin:0;line-height:1.9">نام ارسال‌کننده به گیرنده و در گزارش مدیر نمایش داده نمی‌شود. هر حساب حداکثر ۳ هشدار در ۲۴ ساعت و هر واحد حداکثر ۵ هشدار در ۲۴ ساعت دریافت می‌کند؛ ارسال دوباره همان موضوع از سوی یک حساب برای همان واحد تا ۶ ساعت محدود است.</p>
    </form>`;
  const history = `
    <section class="card" style="margin:14px 0">
      <h2 style="margin:0 0 10px">یادآوری‌های دریافت‌شده برای واحد شما</h2>
      ${S.me?.unit_no ? (incoming.length ? incoming.map(a => `
        <div style="padding:12px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div><b>${esc(categoryLabels[a.category] || 'یادآوری همسایگی')}</b>
            <div class="sub" style="font-size:11px;margin-top:4px">${new Date(a.created_at).toLocaleString('fa-IR')}</div>
          </div>
          ${a.status === 'acknowledged' ? '<span class="chip ok">دریافت و بررسی شد</span>' : `<button class="btn lt sm" data-neighbor-ack="${Number(a.id)}">دریافت و بررسی شد</button>`}
        </div>`).join('') : '<p class="sub">در ۳۰ روز گذشته یادآوری جدیدی برای واحد شما ثبت نشده است.</p>') : '<p class="sub">این حساب به واحد مسکونی متصل نیست؛ بخش دریافت هشدار برای حساب‌های دارای واحد نمایش داده می‌شود.</p>'}
    </section>`;
  const managerReport = S.me?.is_admin ? `
    <section class="card" style="margin:14px 0">
      <h2 style="margin:0 0 6px">گزارش تجمیعی مدیر</h2>
      <p class="sub" style="margin:0 0 10px">آمار ۳۰ روز گذشته؛ هویت ارسال‌کنندگان در این گزارش نمایش داده نمی‌شود.</p>
      ${managerRows.length ? managerRows.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line)">
          <div><b>واحد ${fa(r.target_unit_no)}</b><div class="sub" style="font-size:11px">${esc(categoryLabels[r.category] || 'سایر موارد')}</div></div>
          <div style="text-align:left;white-space:nowrap"><b>${fa(r.total)} هشدار</b><div class="sub" style="font-size:11px">${fa(r.pending)} بررسی‌نشده</div></div>
        </div>`).join('') : '<p class="sub">هنوز گزارشی ثبت نشده است.</p>'}
    </section>` : '';
  el.innerHTML = `
    <h1>زنگ همسایگی</h1>
    <p class="sub">راهی آرام و محترمانه برای یادآوری نکات مربوط به آسایش ساختمان، بدون واسطه‌کردن مدیر</p>
    ${form}${history}${managerReport}
    <div class="card" style="background:var(--bg);line-height:1.9">
      <b>قواعد استفاده</b>
      <p class="sub" style="margin:5px 0 0">این ابزار برای تذکر محترمانه است، نه تهدید یا تسویه‌حساب شخصی. متن آزاد یا نام افراد ارسال نمی‌شود و هشدارها به‌تنهایی اثبات‌کننده تخلف نیستند.</p>
    </div>`;
  $('#neighbor-alert-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const button = $('#neighbor-alert-submit');
    const target = Number($('#neighbor-target-unit')?.value);
    const category = $('#neighbor-category')?.value;
    if (!Number.isInteger(target) || target < 1 || !category) return toast('واحد و موضوع هشدار را انتخاب کنید', true);
    if (!confirm('یادآوری محرمانه برای واحد ' + fa(target) + ' ارسال شود؟')) return;
    // Short emergency-style feedback; vibration is supported on compatible mobile browsers.
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate([900, 160, 550]);
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const audio = new AudioCtx();
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audio.currentTime);
        osc.frequency.linearRampToValueAtTime(560, audio.currentTime + 0.48);
        osc.frequency.linearRampToValueAtTime(880, audio.currentTime + 0.92);
        gain.gain.setValueAtTime(0.0001, audio.currentTime);
        gain.gain.linearRampToValueAtTime(0.10, audio.currentTime + 0.06);
        gain.gain.setValueAtTime(0.10, audio.currentTime + 0.92);
        gain.gain.linearRampToValueAtTime(0.0001, audio.currentTime + 1.18);
        osc.connect(gain); gain.connect(audio.destination);
        osc.start(); osc.stop(audio.currentTime + 1.2);
        osc.onended = () => audio.close();
      }
    } catch (feedbackError) { console.warn('Neighbor alert feedback unavailable:', feedbackError); }
    button.disabled = true;
    button.textContent = 'در حال ارسال...';
    try {
      const { data, error } = await sb.functions.invoke('send-neighbor-alert', {
        body: { token: S.token, target_unit_no: target, category, url: new URL('./', document.baseURI).pathname }
      });
      if (error) {
        let message = error.message || 'ارسال هشدار انجام نشد';
        try {
          const response = error.context;
          if (response && typeof response.clone === 'function') {
            const payload = await response.clone().json();
            if (payload?.error) message = payload.error;
          }
        } catch (_) {}
        throw new Error(message);
      }
      if (!data?.success) throw new Error(data?.error || 'ارسال هشدار انجام نشد');
      toast(data.sent > 0 ? 'یادآوری محرمانه ارسال شد' : 'هشدار ثبت شد؛ هنوز اعلان فعالی برای این واحد در دسترس نیست');
      go('neighbor-alerts');
    } catch (error) {
      showErr(error);
      button.disabled = false;
      button.textContent = 'ارسال یادآوری محرمانه';
    }
  });
  $$('[data-neighbor-ack]').forEach(button => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await T('app_neighbor_alert_ack', { p_alert_id: Number(button.dataset.neighborAck) });
      toast('وضعیت یادآوری ثبت شد');
      go('neighbor-alerts');
    } catch (error) { showErr(error); button.disabled = false; }
  }));
}

async function viewRequests(el) {
  markAlertPrefixSeen('request:');
  markAlertPrefixSeen('registration:');
  const admin = !!S.me.is_admin;
  // Keep registration requests independent from other request/poll endpoints.
  let list = [], registrations = [];
  const safeLoad = async (name, fallback) => {
    try { const value = await T(name); return value ?? fallback; }
    catch (err) { console.error(name + ' failed:', err); return fallback; }
  };
  const loads = [
    safeLoad('app_get_requests', []).then(v => { list = Array.isArray(v) ? v : []; }),
    ...(admin ? [safeLoad('app_admin_list_membership_registrations', []).then(v => { registrations = Array.isArray(v) ? v : []; })] : [])
  ];
  await Promise.all(loads);

  const statusChip = s => {
    if (s === 'done') return '<span class="chip ok">✅ انجام شد</span>';
    if (s === 'reviewing') return '<span class="chip pd">🔄 در حال بررسی</span>';
    return '<span class="chip ex">⏳ جدید</span>';
  };

  const residentForm = !admin ? `
    <form id="rf2" class="card grid g3" style="margin-bottom:20px;border-color:var(--accent)">
      <h2 style="grid-column:1/-1;margin:0">ثبت درخواست جدید</h2>
      <label class="f">موضوع
        <select id="rq-type">
          <option>درخواست تعمیرات</option>
          <option>انتقاد و پیشنهاد</option>
        </select>
      </label>
      <label class="f" style="grid-column:1/-1">توضیحات
        <textarea id="rq-desc" rows="3" required></textarea>
      </label>
      <div style="grid-column:1/-1"><button class="btn">ارسال به مدیر</button></div>
    </form>
    <form id="group-msg-form" class="card grid" style="gap:12px;margin-bottom:20px;border-color:var(--accent)">
      <h2 style="margin:0">💬 پیام در گروه بله</h2>
      <p class="sub" style="margin:0">پیام شما در گروه بله منتشر می‌شود و هم‌زمان به‌صورت اعلان داخل برنامه برای همه ساکنان نمایش داده خواهد شد. اطلاعات خصوصی را در این بخش ننویسید.</p>
      <label class="f">متن پیام
        <textarea id="group-msg-text" rows="4" maxlength="3000" required placeholder="متن پیام برای همسایه‌ها..."></textarea>
      </label>
      <button class="btn">ارسال پیام به گروه</button>
    </form>` : '';

  const registrationPanel = admin ? `
    <section class="card" style="margin:16px 0;border-color:var(--accent)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div><h2 style="margin:0">درخواست‌های ثبت‌نام اعضا</h2><p class="sub" style="margin:5px 0 0">بررسی و تأیید عضویت‌ها در همین بخش انجام می‌شود.</p></div>
        <span class="chip ${registrations.length ? 'pd' : 'ok'}">${fa(registrations.length)} در انتظار</span>
      </div>
      <div class="grid g2" style="margin-top:14px">
        ${registrations.map(r => `<article class="card" style="box-shadow:none">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap"><h2 style="margin:0">${esc(r.full_name || '—')}</h2><span class="chip pd">در انتظار بررسی</span></div>
          <p class="sub" style="margin:6px 0 10px">${esc(r.occupancy || '—')} · واحد ${fa(r.unit_no)}</p>
          <p>نام کاربری: <b>${esc(r.username || '—')}</b></p>
          <p class="sub">موبایل: ${esc(r.phone || '—')} · ایمیل: ${esc(r.email || '—')}</p>
          <p class="sub">متراژ: ${r.area == null ? '—' : fa(r.area) + ' متر'} · تعداد افراد ساکن در واحد شما: ${r.persons == null ? '—' : fa(r.persons)}</p>
          <p class="sub">تاریخ شروع: ${esc(r.start_date_jalali || '—')}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn sf sm" data-registration-approve="${r.id}">تأیید عضویت</button><button class="btn rd sm" data-registration-reject="${r.id}">رد درخواست</button></div>
        </article>`).join('') || '<div class="sub">درخواست ثبت‌نامِ در انتظار بررسی وجود ندارد.</div>'}
      </div>
    </section>` : '';
  const pendingPayShortcut = admin ? `<div class="card" style="margin:16px 0;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
    <div><b>تأیید پرداخت‌ها</b><p class="sub" style="margin:4px 0 0">درخواست‌های پرداخت در بخش بررسی پرداخت‌ها رسیدگی می‌شوند.</p></div>
    <button class="btn sf sm" id="open-pending-pay">مشاهده پرداخت‌ها</button>
  </div>` : '';
  el.innerHTML = `
    <h1>${admin ? 'درخواست‌ها' : 'ارتباط با مدیر'}</h1>
    <p class="sub">${admin ? 'درخواست‌های ساکنان و پاسخ‌گویی' : 'ثبت درخواست و ارسال پیام عمومی'}</p>
    ${residentForm}
    ${registrationPanel}
    ${pendingPayShortcut}
    <section style="margin-top:24px">
      <h2 style="margin:0 0 12px">${admin ? 'درخواست‌های ساکنان' : 'درخواست‌های ثبت‌شده من'}</h2>
      <div class="grid g2">
        ${(list || []).map(r => `
          <div class="card">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;gap:8px;flex-wrap:wrap">
              <h2 style="margin:0">${esc(r.type)}</h2>
              ${statusChip(r.status)}
            </div>
            <p class="sub" style="font-size:12px;margin:0 0 8px">
              ${esc(r.full_name || '')} ${r.unit_no ? '· واحد ' + fa(r.unit_no) : ''}
            </p>
            <p style="white-space:pre-wrap;margin:0 0 12px">${esc(r.description)}</p>
            ${r.admin_reply ? `
              <div style="background:var(--bg);border-right:3px solid var(--peach);padding:10px 14px;border-radius:10px;margin-bottom:12px">
                <div style="font-size:11.5px;color:var(--muted);margin-bottom:4px">
                  پاسخ مدیر ${r.replied_at ? '· ' + new Date(r.replied_at).toLocaleString('fa-IR') : ''}
                </div>
                <div style="white-space:pre-wrap">${esc(r.admin_reply)}</div>
              </div>` : ''}
            ${admin ? `<button class="btn sf sm" data-reply="${r.id}">${r.admin_reply ? 'ویرایش پاسخ' : 'پاسخ دادن'}</button>` : ''}
          </div>`).join('') || '<div class="card sub">موردی وجود ندارد.</div>'}
      </div>
    </section>`;

  if (!admin) {
    $('#rf2')?.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        const type = $('#rq-type').value;
        const desc = $('#rq-desc').value.trim();
        await T('app_submit_request', { p_type: type, p_description: desc });
        notifyBale(`🔔 درخواست جدید از واحد ${S.me.unit_no}:\n\n🔹 نوع: ${type}\n📝 توضیحات: ${desc}`);
        await sendMobilePush('resident_request_created', 'درخواست جدید از واحد ' + S.me.unit_no, type + (desc ? ' · ' + desc : ''));
        toast('درخواست ثبت شد'); go('requests');
      } catch (err) { showErr(err); }
    });

    $('#group-msg-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const message = $('#group-msg-text').value.trim();
      if (!message) return;
      const submit = $('#group-msg-form button[type="submit"], #group-msg-form button');
      if (submit) submit.disabled = true;
      try {
        const saved = await T('app_submit_group_message', { p_message: message });
        const title = saved?.title || `پیام گروهی از واحد ${S.me.unit_no || '—'}`;
        await sendMobilePush('group_message_created', title, message);
        const baleSent = await notifyBale(`💬 ${title}\n\n${message}`);
        toast(
          baleSent
            ? 'پیام در اعلان‌های برنامه ثبت و به گروه بله ارسال شد'
            : 'پیام در اعلان‌های برنامه ثبت شد؛ ارسال به بله ناموفق بود: ' + (S.lastBaleError || 'علت نامشخص'),
          !baleSent
        );
        go('requests');
      } catch (err) {
        if (submit) submit.disabled = false;
        showErr(err);
      }
    });
  } else {
    $$('[data-registration-approve], [data-registration-reject]', el).forEach(btn => btn.addEventListener('click', async () => {
      const approve = btn.hasAttribute('data-registration-approve');
      const id = Number(approve ? btn.dataset.registrationApprove : btn.dataset.registrationReject);
      if (!approve && !confirm('درخواست ثبت‌نام رد شود؟')) return;
      btn.disabled = true;
      try {
        const result = await T('app_admin_review_membership_registration', { p_request_id: id, p_decision: approve ? 'approve' : 'reject' });
        if (!result?.ok) throw new Error(result?.error || 'عملیات ناموفق بود');
        toast(approve ? 'عضویت تأیید و حساب فعال شد' : 'درخواست ثبت‌نام رد شد');
        go('requests');
      } catch (err) { btn.disabled = false; showErr(err); }
    }));
    $('#open-pending-pay')?.addEventListener('click', () => go('pay'));
    $('#transfer-create-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const target = $('#transfer-target')?.value;
      if (!target) { toast('جانشین را انتخاب کنید', true); return; }
      const submit = $('#transfer-create-form button');
      if (submit) submit.disabled = true;
      try {
        await T('app_management_transfer_create', { p_target_account_id: target });
        toast('درخواست انتقال برای جانشین ارسال شد');
        go('requests');
      } catch (err) {
        if (submit) submit.disabled = false;
        showErr(err);
      }
    });
    $('#transfer-cancel')?.addEventListener('click', async () => {
      if (!confirm('درخواست انتقال مدیریت لغو شود؟')) return;
      try {
        await T('app_management_transfer_cancel');
        toast('درخواست انتقال لغو شد');
        go('requests');
      } catch (err) { showErr(err); }
    });
    $$( '[data-reply]').forEach(b => {
      b.addEventListener('click', () => {
        const req = (list || []).find(x => x.id == b.dataset.reply);
        if (req) replyModal(req);
      });
    });
  }

}
function replyModal(r) {
  const m = modal(`
    <h2>پاسخ به درخواست واحد ${fa(r.unit_no || '—')}</h2>
    <p class="sub">${esc(r.full_name || '')} · ${esc(r.type)}</p>

    <div class="card" style="background:var(--bg);margin-bottom:16px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">متن درخواست:</div>
      <div style="white-space:pre-wrap">${esc(r.description)}</div>
    </div>

    <form id="rp-form" class="grid" style="gap:14px">
      <label class="f">وضعیت
        <select id="rp-status">
          <option value="reviewing" ${r.status === 'reviewing' ? 'selected' : ''}>در حال بررسی</option>
          <option value="done" ${r.status === 'done' ? 'selected' : ''}>انجام شد</option>
        </select>
      </label>
      <label class="f">توضیحات پاسخ
        <textarea id="rp-text" rows="4" placeholder="توضیح مدیر برای ساکن..." required>${esc(r.admin_reply || '')}</textarea>
      </label>
      <button class="btn sf" type="submit">ثبت پاسخ و ارسال به بله</button>
    </form>
  `);

  $('#rp-form', m).addEventListener('submit', async e => {
    e.preventDefault();
    const status = $('#rp-status', m).value;
    const reply = $('#rp-text', m).value.trim();
    if (!reply) { toast('توضیحات را وارد کنید', true); return; }

    try {
      // ارسال به دیتابیس
      await T('app_admin_reply_request', {
        p_id: r.id, p_status: status, p_reply: reply,
      });

      // ارسال به ربات بله
      const statusLabel = status === 'done' ? '✅ انجام شد' : '🔄 در حال بررسی';
      notifyBale(
        `📩 پاسخ به درخواست واحد ${r.unit_no}\n\n` +
        `🔹 نوع: ${r.type}\n` +
        `📌 وضعیت: ${statusLabel}\n\n` +
        `💬 پاسخ مدیر:\n${reply}`
      );

      await sendMobilePush('manager_reply_created', 'پاسخ مدیر به درخواست واحد ' + r.unit_no, reply, r.account_id);
      closeModal(m);
      toast('پاسخ ثبت شد');
      go('requests');
    } catch (err) { showErr(err); }
  });
}async function payModal(targetUnitNo = null, targetAccountId = null) {
  const isAdmin = S.me.is_admin;
  if (isAdmin && !targetAccountId) { toast('پرداخت را از دکمه همان صورتحساب در داشبورد باز کنید', true); return; }
  let selectedUnit = isAdmin ? (targetUnitNo || 1) : S.me.unit_no;
  let accountOptions = [];
  let selectedAccountId = targetAccountId || null;
  let selectedAccount = null;

  const fetchDebts = async (unitNo) => {
    if (isAdmin) {
      accountOptions = await T('app_get_unit_account_debts_for_admin', { p_unit_no: unitNo, p_today_ym: S.y * 100 + S.m });
      selectedAccount = selectedAccountId
        ? (accountOptions.find(a => a.account_id === selectedAccountId) || null)
        : (accountOptions[0] || null);
      selectedAccountId = selectedAccount?.account_id || null;
      return selectedAccount?.debts || [];
    } else {
      return await T('app_get_user_debts', { p_today_ym: S.y * 100 + S.m });
    }
  };

  let debts = await fetchDebts(selectedUnit);

  const unitSelectHtml = '';
  const accountSelectHtml = '';

  const m = modal(`
    <h2>ثبت پرداخت</h2>
    <p class="sub">${isAdmin ? 'برای هر واحدی که بخواهید می‌توانید پرداخت ثبت کنید.' : 'نحوه پرداخت خود را انتخاب کنید.'}</p>
    
    ${unitSelectHtml}
    ${accountSelectHtml}

    <div style="display:flex; gap:8px; margin-bottom:20px;">
      <button type="button" class="btn sf" id="tab-debts" style="flex:1;">پرداخت بر اساس بدهی</button>
      ${isAdmin ? '' : '<button type="button" class="btn lt" id="tab-custom" style="flex:1;">پرداخت مبلغ دلخواه</button>'}
    </div>

    <div id="sec-debts"></div>
    <div id="sec-custom" class="hidden">
      <div class="card" style="margin-bottom:16px; padding:16px; background:var(--bg)">
        <p style="margin:0; font-size:13px; color:var(--muted); text-align:center;">سیستم به صورت خودکار مبلغ شما را از قدیمی‌ترین بدهی کسر می‌کند.</p>
      </div>
    </div>

    <div id="pf-error" class="hidden" role="alert" style="margin:0 0 14px;padding:12px 14px;border:1px solid #e0a1a1;border-radius:12px;background:#fff0f0;color:#a11;font-size:13px;line-height:1.9;font-weight:700"></div>
    <form id="pf" class="grid g2">
      <label class="f" style="grid-column:1/-1">مبلغ کل (تومان)<input id="pf-a" inputmode="numeric" readonly style="background:var(--bg);font-weight:900;font-size:20px;text-align:center;color:var(--navy)"></label>
      <label class="f hidden" id="wrap-custom-amount" style="grid-column:1/-1; margin-top:8px;">مبلغ دلخواه خود را وارد کنید
        <input id="pf-custom" inputmode="numeric" placeholder="مثلاً 5,000,000" style="font-weight:900;font-size:20px;text-align:center;">
      </label>
      <label class="f">کد پیگیری<input id="pf-r" dir="ltr"></label>
      ${jalaliDatePicker('تاریخ واریز','',TODAY.y+'/'+String(TODAY.m).padStart(2,'0')+'/'+String(TODAY.d).padStart(2,'0'),'pf-d',false)}
      <label class="f" style="grid-column:1/-1">بارگذاری تصویر فیش (اختیاری)<input id="pf-img" type="file" accept="image/*"></label>
      <label class="f" style="grid-column:1/-1">توضیحات<input id="pf-n"></label>
      <button class="btn sf" style="grid-column:1/-1" id="pf-submit">ثبت پرداخت</button>
    </form>
  `);

  let currentTab = 'debts';

  const renderDebts = (debtList) => {
    const container = $('#sec-debts', m);
    if (debtList && debtList.length > 0) {
      const grossTotal = debtList.reduce((n,d)=>n+(Number(d.original_amount ?? d.amount)||0),0);
      const creditTotal = debtList.reduce((n,d)=>n+(Number(d.credit_applied)||0),0);
      const payableTotal = debtList.reduce((n,d)=>n+(Number(d.amount)||0),0);
      container.innerHTML = `
        <div class="card" style="margin-bottom:16px; padding:14px; background:var(--bg)">
          <h3 style="margin:0 0 10px 0; font-size:14px; color:var(--ink)">خلاصه صورتحساب</h3>
          <div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0"><span>جمع مبالغ اصلی بدهی</span><b id="pf-gross-summary">${fmt(grossTotal)} تومان</b></div>
          <div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;color:#15803d"><span>بستانکاری کسرشده</span><b id="pf-credit-summary">${fmt(creditTotal)} تومان</b></div>
          <div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0 0;border-top:1px solid var(--line);font-size:16px"><b>مبلغ قابل پرداخت</b><b id="pf-payable-summary" style="color:var(--navy)">${fmt(payableTotal)} تومان</b></div>
        </div>
        <div class="card" style="margin-bottom:16px; padding:12px; background:var(--bg)">
          <h3 style="margin:0 0 10px 0; font-size:14px; color:var(--ink)">جزئیات بدهی‌ها و بستانکاری:</h3>
          ${debtList.map((d) => `
            <div class="debt-row" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 0; border-bottom:1px dashed var(--line)">
              <input type="checkbox" class="debt-check" value="${d.ym}" data-category="${d.category}" data-original="${d.amount}" data-gross="${d.original_amount ?? d.amount}" data-credit="${d.credit_applied || 0}" checked style="width:18px;height:18px;accent-color:var(--navy)">
              <span style="flex:1; min-width:130px; font-weight:bold">${d.category_name} ${d.month_name} ${fa(d.year)}</span>
              <input type="text" class="debt-amount" value="${fmt(d.amount)}" style="width:120px; text-align:left; direction:rtl; padding:6px 10px; min-height:36px; font-weight:bold;">
              <div style="width:100%;padding-right:28px;font-size:12px;color:var(--muted)">
                مبلغ اصلی: ${fmt(d.original_amount ?? d.amount)} تومان
                · بستانکاری کسرشده: <span style="color:#15803d;font-weight:700">${fmt(d.credit_applied||0)} تومان</span>
                · مانده: <b>${fmt(d.amount)} تومان</b>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      bindDebtEvents();
    } else {
      container.innerHTML = `<div class="card" style="background:#e3f6ea;color:#15803d;margin-bottom:16px;padding:16px;text-align:center;font-weight:bold;">این واحد هیچ بدهی معوقی ندارد. ✅</div>`;
    }
    updateTotalDebts();
  };

  const bindDebtEvents = () => {
    $('.debt-amount', m).forEach(inp => {
      // هنگام تایپ مقدار را قالب‌بندی نکن؛ این کار مکان‌نما را جابه‌جا می‌کند
      // و در موبایل ویرایش عدد را دشوار یا غیرممکن می‌سازد.
      inp.setAttribute('inputmode', 'numeric');
      inp.setAttribute('autocomplete', 'off');
      inp.addEventListener('input', () => {
        updateTotalDebts();
      });
      inp.addEventListener('blur', e => {
        const n = toNum(e.target.value);
        e.target.value = n > 0 ? fmt(n) : '';
        updateTotalDebts();
      });
    });

    $$('.debt-check', m).forEach(cb => cb.addEventListener('change', (e) => {
      const row = e.target.closest('.debt-row');
      const amtInp = $('.debt-amount', row);
      if (e.target.checked) amtInp.value = fmt(cb.dataset.original);
      else amtInp.value = '0';
      updateTotalDebts();
    }));
  };

  const updateTotalDebts = () => {
    if (currentTab !== 'debts') return;
    let total = 0, gross = 0, credit = 0;
    $$('.debt-row', m).forEach(row => {
      const cb = $('.debt-check', row);
      const amtInp = $('.debt-amount', row);
      if (cb.checked) {
        total += toNum(amtInp.value);
        gross += Number(cb.dataset.gross || cb.dataset.original || 0);
        credit += Number(cb.dataset.credit || 0);
      }
    });
    $('#pf-a', m).value = fmt(total);
    const g=$('#pf-gross-summary',m),c=$('#pf-credit-summary',m),p=$('#pf-payable-summary',m);
    if(g)g.textContent=fmt(gross)+' تومان';
    if(c)c.textContent=fmt(credit)+' تومان';
    if(p)p.textContent=fmt(total)+' تومان';
  };

  renderDebts(debts);

  $('#tab-debts', m).addEventListener('click', () => {
    currentTab = 'debts';
    $('#tab-debts', m).className = 'btn sf'; $('#tab-debts', m).style.flex = '1';
    if (!isAdmin) { $('#tab-custom', m).className = 'btn lt'; $('#tab-custom', m).style.flex = '1'; }
    $('#sec-debts', m).classList.remove('hidden');
    $('#sec-custom', m).classList.add('hidden');
    $('#wrap-custom-amount', m).classList.add('hidden');
    updateTotalDebts();
  });

  if (!isAdmin) $('#tab-custom', m).addEventListener('click', () => {
    currentTab = 'custom';
    $('#tab-custom', m).className = 'btn sf'; $('#tab-custom', m).style.flex = '1';
    $('#tab-debts', m).className = 'btn lt'; $('#tab-debts', m).style.flex = '1';
    $('#sec-custom', m).classList.remove('hidden');
    $('#sec-debts', m).classList.add('hidden');
    $('#wrap-custom-amount', m).classList.remove('hidden');
    $('#pf-a', m).value = '0';
  });

  const customAmountInput = $('#pf-custom', m);
  customAmountInput.setAttribute('inputmode', 'numeric');
  customAmountInput.setAttribute('autocomplete', 'off');
  customAmountInput.addEventListener('input', e => {
    // مقدار خام حین تایپ حفظ می‌شود تا مکان‌نمای صفحه‌کلید نپرد.
    $('#pf-a', m).value = fmt(toNum(e.target.value));
  });
  customAmountInput.addEventListener('blur', e => {
    const n = toNum(e.target.value);
    e.target.value = n > 0 ? fmt(n) : '';
    $('#pf-a', m).value = fmt(n);
  });



  $('#pf', m).addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = $('#pf-submit', m);
    const errorBox = $('#pf-error', m);
    errorBox.classList.add('hidden');
    errorBox.textContent = '';
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'در حال بررسی و ارسال...';
    try {
      const fileInput = $('#pf-img', m);
      let base64Image = null;
      if (fileInput.files.length > 0) base64Image = await compressImage(fileInput.files[0]);
      const totalAmount = toNum($('#pf-a', m).value);
      if (totalAmount <= 0) throw new Error('مبلغ باید بیشتر از صفر باشد');

      if (currentTab === 'debts') {
        const selectedDebts = [];
        $$('.debt-row', m).forEach(row => {
          const cb = $('.debt-check', row);
          const amtInp = $('.debt-amount', row);
          const amount = toNum(amtInp.value);
          if (cb.checked && amount > 0) selectedDebts.push({ ym: cb.value, category: cb.dataset.category, amount });
        });
        if (selectedDebts.length === 0) throw new Error('لطفاً حداقل یک بدهی را انتخاب کنید');

        for (const debt of selectedDebts) {
          const year = Math.floor(debt.ym / 100);
          const month = debt.ym % 100;
          if (isAdmin) {
            await T('app_admin_submit_account_payment', {
              p_account_id: selectedAccountId, p_year: year, p_month: month, p_category: debt.category, p_amount: debt.amount,
              p_ref_code: $('#pf-r', m).value, p_note: `پرداخت ${debt.category} ${MONTHS[month - 1]} ${year}`,
              p_pay_date: $('#pf-d', m).value, p_receipt_image: base64Image
            });
          } else {
            await T('app_submit_payment', {
              p_year: year, p_month: month, p_category: debt.category, p_amount: debt.amount,
              p_ref_code: $('#pf-r', m).value, p_note: `پرداخت ${debt.category} ${MONTHS[month - 1]} ${year}`,
              p_pay_date: $('#pf-d', m).value, p_receipt_image: base64Image, p_target_unit: null
            });
          }
        }
        notifyBale(`💸 پرداخت جدید (بر اساس بدهی):\n\n👤 واحد ${selectedUnit} - ${isAdmin ? (selectedAccount?.full_name || selectedAccount?.occupancy || '') : S.me.full_name}\n💰 مبلغ: ${fmt(totalAmount)} تومان`);
      } else {
        const res = await T('app_process_payment_fifo', {
          p_total_amount: totalAmount, p_pay_date: $('#pf-d', m).value, p_ref_code: $('#pf-r', m).value,
          p_note: $('#pf-n', m).value, p_receipt_image: base64Image,
          p_target_unit: isAdmin ? selectedUnit : null
        });
        if (!res.ok) throw new Error(res.error);
        notifyBale(`💸 پرداخت جدید (مبلغ دلخواه):\n\n👤 واحد ${selectedUnit} - ${S.me.full_name}\n💰 مبلغ: ${fmt(totalAmount)} تومان`);
      }
      if (!isAdmin) await sendMobilePush('payment_request_created', 'پرداخت جدید از واحد ' + selectedUnit, 'مبلغ ' + fmt(totalAmount) + ' تومان برای بررسی ثبت شد.');
      closeModal(m);
      toast('پرداخت با موفقیت ثبت شد و منتظر تایید است');
      go(S.view);
    } catch (err) {
      const raw = String(err?.message || '');
      const normalized = raw.toLowerCase();
      const overBalance = /مبلغ پرداخت از مانده بدهی این هزینه بیشتر است/.test(raw);
      const duplicatePending = /در انتظار بررسی|در انتظار تایید|trg_prevent_duplicate_pending_payment|payment_requests_one_pending_per_account_period_category_uidx/i.test(raw);
      errorBox.textContent = overBalance
        ? 'مبلغ واردشده از مانده بدهی این هزینه بیشتر است. مبلغ را حداکثر تا سقف مانده بدهی وارد کنید.'
        : (duplicatePending
          ? 'برای این مورد یک درخواست پرداخت قبلاً ثبت شده و هنوز در حال بررسی است. تا زمانی که مدیر آن را تأیید یا رد نکند، امکان ثبت درخواست تکراری وجود ندارد.'
          : (raw === 'NETWORK_ERROR' ? 'ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی و دوباره تلاش کنید.' : (raw || 'ثبت درخواست پرداخت ناموفق بود.')));
      errorBox.classList.remove('hidden');
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ثبت پرداخت';
    }
  });
}
  async function viewPay(el) {
  markAlertPrefixSeen('payment:');
  const admin = S.me.is_admin; const list = await T('app_get_payment_requests'); const pending = list.filter(p => p.status === 'pending');
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;gap:12px;flex-wrap:wrap"><div><h1>${admin ? 'بررسی پرداخت‌ها' : 'پرداخت بدهی'}</h1><p class="sub" style="margin:0">${admin ? 'پرداخت‌های منتظر تایید شما' : 'پرداخت خود را ثبت کنید.'}</p></div>${admin ? '' : '<button class="btn sf" id="np">ثبت پرداخت جدید</button>'}</div>${admin ? `<h2>منتظر تایید (${fa(pending.length)})</h2>${reqTable(pending, true)}<h2 style="margin-top:28px">سابقه</h2>${reqTable(list.filter(p => p.status !== 'pending'), true)}` : reqTable(list, false)}`;
  $('#np')?.addEventListener('click', async () => { const rep = await T('app_report', { p_year: S.y, p_month: S.m }); const r = rep.rows[0]; payModal(r); });
  $$('[data-ap]').forEach(b => b.addEventListener('click', () => approveModal(list.find(p => p.id == b.dataset.ap))));
}

function approveModal(p) {
  const m = modal(`<h2>تایید پرداخت واحد ${fa(p.unit_no)}</h2><p class="sub">${esc(p.full_name || '')} · بابت ${esc(CATS[p.category] || p.category)} · ${MONTHS[p.month-1]} ${fa(p.year)}</p>${p.receipt_image ? `<div style="margin-bottom:16px;text-align:center"><img src="${esc(p.receipt_image)}" style="max-width:100%;max-height:300px;border-radius:12px;border:1px solid var(--line)"></div>` : `<div class="card" style="background:var(--bg);margin-bottom:16px;text-align:center;color:var(--muted)">تصویری بارگذاری نشده است</div>`}<div class="grid g2"><label class="f">مبلغ تاییدی (تومان)<input id="ap-a" value="${fmt(p.amount)}" inputmode="numeric"></label><label class="f">یادداشت<input id="ap-n"></label></div><div style="margin-top:20px;display:flex;gap:10px"><button class="btn" id="ap-go" style="flex:1">تایید و ثبت</button><button class="btn rd" id="ap-rj">رد کردن</button></div>`);
  attachNumericInputIn(m, '#ap-a');
  $('#ap-rj', m).addEventListener('click', async () => { const note = prompt('دلیل رد:') ?? null; if (note === null) return; try { await T('app_admin_review_payment', { p_id: p.id, p_approve: false, p_admin_note: note }); await sendMobilePush('payment_reviewed', 'نتیجه بررسی پرداخت', 'پرداخت شما رد شد. ' + note, p.account_id); closeModal(m); toast('رد شد'); go('pay'); } catch (e) { showErr(e); } });
  $('#ap-go', m).addEventListener('click', async () => {
    try {
      const approvedAmount = toNum($('#ap-a', m).value);
      if (approvedAmount <= 0 || approvedAmount > Number(p.amount)) {
        toast('مبلغ تأییدشده باید بیشتر از صفر و حداکثر برابر مبلغ درخواست‌شده باشد', true);
        return;
      }
      await T('app_admin_review_payment', { p_id: p.id, p_approve: true, p_amount: approvedAmount, p_admin_note: $('#ap-n', m).value });
      notifyBale(`✅ پرداخت تایید شد:\n\n👤 واحد ${p.unit_no} - ${p.full_name}\n💰 مبلغ: ${fmt(approvedAmount)} تومان\n📅 بابت: ${CATS[p.category] || p.category} - ${MONTHS[p.month-1]} ${p.year}`);
      await sendMobilePush('payment_reviewed', 'پرداخت شما تایید شد', 'پرداخت ' + fmt(p.amount) + ' تومان تایید شد.', p.account_id);
      closeModal(m); toast('تایید شد'); go('pay');
    } catch (e) { showErr(e); }
  });
}

async function viewTx(el) {
  const admin = S.me.is_admin; if (!S.txFilter) S.txFilter = { y: String(S.y), m: '', unit: '', type: '' }; const f = S.txFilter;
  const unitParam = admin && f.unit !== '' ? +f.unit : null;
  const list = await T('app_get_transactions', { p_year: f.y ? +f.y : null, p_month: f.m ? +f.m : null, p_unit: unitParam });
  const rows = list.filter(t => !f.type || t.tx_type === f.type);
  const inc = rows.filter(t => t.tx_type === 'درآمد').reduce((s, t) => s + t.amount, 0); const exp = rows.filter(t => t.tx_type === 'هزینه').reduce((s, t) => s + t.amount, 0);
  const units = admin ? await T('app_get_units') : [];
  const residencyIssues = admin ? (units.length ? units.filter(u=>u.residency_issue) : [{unit_no:null,residency_issue:'هنوز واحدی برای ساختمان ثبت نشده است'}]) : [];
  const phoneOf = u => { const un = units.find(x => x.unit_no === u); const a = un?.accounts.find(a => a.is_primary && a.is_active) || un?.accounts[0]; return a?.phone; };
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;gap:12px;flex-wrap:wrap"><div><h1>تراکنش‌ها</h1><p class="sub" style="margin:0">درآمد ${fmt(inc)} · هزینه ${fmt(exp)} · ${fa(rows.length)} ردیف</p></div><div style="display:flex;gap:10px;flex-wrap:wrap">${admin && !residencyIssues.length ? '<button class="btn sf" id="tx-charge">ثبت شارژ</button><button class="btn lt" id="tx-new">ثبت تراکنش</button>' : ''}<button class="btn lt" id="tx-csv">خروجی اکسل</button></div></div>${admin && residencyIssues.length ? `<div class="card" style="margin:-8px 0 16px;border-color:var(--danger);background:var(--bg)"><b style="color:var(--danger)">ثبت تمام تراکنش‌های مالی این ساختمان مسدود است.</b><p class="sub" style="margin:8px 0 0">ابتدا در بخش «مدیریت واحدها» وضعیت سکونت این واحدها را مشخص و تأیید کنید: ${residencyIssues.map(u=>(u.unit_no?'واحد '+fa(u.unit_no)+' ':'')+'('+esc(u.residency_issue)+')').join('، ')}</p></div>` : ''}<div class="card no-print" style="margin-bottom:16px;padding:14px;display:flex;gap:8px;flex-wrap:wrap"><label class="f" style="width:110px">سال<select id="f-y"><option value="">همه</option>${yearOptions(f.y)}</select></label><label class="f" style="width:130px">ماه<select id="f-m">${monthOptions(f.m, true)}</select></label>${admin ? `<label class="f" style="width:130px">واحد<select id="f-u">${unitOptions(f.unit, true, true)}</select></label>` : ''}<label class="f" style="width:110px">نوع<select id="f-t"><option value="">همه</option><option value="درآمد" ${f.type === 'درآمد' ? 'selected' : ''}>درآمد</option><option value="هزینه" ${f.type === 'هزینه' ? 'selected' : ''}>هزینه</option><option value="بازپرداخت" ${f.type === 'بازپرداخت' ? 'selected' : ''}>بازپرداخت</option></select></label></div><div class="tbl-wrap"><table><thead><tr><th>تاریخ</th><th>واحد</th><th>نوع</th><th>محل</th><th>شرح</th><th>مبلغ</th><th>سکونت</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>${rows.map(t => `<tr><td class="num">${fa(t.tx_date)}</td><td>${t.unit_no ? 'واحد ' + fa(t.unit_no) : '<b>ساختمان</b>'}</td><td>${t.tx_type === 'درآمد' ? '<span class="chip ok">درآمد</span>' : t.tx_type === 'بازپرداخت' ? '<span class="chip ex">بازپرداخت</span>' : '<span class="chip no">هزینه</span>'}${t.source === 'payment' ? ' <span class="chip pd">پرداخت</span>' : ''}</td><td>${esc(t.location || '—')}</td><td>${esc(t.description || '—')}</td><td>${money(t.amount)}</td><td class="muted">${esc(t.occupancy || '—')}</td>${admin ? `<td><div style="display:flex;gap:6px;flex-wrap:nowrap">${t.unit_no ? smsBtn(phoneOf(t.unit_no), `${S.building} - واحد ${t.unit_no}\n${t.tx_type === 'درآمد' ? 'دریافت' : 'ثبت'} ${fmt(t.amount)} تومان بابت ${t.description} ثبت شد.`) : ''}<button class="btn lt sm" data-edit="${t.id}">ویرایش</button><button class="btn rd sm" data-dl="${t.id}">حذف</button></div></td>` : ''}</tr>`).join('') || `<tr><td colspan="${admin?8:7}" class="muted" style="text-align:center">تراکنشی نیست</td></tr>`}</tbody></table></div>`;
  $$('[data-edit], [data-dl]', el).forEach(b => { const tx = rows.find(t => String(t.id) === b.dataset.edit || String(t.id) === b.dataset.dl); if (tx?.source === 'account_exit_refund') b.remove(); });
  const upd = debounce(() => { f.y = $('#f-y')?.value ?? ''; f.m = $('#f-m')?.value ?? ''; f.unit = $('#f-u')?.value ?? ''; f.type = $('#f-t')?.value ?? ''; go('tx'); }, 300);
  ['#f-y', '#f-m', '#f-u', '#f-t'].forEach(s => $(s)?.addEventListener('change', upd));
  $('#tx-csv')?.addEventListener('click', () => exportCsv(rows)); if (!admin) return;
  $('#tx-charge')?.addEventListener('click', () => go('charge')); $('#tx-new')?.addEventListener('click', () => txModal(null, units));
    // دکمه ویرایش تراکنش
  $$('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const tx = rows.find(t => t.id == b.dataset.edit);
    if (tx) txModal(tx, units);
  }));
  $$('[data-dl]').forEach(b => b.addEventListener('click', async () => { if (!confirm('حذف شود؟')) return; try { await T('app_admin_delete_transaction', { p_id: +b.dataset.dl }); toast('حذف شد'); go('tx'); } catch (e) { showErr(e); } }));
}

function txModal(t, units) {
  const isNew = !t;
  t = t || { year: TODAY.y, month: TODAY.m, day: TODAY.d, unit_no: null, tx_type: 'درآمد', category: 'repair', location: '', description: '', amount: '', occupancy: '' };

  const INCOME_CATS = [
    ['repair','دریافت هزینه تعمیرات و بازسازی'],
    ['other','سایر درآمدها']
  ];
  const EXPENSE_CATS = [
    ['water','قبض آب'], ['gas','قبض گاز'], ['electric_bill','قبض برق'], ['waste','قبض پسماند'], ['other_bill','سایر قبوض'], ['cleaning','نظافت'],
    ['service','سرویس آسانسور'], ['building_repair','هزینه بازسازی'],
    ['fixed_cost','هزینه‌های ثابت'], ['repair_pay','هزینه تعمیرات'],
    ['payment','پرداخت‌ها'], ['other','سایر (هزینه)']
  ];
  const categoryLabel = (type, category) =>
    (type === 'درآمد' ? INCOME_CATS : EXPENSE_CATS).find(x => x[0] === category)?.[1] || category;
  const savedPayers = Array.isArray(t.payer_occupancies) ? t.payer_occupancies : ['مالک ساکن','مستأجر'];
  const savedExcluded = Array.isArray(t.excluded_units) ? t.excluded_units.map(Number) : [];
  const savedKind = t.expense_kind || 'nonshared';
  const savedMethod = t.allocation_method || 'equal';

  const m = modal(`
    <h2>${isNew ? 'ثبت تراکنش جدید' : 'ویرایش تراکنش'}</h2>
    <form id="tf" class="grid g2" style="gap:16px">
      <label class="f">نوع
        <select id="t-type">
          <option value="درآمد" ${t.tx_type === 'درآمد' ? 'selected' : ''}>درآمد (دریافت)</option>
          <option value="هزینه" ${t.tx_type === 'هزینه' ? 'selected' : ''}>هزینه (پرداخت)</option>
        </select>
      </label>
      <label class="f" id="wrap-unit"><span id="unit-label">واحد</span>
        <select id="t-unit">${unitOptions(t.unit_no ?? 0, true)}</select>
      </label>
      <label class="f" id="wrap-payer">پرداخت‌کننده
        <select id="t-occ">
          <option value="">-- انتخاب کنید --</option>
          <option value="مالک ساکن" ${t.occupancy === 'مالک ساکن' ? 'selected' : ''}>مالک ساکن</option>
          <option value="مالک" ${t.occupancy === 'مالک' ? 'selected' : ''}>مالک</option>
          <option value="مستأجر" ${t.occupancy === 'مستأجر' ? 'selected' : ''}>مستأجر</option>
        </select>
      </label>
      <label class="f">محل (اختیاری)
        <input id="t-loc" value="${esc(t.location || '')}" placeholder="مثلاً بلوک A">
      </label>
      <label class="f" style="grid-column:1/-1">شرح / دسته‌بندی
        <select id="t-cat"></select>
      </label>
      <section id="expense-fields" class="card" style="grid-column:1/-1;padding:16px;display:none">
        <h2 style="margin:0 0 12px">جزئیات تقسیم هزینه</h2>
        <div style="display:flex;gap:18px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:8px;font-weight:700"><input type="radio" name="expense-kind" value="shared" ${savedKind === 'shared' ? 'checked' : ''} style="width:auto;min-height:0"> تسهیمی</label>
          <label style="display:flex;align-items:center;gap:8px;font-weight:700"><input type="radio" name="expense-kind" value="nonshared" ${savedKind === 'nonshared' ? 'checked' : ''} style="width:auto;min-height:0"> غیرتسهیمی</label>
        </div>
        <div id="expense-fund-note" class="sub" style="margin:10px 0 0;display:none">این هزینه به‌عنوان هزینه ساختمان ثبت می‌شود و از صندوق ساختمان پرداخت خواهد شد.</div>
        <div id="expense-method-wrap" style="margin-top:16px">
          <label class="f">روش تسهیم
            <select id="expense-method">
              <option value="equal" ${savedMethod === 'equal' ? 'selected' : ''}>مساوی بین واحدهای مشمول</option>
              <option value="persons" ${savedMethod === 'persons' ? 'selected' : ''}>بر اساس تعداد نفرات</option>
              <option value="area" ${savedMethod === 'area' ? 'selected' : ''}>بر اساس متراژ واحدها</option>
            </select>
         </label>
        </div>
        <div style="margin-top:16px">
          <div style="font-weight:900;margin-bottom:8px">مسئول پرداخت</div>
          <div style="display:grid;gap:10px">
            <label style="display:flex;align-items:center;gap:8px"><input type="radio" name="expense-payer" value="resident_tenant" ${(savedPayers.includes('مالک ساکن') && savedPayers.includes('مستأجر')) ? 'checked' : ''} style="width:auto;min-height:0"> مالک ساکن + مستأجر</label>
            <label style="display:flex;align-items:center;gap:8px"><input type="radio" name="expense-payer" value="resident_owner" ${(savedPayers.includes('مالک ساکن') && savedPayers.includes('مالک')) ? 'checked' : ''} style="width:auto;min-height:0"> مالک ساکن + مالک</label>
         </div>
        </div>
        <div id="expense-exclusions" style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px">
          <div style="font-weight:900;margin-bottom:4px">استثنا از پرداخت</div>
          <p class="sub" style="margin:0 0 10px">واحدهای انتخاب‌شده در تقسیم این هزینه شرکت نمی‌کنند.</p>
          <div class="grid g2" style="gap:8px">
            ${Array.from({length:(S.unitCount || 10)},(_,i)=>`<label style="display:flex;align-items:center;gap:8px"><input class="expense-excluded-unit" type="checkbox" value="${i+1}" ${savedExcluded.includes(i+1) ? 'checked' : ''} style="width:auto;min-height:0"> واحد ${fa(i+1)}</label>`).join('')}
         </div>
      </section>
      <label class="f" style="grid-column:1/-1">توضیحات
        <input id="t-desc" value="${esc(t.description || '')}" placeholder="توضیح جزئیات...">
      </label>
      <label class="f" style="grid-column:1/-1">مبلغ (تومان)
        <input id="t-amt" inputmode="numeric" required value="${t.amount ? fmt(t.amount) : ''}">
      </label>
      ${jalaliDatePicker('تاریخ تراکنش','',String(t.year||TODAY.y)+'/'+String(t.month||TODAY.m).padStart(2,'0')+'/'+String(t.day||TODAY.d).padStart(2,'0'),'tx-date',true)}
      <section id="bill-period-fields" class="card" style="grid-column:1/-1;display:none;padding:12px">
        <div style="font-weight:900;margin-bottom:8px">دوره مصرف قبض (شمسی)</div>
        <div class="grid g2">${jalaliDatePicker('از تاریخ','',t.bill_period_start ? gregorianToJalaliDate(t.bill_period_start) : '', 'bill-period-start',false)}
        ${jalaliDatePicker('تا تاریخ','',t.bill_period_end ? gregorianToJalaliDate(t.bill_period_end) : '', 'bill-period-end',false)}</div>
        <p class="sub" style="margin:6px 0 0">سهم هر ساکن بر اساس روزهای حضور در این بازه محاسبه می‌شود.</p>
      </section>
      <div style="grid-column:1/-1;margin-top:8px">
        <button class="btn sf" type="submit" style="width:100%">${isNew ? 'ثبت تراکنش' : 'ذخیره تغییرات'}</button>
      </div>
    </form>
  `);

  attachNumericInputIn(m, '#t-amt');
  const typeSelect = $('#t-type',m), payerWrap = $('#wrap-payer',m);
  const expenseFields = $('#expense-fields',m), unitSelect = $('#t-unit',m);
  const categorySelect = $('#t-cat',m);
  let renderedCategoryType = null;
  const updateFormUI = () => {
    const income = typeSelect.value === 'درآمد';
    const categoryType = income ? 'درآمد' : 'هزینه';
    const categoryOptions = income ? INCOME_CATS : EXPENSE_CATS;
    const currentCategory = categorySelect.value || t.category;
    const validCategory = categoryOptions.some(([value]) => value === currentCategory);
    if (renderedCategoryType !== categoryType || !validCategory) {
      const selectedCategory = validCategory ? currentCategory : (income ? 'repair' : 'cleaning');
      categorySelect.innerHTML = categoryOptions.map(([value,label]) =>
        '<option value="' + value + '">' + label + '</option>'
      ).join('');
      categorySelect.value = selectedCategory;
      renderedCategoryType = categoryType;
    }
    payerWrap.style.display = income ? 'flex' : 'none';
    expenseFields.style.display = income ? 'none' : 'block';
    $('#unit-label',m).textContent = income ? 'واحد' : 'پرداخت‌کننده هزینه';
    if (!income) {
      $('#t-occ',m).value = '';
    }
    const building = +unitSelect.value === 0;
    const kind = $('input[name="expense-kind"]:checked',m)?.value || 'shared';
    $('#expense-method-wrap',m).style.display = kind === 'shared' ? 'block' : 'none';
    $('#expense-exclusions',m).style.display = building && kind === 'shared' ? 'block' : 'none';
    $('#expense-fund-note',m).style.display = building && kind === 'nonshared' ? 'block' : 'none';
  };
  const updateBillPeriodUI=()=>{const bill=['water','gas','electric_bill','waste','other_bill'].includes(categorySelect.value);$('#bill-period-fields',m).style.display=!typeSelect.value.includes('درآمد')&&bill?'block':'none';};
  categorySelect.addEventListener('change',updateBillPeriodUI);
  typeSelect.addEventListener('change',()=>{updateFormUI();updateBillPeriodUI();});
  unitSelect.addEventListener('change',()=>{updateFormUI();updateBillPeriodUI();});
  $$('input[name="expense-kind"]',m).forEach(x=>x.addEventListener('change',updateFormUI));
  updateFormUI();updateBillPeriodUI();
  $('#tf',m).addEventListener('submit',async e=>{
    e.preventDefault();
    const txType=$('#t-type',m).value;
    const unitNo=+$('#t-unit',m).value||null;
    const amount=toNum($('#t-amt',m).value);
    const desc=$('#t-desc',m).value;
    const category=$('#t-cat',m).value;
    if(!amount){toast('مبلغ را وارد کنید',true);return;}
    try{
      if(txType==='درآمد'){
        await T('app_admin_save_transaction',{
          p_id:isNew?null:t.id,
          p_year:Number($('#tx-date',m).value.split('/')[0]),p_month:Number($('#tx-date',m).value.split('/')[1]),p_day:Number($('#tx-date',m).value.split('/')[2]),
          p_unit_no:unitNo,p_tx_type:txType,p_category:category,p_location:$('#t-loc',m).value,
          p_description:desc,p_amount:amount,p_occupancy:$('#t-occ',m).value,p_force:false
        });
      }else{
        const kind=$('input[name="expense-kind"]:checked',m)?.value;
        const payer=$('input[name="expense-payer"]:checked',m)?.value;
        if(!kind){toast('نوع هزینه را انتخاب کنید',true);return;}
        if(!payer){toast('مسئول پرداخت را انتخاب کنید',true);return;}
        const payers=payer==='resident_tenant'?['مالک ساکن','مستأجر']:['مالک ساکن','مالک'];
        const excluded=$$('.expense-excluded-unit:checked',m).map(x=>+x.value);
        const method=$('#expense-method',m).value;
        const isBill=['water','gas','electric_bill','waste','other_bill'].includes(category)&&!unitNo;
        let billStart=null,billEnd=null;
        if(isBill){billStart=jalaliToGregorianDate($('#bill-period-start',m).value);billEnd=jalaliToGregorianDate($('#bill-period-end',m).value);if(billEnd<billStart)throw new Error('تاریخ پایان دوره قبض نباید قبل از شروع باشد');}
        const saved=await T('app_admin_save_expense',{
          p_id:isNew?null:t.id,
          p_year:Number($('#tx-date',m).value.split('/')[0]),p_month:Number($('#tx-date',m).value.split('/')[1]),p_day:Number($('#tx-date',m).value.split('/')[2]),
          p_unit_no:unitNo,p_category:category,p_location:$('#t-loc',m).value,
          p_description:desc,p_amount:amount,
          p_expense_scope:unitNo?'unit':'building',
          p_expense_kind:kind,
          p_allocation_method:kind==='shared'?method:null,
          p_payer_occupancies:payers,
          p_excluded_units:unitNo||kind!=='shared'?[]:excluded,
          p_bill_period_start:billStart,p_bill_period_end:billEnd
        });
        if(saved?.ok==false) throw new Error(saved.error||'ثبت هزینه ناموفق بود');
      }
      notifyBale(`${isNew?'📝 تراکنش جدید':'✏️ ویرایش تراکنش'}:\n\n🔹 نوع: ${txType}\n🏢 ${txType==='هزینه'?'پرداخت‌کننده':'واحد'}: ${unitNo?'واحد '+unitNo:'ساختمان'}\n💰 مبلغ: ${fmt(amount)} تومان\n📄 بابت: ${categoryLabel(txType, category)}`);
      closeModal(m);
      toast(isNew?'ثبت شد':'ویرایش شد');
      go('tx');
    }catch(e){showErr(e);}
  });
}
function exportCsv(rows) {
  const sep = ';'; const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['تاریخ', 'سال', 'ماه', 'واحد', 'نوع', 'محل', 'شرح', 'مبلغ', 'نوع سکونت'];
  const lines = [head.map(q).join(sep)].concat(rows.slice().reverse().map(t => [t.tx_date, t.year, t.month_name, t.unit_no ? 'واحد ' + t.unit_no : 'ساختمان', t.tx_type, t.location, t.description, t.amount, t.occupancy].map(q).join(sep)));
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'Transactions.csv'; a.click();
}

async function viewReport(el) {
  if (S.reportMode === 'range') {
    const fromY=Number(S.rangeFromYear||S.y), fromM=Number(S.rangeFromMonth||S.m), toY=Number(S.rangeToYear||S.y), toM=Number(S.rangeToMonth||S.m);
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><h1>گزارش مالی</h1><p class="sub">گزارش ماه‌به‌ماه در بازه انتخابی</p></div><button class="btn lt" id="report-month-mode">بازگشت به گزارش ماهانه</button></div>
      <form id="report-range-form" class="card" style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:18px">
        <label class="f">از ماه<select id="range-from-month">${monthOptions(fromM)}</select></label><label class="f">از سال<select id="range-from-year">${yearOptions(fromY)}</select></label>
        <label class="f">تا ماه<select id="range-to-month">${monthOptions(toM)}</select></label><label class="f">تا سال<select id="range-to-year">${yearOptions(toY)}</select></label>
        <button class="btn sf" type="submit">نمایش گزارش</button></form>
      <div id="range-report-content" class="card" style="overflow-x:auto"><p>ماه و سال شروع و پایان را انتخاب کنید.</p></div>
      <div style="display:flex;gap:8px;margin-top:14px"><button class="btn lt no-print" id="range-print-btn">چاپ</button><button class="btn sf no-print" id="range-bale-btn">ارسال به بله 📤</button></div>`;
    $('#report-month-mode')?.addEventListener('click',()=>{S.reportMode='month';go('report');});
    $('#report-range-form')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const fy=Number($('#range-from-year').value),fm=Number($('#range-from-month').value),ty=Number($('#range-to-year').value),tm=Number($('#range-to-month').value);
      if(fy*100+fm>ty*100+tm){toast('تاریخ شروع نباید بعد از تاریخ پایان باشد',true);return;}
      S.rangeFromYear=fy;S.rangeFromMonth=fm;S.rangeToYear=ty;S.rangeToMonth=tm;
      const content=$('#range-report-content');if(!content)return;content.innerHTML='<p>در حال دریافت گزارش...</p>';
      try {
        const pieces=[];let y=fy,m=fm;
        while(y*100+m<=ty*100+tm){
          const [rep,tx]=await Promise.all([T('app_report',{p_year:y,p_month:m}),T('app_get_transactions',{p_year:y,p_month:m,p_unit:null})]);
          const rows=(rep.rows||[]).map(r=>{
            const shared=(tx||[]).flatMap(t=>{
              if(t.tx_type!=='هزینه'||Number(t.ym)!==y*100+m)return[];
              let a=t.expense_shares;if(typeof a==='string'){try{a=JSON.parse(a)}catch(_){a=[]}}
              if(!Array.isArray(a))return[];const sh=a.find(x=>String(x.account_id||'')===String(r.account_id||''));
              return sh?[{id:t.id,cat:String(t.category||'').toLowerCase(),amount:Number(sh.amount)||0}]:[];
            });
            const items=c=>shared.filter(x=>x.cat===c),sum=a=>a.reduce((n,x)=>n+x.amount,0);
            const status=(base,paid,cat)=>({amount:(Number(base)||0)+sum(items(cat)),paid:(Number(base)<=0||!!paid)&&items(cat).every(x=>(tx||[]).filter(t=>Number(t.ym)===y*100+m&&String(t.account_id||'')===String(r.account_id||'')&&t.tx_type==='درآمد'&&String(t.category||'')==='expense:'+x.id).reduce((n,t)=>n+(Number(t.amount)||0),0)>=x.amount)});
            const c=status(r.charge,r.ok_charge,'charge'),w=status(r.water,r.ok_water,'water'),g=status(r.gas,r.ok_gas,'gas'),p=status(r.repair,r.ok_repair,'repair');
            const cell=(color,val)=>`<td style="background:`+color+`;border-bottom:1px solid #e8ebf2;padding:11px 13px;white-space:nowrap;color:#25304a;font-weight:700">`+fmt(val)+`</td>`;
            const bg=(a,ok)=>Number(a)<=0?'#f1f3f6':(ok?'#e1f3e8':'#fde8e7'),db=Number(r.prev_debt)>0?'#fff1d6':'#f1f3f6',tb=Number(r.remaining)<=0?'#e1f3e8':(Number(r.prev_debt)>0?'#fff1d6':'#f1f3f6');
            return `<tr><td style="border-bottom:1px solid #e8ebf2;padding:10px 12px;background:#fafbfe;color:#303b70;font-weight:900;white-space:nowrap">واحد `+fa(r.unit_no)+`<div style="font-size:11px;font-weight:500;color:#7b849b">`+esc(r.occupancy||'')+`</div></td>`+cell(bg(c.amount,c.paid),c.amount)+cell(bg(w.amount,w.paid),w.amount)+cell(bg(g.amount,g.paid),g.amount)+cell(bg(p.amount,p.paid),p.amount)+cell(db,r.prev_debt)+cell(tb,r.remaining)+`</tr>`;
          }).join('');
          pieces.push(`<section style="margin-bottom:24px;break-inside:avoid"><h2 style="font-size:18px;margin:12px 0">گزارش `+rep.month_name+` `+fa(rep.year)+`</h2><div style="overflow-x:auto"><table style="width:100%;border-collapse:separate;border-spacing:0;text-align:center;direction:rtl;font-size:14px;background:#fff;border:1px solid #e5e9f0;border-radius:12px;overflow:hidden"><thead><tr><th colspan="7" style="background:#303b70;color:white;padding:12px;border:0;font-size:15px">گزارش `+rep.month_name+` ماه - `+fa(rep.year)+`</th></tr><tr>`+['واحد','شارژ','قبض آب','قبض گاز','پس‌انداز','بدهی قبلی','جمع مبلغ قابل پرداخت'].map(x=>`<th style="background:#eef1f8;color:#394366;border:0;border-bottom:1px solid #dfe4ee;padding:10px 8px;font-size:12px">`+x+`</th>`).join('')+`</tr></thead><tbody>`+(rows||'<tr><td colspan="7" style="padding:15px">اطلاعاتی برای این ماه وجود ندارد.</td></tr>')+`</tbody></table></div></section>`);
          m++;if(m>12){m=1;y++;}
        }
        content.innerHTML=pieces.join('');content.dataset.rangeTitle=``+fa(fy)+`/`+fa(String(fm).padStart(2,'0'))+` تا `+fa(ty)+`/`+fa(String(tm).padStart(2,'0'));
      }catch(err){content.innerHTML=`<p style="color:#b91c1c">`+esc(err.message||'خطا در دریافت گزارش')+`</p>`;}
    });
    $('#range-print-btn')?.addEventListener('click',()=>window.print());
    $('#range-bale-btn')?.addEventListener('click',async()=>{const b=$('#range-bale-btn'),c=$('#range-report-content');if(!b||!c)return;const old=b.textContent;b.disabled=true;try{b.textContent='در حال ساخت تصویر...';const canvas=await html2canvas(c,{backgroundColor:'#fff',scale:2,useCORS:true,logging:false});const ok=await notifyBale(`📊 گزارش بازه‌ای `+(c.dataset.rangeTitle||'')+`\n`+(S.me?.building_name||S.building),canvas.toDataURL('image/jpeg',0.88));if(!ok)throw new Error('ارسال گزارش به بله ناموفق بود');toast('گزارش بازه‌ای به گروه بله ارسال شد');}catch(err){showErr(err)}finally{b.textContent=old;b.disabled=false}});
    return;
  }
  const rep=await T('app_report',{p_year:S.y,p_month:S.m});
  const reportTransactions=await T('app_get_transactions',{p_year:S.y,p_month:S.m,p_unit:null});
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:12px;flex-wrap:wrap"><div><h1 style="margin:0">گزارش `+rep.month_name+` `+fa(rep.year)+`</h1></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">`+periodPicker()+`<button class="btn lt" id="report-range-mode">گزارش بازه‌ای</button><button class="btn sf no-print" id="bale-btn">ارسال به بله 📤</button><button class="btn lt no-print" id="pr-btn">چاپ</button></div></div>
  <div class="tbl-wrap report-table-wrap" style="border-radius:16px;overflow-x:auto;border:1px solid #e5e9f0;background:#fff;width:100%;box-shadow:0 5px 18px rgba(35,45,80,.06)"><table style="width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;font-size:14px;font-weight:600;text-align:center;direction:rtl;background:#fff"><thead><tr><th colspan="7" style="background:#303b70;color:white;padding:13px;border:0;font-size:15px">گزارش `+rep.month_name+` ماه - `+fa(rep.year)+`/`+String(rep.month).padStart(2,'0')+`</th></tr><tr>`+['واحد','شارژ','قبض آب','قبض گاز','پس‌انداز','بدهی قبلی','جمع مبلغ قابل پرداخت'].map(x=>`<th style="background:#eef1f8;color:#394366;border:1px solid #cbd3df;padding:8px 6px;font-size:12px">`+x+`</th>`).join('')+`</tr></thead><tbody>`+(rep.rows||[]).map(r=>{
    const shared=(reportTransactions||[]).flatMap(t=>{if(t.tx_type!=='هزینه'||Number(t.ym)!==Number(S.y)*100+Number(S.m))return[];let a=t.expense_shares;if(typeof a==='string'){try{a=JSON.parse(a)}catch(_){a=[]}}if(!Array.isArray(a))return[];const sh=a.find(x=>String(x.account_id||'')===String(r.account_id||''));return sh?[{id:t.id,cat:String(t.category||'').toLowerCase(),amount:Number(sh.amount)||0}]:[]});
    const items=c=>shared.filter(x=>x.cat===c),sum=a=>a.reduce((n,x)=>n+x.amount,0),status=(base,paid,cat)=>({amount:(Number(base)||0)+sum(items(cat)),paid:(Number(base)<=0||!!paid)&&items(cat).every(x=>(reportTransactions||[]).filter(t=>Number(t.ym)===Number(S.y)*100+Number(S.m)&&String(t.account_id||'')===String(r.account_id||'')&&t.tx_type==='درآمد'&&String(t.category||'')==='expense:'+x.id).reduce((n,t)=>n+(Number(t.amount)||0),0)>=x.amount)});
    const c=status(r.charge,r.ok_charge,'charge'),w=status(r.water,r.ok_water,'water'),g=status(r.gas,r.ok_gas,'gas'),p=status(r.repair,r.ok_repair,'repair'),bg=(a,ok)=>Number(a)<=0?'#f1f3f6':(ok?'#e2f3e8':'#fde8e7'),cell=(color,val)=>`<td style="background:`+color+`;border:1px solid #aeb9c8;padding:7px 6px;color:#25304a;font-weight:700;white-space:nowrap">`+fmt(val)+`</td>`;
    return `<tr><td style="background:#f5f6fa;border:1px solid #cbd3df;padding:6px 5px;font-weight:800">واحد `+fa(r.unit_no)+`<div style="font-size:11px;font-weight:normal">`+esc(r.occupancy||'')+`</div></td>`+cell(bg(c.amount,c.paid),c.amount)+cell(bg(w.amount,w.paid),w.amount)+cell(bg(g.amount,g.paid),g.amount)+cell(bg(p.amount,p.paid),p.amount)+cell(Number(r.prev_debt)>0?'#fff0d6':'#f1f3f6',r.prev_debt)+cell(Number(r.remaining)<=0?'#dff3e6':'#fde5e5',r.remaining)+`</tr>`;
  }).join('')||'<tr><td colspan="7">اطلاعاتی برای این دوره وجود ندارد.</td></tr>'`+</tbody></table></div>`;
  bindPeriod(()=>go('report'));
  $('#report-range-mode')?.addEventListener('click',()=>{S.reportMode='range';S.rangeFromYear=S.y;S.rangeFromMonth=S.m;S.rangeToYear=S.y;S.rangeToMonth=S.m;go('report')});
  $('#pr-btn')?.addEventListener('click',()=>{const table=$('.report-table-wrap table');const rows=table?.querySelectorAll('tbody tr').length||1;const estimatedHeight=rows*23+105;const scale=Math.max(.42,Math.min(.82,720/estimatedHeight));document.documentElement.style.setProperty('--report-print-scale',String(scale));window.print();});
  $('#bale-btn')?.addEventListener('click',async()=>{const b=$('#bale-btn'),table=$('.tbl-wrap table');if(!b||!table)return;const old=b.textContent;b.disabled=true;try{b.textContent='در حال ساخت تصویر...';const canvas=await html2canvas(table,{backgroundColor:'#fff',scale:2,useCORS:true,logging:false});const ok=await notifyBale(`📊 گزارش ماهانه `+rep.month_name+` `+fa(rep.year)+`\n`+(S.me?.building_name||S.building),canvas.toDataURL('image/jpeg',0.88));if(!ok)throw new Error('ارسال گزارش به بله ناموفق بود');toast('گزارش با موفقیت به گروه بله ارسال شد')}catch(err){showErr(err)}finally{b.textContent=old;b.disabled=false}});
}

async function viewUnits(el) {
  const units = await T('app_get_units');
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><h1>واحدها</h1><p class="sub">حساب‌های کاربری و تعیین وضعیت سکونت هر واحد</p></div><button class="btn sf" id="add-account-outside-unit">+ افزودن حساب</button></div>${(!units.length || units.some(u=>u.residency_issue)) ? `<div class="card" style="margin:14px 0;border-color:var(--danger);background:var(--bg)"><b style="color:var(--danger)">ثبت تراکنش‌ها تا تعیین تکلیف واحدهای زیر مسدود است.</b><p class="sub" style="margin:8px 0 0">${units.length ? 'تعداد واحدهای نیازمند تعیین تکلیف: '+fa(units.filter(u=>u.residency_issue).length) : 'ابتدا تعداد و مشخصات واحدهای ساختمان را ثبت کنید.'}</p>${units.length ? `<details style="margin-top:8px"><summary style="cursor:pointer;color:var(--accent)">مشاهده فهرست واحدها و علت مشکل</summary><div class="sub" style="margin-top:8px;max-height:220px;overflow:auto">${units.filter(u=>u.residency_issue).map(u=>'<div style="padding:5px 0;border-bottom:1px solid var(--line)">واحد '+fa(u.unit_no)+': '+esc(u.residency_issue)+'</div>').join('')}</div></details>` : ''}</div>` : '<div class="card" style="margin:14px 0;border-color:var(--accent)">وضعیت سکونت همه واحدها تأیید شده است؛ ثبت تراکنش‌ها فعال است.</div>'}<div class="grid g3">${units.map(u => { const activeAccs = u.accounts.filter(a => a.is_active !== false); const owners = activeAccs.filter(a => a.occupancy !== 'مستأجر'); const tenants = activeAccs.filter(a => a.occupancy === 'مستأجر'); const statusLabel = ({owner_occupied:'مالک ساکن',tenant_occupied:'مالک + مستأجر',vacant_confirmed:'واحد خالی',pending:'تعیین‌نشده'})[u.residency_status] || 'تعیین‌نشده'; return `<div class="card"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><h2 style="margin:0">واحد ${fa(u.unit_no)}</h2><button class="btn lt sm" data-u="${u.unit_no}">مدیریت</button></div><div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap"><span class="chip ${u.residency_issue?'no':'ok'}">${statusLabel}</span><span class="chip ex">${activeAccs.length} حساب فعال</span><span class="chip ex">${fa(u.persons || 0)} نفر</span>${u.has_parking ? '<span class="chip pd">پارکینگ</span>' : ''}</div>${owners.length ? `<div style="font-size:13px;margin-top:6px"><b>مالک:</b> ${owners.map(a => esc(a.full_name)).join(' و ')}</div>` : ''}${tenants.length ? `<div style="font-size:13px;margin-top:4px;color:var(--accent)"><b>مستأجر:</b> ${tenants.map(a => esc(a.full_name)).join(' و ')}</div>` : ''}</div>`; }).join('')}</div>`;
  $('#add-account-outside-unit').addEventListener('click', () => addAccountStandalone(units));
  $$('[data-u]').forEach(b => b.addEventListener('click', () => { const u = units.find(x => x.unit_no == b.dataset.u); if (u) unitModal(u); }));
}

function addAccountStandalone(units) {
  const today = jalaliToday();
  const defaultDate = `${today.y}/${String(today.m).padStart(2,'0')}/${String(today.d).padStart(2,'0')}`;
  const m = modal(`<h2>افزودن حساب جدید</h2><p class="sub">اطلاعات این فرم مطابق ضوابط ثبت‌نام کاربران است.</p>
    <form id="manager-add-account-form" class="grid g2">
      <label class="f">واحد<select name="unit_no" required><option value="">انتخاب واحد</option>${units.map(u=>`<option value="${u.unit_no}">واحد ${fa(u.unit_no)}</option>`).join('')}</select></label>
      <label class="f">نوع عضویت<select name="occupancy" required><option value="مالک ساکن">مالک ساکن</option><option value="مالک">مالک غیرساکن</option><option value="مستأجر">مستأجر</option></select></label>
      <label class="f">نام و نام خانوادگی<input name="full_name" required maxlength="150"></label>
      <label class="f">شماره موبایل<input name="phone" dir="ltr" required></label>
      <label class="f">ایمیل (اختیاری)<input name="email" type="email" dir="ltr"></label>
      <label class="f">نام کاربری<input name="username" dir="ltr" required pattern="[A-Za-z][A-Za-z0-9_]{2,31}" minlength="3" maxlength="32"></label>
      <label class="f">رمز اولیه<input name="password" type="password" inputmode="numeric" required pattern="[0-9]{4,8}" minlength="4" maxlength="8" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false"></label>
      <label class="f">متراژ واحد (مترمربع)<input name="area" type="number" min="1" step="0.01" required></label>
      <label class="f" id="manager-add-persons-wrap">تعداد نفرات<input name="persons" type="number" min="1" max="30"></label>
      <div>${jalaliDatePicker('تاریخ شروع','start_date_jalali',defaultDate)}<small class="sub" id="manager-add-date-label">تاریخ شروع پرداخت هزینه‌های ساختمان</small></div>
      <div style="grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn lt" data-close-modal>انصراف</button><button class="btn sf" type="submit">ایجاد حساب</button></div>
      <p id="manager-add-account-error" class="sub" style="grid-column:1/-1;color:var(--danger)"></p>
    </form>`);
  const form=$('#manager-add-account-form',m), occ=form.elements.occupancy, personsWrap=$('#manager-add-persons-wrap',m), dateLabel=$('#manager-add-date-label',m);
  const sync=()=>{const owner=occ.value==='مالک';personsWrap.classList.toggle('hidden',owner);form.elements.persons.required=!owner;if(owner)form.elements.persons.value='';dateLabel.textContent=owner?'تاریخ خرید ملک':occ.value==='مستأجر'?'تاریخ شروع قرارداد اجاره':'تاریخ شروع پرداخت هزینه‌های ساختمان';};
  occ.addEventListener('change',sync); sync();
  $('[data-close-modal]',m).addEventListener('click',()=>closeModal(m));
  form.addEventListener('submit',async e=>{
    e.preventDefault();const d=new FormData(form),v=k=>String(d.get(k)||'').trim().replace(/[۰-۹]/g,x=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/[٠-٩]/g,x=>'٠١٢٣٤٥٦٧٨٩'.indexOf(x));
    const date=v('start_date_jalali');
    if(!/^[0-9]{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/.test(date)){ $('#manager-add-account-error',m).textContent='تاریخ را به صورت سال/ماه/روز شمسی وارد کنید.';return; }
    const btn=form.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='در حال ایجاد...';
    try{
      const result=await T('app_admin_create_account',{p_unit_no:Number(v('unit_no')),p_occupancy:v('occupancy'),p_username:v('username'),p_password:v('password'),p_full_name:v('full_name'),p_phone:v('phone'),p_email:v('email'),p_area:Number(v('area')),p_persons:v('occupancy')==='مالک'?null:Number(v('persons')),p_start_date_jalali:date});
      if(!result?.ok)throw new Error(result?.error||'ایجاد حساب ناموفق بود');
      closeModal(m);toast('حساب با موفقیت ایجاد شد');go('units');
    }catch(err){$('#manager-add-account-error',m).textContent=err.message||'خطا در ایجاد حساب';}
    finally{btn.disabled=false;btn.textContent='ایجاد حساب';}
  });
}

function normalizeJalaliDigits(value){return String(value||'').trim().replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));}
function jalaliToGregorianDate(value){
 const m=/^(\d{4})\/(\d{2})\/(\d{2})$/.exec(normalizeJalaliDigits(value));if(!m)throw new Error('تاریخ را به شکل ۱۴۰۵/۰۸/۱۶ وارد کنید');
 const jy=+m[1],jm=+m[2],jd=+m[3];if(jm<1||jm>12||jd<1||jd>(jm<=6?31:jm<=11?30:30))throw new Error('روز یا ماه شمسی معتبر نیست');
 const f=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
 for(let i=0;i<740;i++){const dt=new Date(Date.UTC(jy+621,0,1+i,12)),p=f.formatToParts(dt),g=k=>Number(p.find(x=>x.type===k)?.value);if(g('year')===jy&&g('month')===jm&&g('day')===jd)return dt.getUTCFullYear()+'-'+String(dt.getUTCMonth()+1).padStart(2,'0')+'-'+String(dt.getUTCDate()).padStart(2,'0');}
 throw new Error('تاریخ شمسی قابل تبدیل نیست');
}
function gregorianToJalaliDate(value){const d=String(value||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return '';const p=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'UTC'}).formatToParts(new Date(d+'T12:00:00Z'));const g=k=>p.find(x=>x.type===k)?.value;return g('year')+'/'+String(g('month')).padStart(2,'0')+'/'+String(g('day')).padStart(2,'0');}
function jalaliMonthDays(y,m){const a=jalaliToGregorianDate(y+'/'+String(m).padStart(2,'0')+'/01'),ny=m===12?y+1:y,nm=m===12?1:m+1,b=jalaliToGregorianDate(ny+'/'+String(nm).padStart(2,'0')+'/01');return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);}
async function settleAccountModal(acc){
 const td=jalaliToday();const today=td.y+'/'+String(td.m).padStart(2,'0')+'/'+String(td.d).padStart(2,'0');
 const m=modal('<h2>تسویه و آرشیو حساب</h2><p class="sub">'+esc(acc.full_name)+' · واحد '+fa(acc.unit_no)+' · '+esc(acc.occupancy)+'</p><div class="grid g2">'+jalaliDatePicker('تاریخ خروج (شمسی)','',''+today+'','exit-date')+'</div><p class="sub">شارژ، آب، گاز و پس‌انداز فقط در ماه خروج تا روز خروج محاسبه می‌شوند. پارکینگ و هزینه تعمیرات روزشمار نمی‌شوند.</p><div id="exit-preview"></div><div style="display:flex;gap:8px;margin-top:16px"><button class="btn sf" id="exit-calc" style="flex:1">محاسبه پیش‌نمایش</button><button class="btn lt" id="exit-close">انصراف</button></div>');
 const q=s=>$(s,m);let args=null;
  q('#exit-close').addEventListener('click',()=>closeModal(m));
 q('#exit-calc').addEventListener('click',async()=>{const b=q('#exit-calc');b.disabled=true;b.textContent='در حال محاسبه...';try{
 const date=q('#exit-date').value.trim().replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)),p=date.split('/').map(Number);
 args={p_account_id:acc.id,p_exit_date_jalali:date,p_exit_date:jalaliToGregorianDate(date),p_month_days:jalaliMonthDays(p[0],p[1]),p_next_occupancy:null,p_next_start_date_jalali:null,p_next_start_date:null,p_next_persons:null};
 const r=await T('app_preview_account_exit',args);if(!r?.ok)throw new Error(r?.error||'محاسبه انجام نشد');const t=r.totals||{};
 q('#exit-preview').innerHTML='<div class="card" style="background:var(--bg)"><h3>نتیجه پیش‌نمایش</h3><div class="grid g2"><div>شارژ: <b>'+fmt(t.charge)+'</b></div><div>آب: <b>'+fmt(t.water)+'</b></div><div>گاز: <b>'+fmt(t.gas)+'</b></div><div>پس‌انداز: <b>'+fmt(t.saving)+'</b></div><div>پارکینگ (کامل): <b>'+fmt(t.parking)+'</b></div><div>کل سهم: <b>'+fmt(r.total_due)+'</b></div><div>پرداخت‌های قبلی: <b>'+fmt(r.total_paid)+'</b></div><div>مانده: <b>'+fmt(r.balance)+'</b></div></div><p>بستانکاری قابل انتقال به حساب مالک: <b>'+fmt(r.refund_suggested)+' تومان</b></p>'+(r.legacy_payment_ambiguity?'<p style="color:var(--danger);font-size:12px">هشدار: بعضی پرداخت‌های قدیمی به حساب مشخصی متصل نیستند و تفکیک قطعی آن‌ها ممکن نیست؛ بنابراین برای جلوگیری از بازپرداخت اشتباه، سیستم بازپرداخت خودکار را در این تسویه غیرفعال کرده است.</p>':'')+(r.water_gas_population_estimate?'<p style="color:var(--danger);font-size:12px">توجه: سهم آب و گاز با تعداد نفرات ثبت‌شده فعلی سایر واحدها برآورد می‌شود؛ چون تاریخچه روزانه تغییر تعداد نفرات تمام واحدهای ساختمان موجود نیست، در صورت جابه‌جایی هم‌زمان در واحدهای دیگر ممکن است رقم دقیق نباشد.</p>':'')+'<details><summary>جزئیات ماه‌ها</summary><div>'+(r.months||[]).map(x=>'<div>'+fa(x.ym)+' · شارژ '+fmt(x.charge)+' · آب '+fmt(x.water)+' · گاز '+fmt(x.gas)+' · پس‌انداز '+fmt(x.saving)+' · پارکینگ '+fmt(x.parking)+'</div>').join('')+'</div></details></div><div id="exit-confirm-error" role="alert" style="display:none;color:var(--danger);background:rgba(220,38,38,.08);padding:10px 12px;border-radius:8px;margin-top:10px;white-space:pre-wrap;font-size:13px"></div><button class="btn sf" id="exit-confirm" style="width:100%;margin-top:12px">تأیید تسویه و آرشیو حساب</button>';
 q('#exit-confirm').addEventListener('click',async()=>{if(!confirm('تسویه نهایی ثبت و حساب آرشیو شود؟ در صورت تغییر مالکیت، مانده مالک به‌صورت خودکار به حساب مالک جدید منتقل می‌شود. تاریخ شروع حساب جدید هنگام ثبت همان حساب دریافت خواهد شد.'))return;const z=q('#exit-confirm');z.disabled=true;z.textContent='در حال ثبت تسویه...';try{const v=await T('app_confirm_account_exit',args);if(!v?.ok)throw new Error(v?.error||'ثبت تسویه ناموفق بود');closeModal(m);toast('تسویه ثبت و حساب آرشیو شد');go('units');}catch(e){z.disabled=false;z.textContent='تأیید تسویه و آرشیو حساب';const box=q('#exit-confirm-error');if(box){box.style.display='block';box.textContent='ثبت تسویه انجام نشد: '+(e?.message||String(e)||'خطای نامشخص');}console.error('app_confirm_account_exit failed:',e);}});
 }catch(e){showErr(e);}finally{b.disabled=false;b.textContent='محاسبه پیش‌نمایش';}});
}

function openingBalanceModal(acc) {
  const td=jalaliToday();
  const today=td.y+'/'+String(td.m).padStart(2,'0')+'/'+String(td.d).padStart(2,'0');
  const m=modal(`<h2>ثبت مانده اولیه</h2>
    <p class="sub">${esc(acc.full_name||'—')} · واحد ${fa(acc.unit_no)} · ${esc(acc.occupancy)}</p>
    <div class="card" style="background:var(--bg);margin-bottom:14px;font-size:12px">این سند مربوط به بدهی یا بستانکاری قبل از ثبت حساب در سامانه است و در موجودی صندوق ساختمان اثر ندارد. برای هر حساب فقط یک بار قابل ثبت است.</div>
    <form id="opening-balance-form" class="grid g2">
      <label class="f">نوع مانده
        <select name="balance_type" required><option value="debit">بدهکار (مبلغ به بدهی اضافه می‌شود)</option><option value="credit">بستانکار (از بدهی کسر می‌شود)</option></select>
      </label>
      <label class="f">مبلغ (تومان)<input name="amount" inputmode="numeric" required placeholder="مثلاً ۵۰۰۰۰۰"></label>
      <div style="grid-column:1/-1">${jalaliDatePicker('تاریخ مربوط به مانده (شمسی)','date',today)}</div>
      <label class="f" style="grid-column:1/-1">بابت / توضیحات<input name="note" maxlength="250" placeholder="مثلاً بدهی شارژ ماه‌های قبل"></label>
      <div style="grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn lt" data-opening-close>انصراف</button><button type="submit" class="btn sf">ثبت مانده</button></div>
      <p id="opening-balance-error" class="sub" style="grid-column:1/-1;color:var(--danger)"></p>
    </form>`);
  const form=$('#opening-balance-form',m);
  attachNumericInputIn(m,'[name="amount"]');
  $('[data-opening-close]',m).addEventListener('click',()=>closeModal(m));
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const date=normalizeJalaliDigits(form.elements.date.value);
    if(!/^[0-9]{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/.test(date)){
      $('#opening-balance-error',m).textContent='تاریخ را به صورت سال/ماه/روز شمسی وارد کنید.';return;
    }
    const parts=date.split('/').map(Number),amount=toNum(form.elements.amount.value);
    if(amount<=0){$('#opening-balance-error',m).textContent='مبلغ باید بیشتر از صفر باشد.';return;}
    const btn=form.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='در حال ثبت...';
    try{
      const r=await T('app_admin_register_opening_balance',{
        p_account_id:acc.id,p_balance_type:form.elements.balance_type.value,p_amount:amount,
        p_year:parts[0],p_month:parts[1],p_day:parts[2],p_note:form.elements.note.value.trim()||null
      });
      if(!r?.ok)throw new Error(r?.error||'ثبت مانده اولیه ناموفق بود');
      closeModal(m);toast('مانده اولیه ثبت شد؛ صندوق ساختمان تغییری نکرد');go('units');
    }catch(err){$('#opening-balance-error',m).textContent=err.message||'خطا در ثبت مانده اولیه';}
    finally{btn.disabled=false;btn.textContent='ثبت مانده';}
  });
}

function unitModal(u) {
  const activeAccounts = u.accounts.filter(a => a.is_active !== false); const archivedAccounts = u.accounts.filter(a => a.is_active === false);
  const m = modal(`<h2>واحد ${fa(u.unit_no)}</h2>${u.residency_issue ? `<div class="card" style="margin:12px 0 18px;background:var(--bg)"><label class="f">وضعیت سکونت واحد<select id="unit-residency-status"><option value="" disabled ${u.residency_status==='pending'?'selected':''}>انتخاب وضعیت...</option><option value="owner_occupied" ${u.residency_status==='owner_occupied'?'selected':''}>مالک ساکن</option><option value="tenant_occupied" ${u.residency_status==='tenant_occupied'?'selected':''}>مالک + مستأجر</option><option value="vacant_confirmed" ${u.residency_status==='vacant_confirmed'?'selected':''}>واحد خالی (مالک غیرساکن)</option></select></label><p class="sub" style="margin:8px 0">${esc(u.residency_issue || 'وضعیت فعلی این واحد تأیید شده است.')}</p><button type="button" class="btn sf" id="unit-residency-save">ثبت و تأیید وضعیت</button></div>` : ''}<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap"><button class="btn sf" id="quick-change">🔄 تغییر وضعیت واحد</button></div><h3 style="margin:24px 0 12px;font-size:16px">حساب‌های فعال (${fa(activeAccounts.length)})</h3><div id="active-acc">${activeAccounts.map(a => `<form class="acc grid g3" data-id="${a.id}" data-name="${esc(a.full_name)}" data-occ="${esc(a.occupancy)}" style="background:var(--bg);padding:16px;border-radius:12px;margin-bottom:12px"><label class="f">نام<input name="full_name" value="${esc(a.full_name || '')}" required></label><label class="f">موبایل<input name="phone" dir="ltr" value="${esc(a.phone || '')}"></label>${jalaliDatePicker('تاریخ شروع محاسبات','start_date_jalali',esc(a.start_date_jalali || ''))}<label class="f">سکونت<select name="occupancy">${OCC.map(o => `<option ${a.occupancy === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label><label class="f">نام کاربری<input name="username" dir="ltr" value="${esc(a.username || '')}"></label><label class="f">رمز جدید<input name="pass" type="password" placeholder="بدون تغییر" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric"></label><div style="align-self:end;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" type="submit">ذخیره</button><button type="button" class="btn lt sm" data-reset="${a.id}">ریست رمز</button><button type="button" class="btn lt sm" data-opening="${a.id}">ثبت مانده اولیه</button><button type="button" class="btn rd sm" data-archive="${a.id}">آرشیو</button></div></form>`).join('') || '<p class="sub">حسابی برای این واحد ثبت نشده.</p>'}</div>${archivedAccounts.length ? `<details style="margin-top:20px"><summary style="cursor:pointer;color:var(--muted);font-size:13px;padding:8px 0">📦 سابقه (${fa(archivedAccounts.length)} حساب آرشیو شده — دائمی)</summary><div style="margin-top:12px;opacity:.7"><p style="font-size:11px;color:var(--muted);margin:0 0 8px;background:#fef3c7;padding:6px 10px;border-radius:6px">⚠️ این حساب‌ها غیرفعال دائمی هستند. تراکنش‌هایشان حفظ شده، ولی دسترسی ورود ندارند.</p>${archivedAccounts.map(a => `<div style="background:var(--bg);padding:12px;border-radius:8px;margin-bottom:8px;font-size:13px"><b>${esc(a.full_name || '—')}</b> · ${esc(a.occupancy)} · ${esc(a.phone || '—')}<div style="font-size:12px;color:var(--muted);margin-top:4px">شروع محاسبات: ${esc(a.start_date_jalali || 'ثبت نشده')} · تاریخ خروج: ${esc(a.exit_date_jalali || '—')}</div><div style="margin-top:8px"><span class="chip ex">آرشیو</span></div></div>`).join('')}</div></details>` : ''}`);

  $('#unit-residency-save',m)?.addEventListener('click',async()=>{const b=$('#unit-residency-save',m),status=$('#unit-residency-status',m)?.value;if(!status||status==='pending'){toast('یکی از سه وضعیت سکونت را انتخاب کنید',true);return;}b.disabled=true;b.textContent='در حال بررسی و ثبت...';try{await T('app_admin_set_unit_residency',{p_unit_no:u.unit_no,p_residency_status:status});toast('وضعیت سکونت واحد تأیید شد');closeModal(m);go('units');}catch(err){showErr(err);}finally{b.disabled=false;b.textContent='ثبت و تأیید وضعیت';}});
  $$('form.acc', m).forEach(f => {
    f.addEventListener('submit', async e => { e.preventDefault(); try { const startDate=normalizeJalaliDigits(f.elements.start_date_jalali.value); const dateParts=startDate.split('/'); if(dateParts.length!==3 || dateParts[0].length!==4 || dateParts[1].length!==2 || dateParts[2].length!==2 || dateParts.some(part=>!/^[0-9]+$/.test(part)) || Number(dateParts[1])<1 || Number(dateParts[1])>12 || Number(dateParts[2])<1 || Number(dateParts[2])>31) throw new Error('تاریخ شروع را به صورت سال/ماه/روز شمسی وارد کنید'); const startYm=Number(dateParts[0]+dateParts[1]); await T('app_admin_save_account', { p_id: f.dataset.id, p_unit_no: u.unit_no, p_username: f.elements.username.value, p_full_name: f.elements.full_name.value, p_phone: f.elements.phone.value, p_occupancy: f.elements.occupancy.value, p_is_primary: true, p_is_active: true, p_new_password: f.elements.pass.value || null, p_start_ym: startYm, p_start_date_jalali: startDate }); toast('اطلاعات و تاریخ شروع محاسبات ذخیره شد'); go('units'); } catch (err) { showErr(err); } });
    $('[data-reset]', f)?.addEventListener('click', async () => { if (!confirm('رمز عبور این کاربر بازنشانی شود؟')) return; try { const newPass = await T('app_admin_reset_password', { p_id: f.dataset.id }); alert('رمز جدید: ' + newPass + '\n\nلطفاً به ساکن اطلاع دهید.'); toast('رمز بازنشانی شد'); } catch (err) { showErr(err); } });
    $('[data-archive]', f)?.addEventListener('click', async () => { const acc = activeAccounts.find(a => a.id == f.dataset.id); if (acc) await settleAccountModal(acc); });
  });
  Array.from(m.querySelectorAll('[data-opening]')).forEach(b => b.addEventListener('click', () => { const acc=u.accounts.find(a=>a.id===b.dataset.opening); if(acc) openingBalanceModal(acc); }));
  $('#quick-change', m)?.addEventListener('click', () => quickChangeModal(u, activeAccounts));
}

function addAccountForm(m, u) {
  const list = $('#active-acc', m); const form = document.createElement('form');
  form.className = 'acc grid g3'; form.style.cssText = 'background:var(--bg);padding:16px;border-radius:12px;margin-bottom:12px;border:2px dashed var(--accent)';
  form.innerHTML = `<label class="f">نام<input name="full_name" required></label><label class="f">موبایل<input name="phone" dir="ltr" required></label><label class="f">سکونت<select name="occupancy">${OCC.map(o => `<option>${o}</option>`).join('')}</select></label><label class="f">تعداد نفرات<input name="persons" type="number" min="1" max="30" value="1" required></label>${jalaliDatePicker('تاریخ شروع سکونت','start_date',(()=>{const d=jalaliToday();return d.y+'/'+String(d.m).padStart(2,'0')+'/'+String(d.d).padStart(2,'0')})())}<label class="f">نام کاربری<input name="username" dir="ltr" required></label><label class="f">رمز اولیه<input name="pass" type="password" required autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric"></label><div style="align-self:end;display:flex;gap:8px"><button class="btn sm" type="submit">ایجاد</button><button type="button" class="btn lt sm" data-cancel>انصراف</button></div>`;
  list.appendChild(form); form.querySelector('[data-cancel]').onclick = () => forcloseModal(m);
  form.addEventListener('submit', async e => { e.preventDefault(); try { const occ=form.elements.occupancy.value, jt=jalaliToday(), start=jt.y+'/'+String(jt.m).padStart(2,'0')+'/'+String(jt.d).padStart(2,'0'); const created=await T('app_admin_create_account',{p_unit_no:u.unit_no,p_occupancy:occ,p_username:form.elements.username.value.trim(),p_password:form.elements.pass.value,p_full_name:form.elements.full_name.value.trim(),p_phone:form.elements.phone.value.trim(),p_email:null,p_area:Number(u.area||1),p_persons:occ==='مالک'?0:Number(form.elements.persons.value),p_start_date_jalali:normalizeJalaliDigits(form.elements.start_date.value)}); if(!created?.ok)throw new Error(created?.error||'ساخت حساب انجام نشد'); toast('حساب ایجاد شد'); go('units'); } catch (err) { showErr(err); } });
}

function quickChangeModal(u, activeAccounts) {
  modal('<h2>تغییر وضعیت واحد '+fa(u.unit_no)+'</h2><p class="sub">برای جلوگیری از آرشیو بدون تسویه، ابتدا از مقابل هر حساب فعال دکمه «آرشیو» را بزنید و پیش‌نمایش تسویه همان حساب را تأیید کنید.</p><p>حساب‌های فعال این واحد: <b>'+fa(activeAccounts.length)+'</b></p><p class="sub">پس از تسویه، حساب ساکن بعدی را از بخش افزودن حساب ایجاد کنید. آرشیو گروهی بدون تسویه غیرفعال شده است.</p>');
}
function renderScenarioForm(scenario, m, u, activeAccounts) {
  const container = $('#sc-form', m); const tenant = activeAccounts.find(a => a.occupancy === 'مستأجر'); const owner = activeAccounts.find(a => a.occupancy === 'مالک'); const ownerResident = activeAccounts.find(a => a.occupancy === 'مالک ساکن');
  if (scenario === 'remove-tenant') {
    container.innerHTML = `<div class="card" style="background:#fef3c7;margin-bottom:16px;font-size:13px"><b>📋 خلاصه:</b><ul style="margin:8px 0 0;padding-right:20px"><li>حساب «${esc(tenant?.full_name || 'مستأجر')}» آرشیو می‌شود (دائمی)</li><li>«${esc(owner?.full_name || 'مالک')}» به «مالک ساکن» تغییر می‌کند</li><li>✅ همه تراکنش‌های قبلی حفظ می‌شوند</li></ul></div><button class="btn sf" id="apply-btn">✅ تایید و اعمال</button>`;
    $('#apply-btn', container)?.addEventListener('click', async () => { try { if (tenant) await archiveAccount(tenant); if (owner) { await T('app_admin_save_account', { p_id: owner.id, p_unit_no: u.unit_no, p_username: owner.username, p_full_name: owner.full_name, p_phone: owner.phone, p_occupancy: 'مالک ساکن', p_is_primary: true, p_is_active: true, p_new_password: null, p_start_ym: owner.start_ym || 140406 }); } closeModal(m); toast('تغییرات اعمال شد'); go('units'); } catch (err) { showErr(err); } });
  } else if (scenario === 'owner-to-absent') {
    container.innerHTML = `<div class="card" style="background:#fef3c7;margin-bottom:16px;font-size:13px"><b>📋 خلاصه:</b><ul style="margin:8px 0 0;padding-right:20px"><li>«${esc(ownerResident?.full_name || 'مالک ساکن')}» به «مالک» تغییر می‌کند</li><li>مستأجر جدید با فرم زیر اضافه می‌شود</li></ul></div><form id="sc-f" class="grid g2"><label class="f">نام مستأجر<input name="tenant_name" required></label><label class="f">موبایل<input name="tenant_phone" dir="ltr" required></label><label class="f">نام کاربری<input name="tenant_username" dir="ltr" required></label><label class="f">رمز اولیه<input name="tenant_pass" type="password" required autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric"></label><button class="btn sf" style="grid-column:1/-1" type="submit">✅ اعمال</button></form>`;
    $('#sc-f', container).addEventListener('submit', async e => { e.preventDefault(); try { if (ownerResident) { await T('app_admin_save_account', { p_id: ownerResident.id, p_unit_no: u.unit_no, p_username: ownerResident.username, p_full_name: ownerResident.full_name, p_phone: ownerResident.phone, p_occupancy: 'مالک', p_is_primary: false, p_is_active: true, p_new_password: null, p_start_ym: ownerResident.start_ym || 140406 }); } await T('app_admin_save_account', { p_id: null, p_unit_no: u.unit_no, p_username: e.target.tenant_username.value, p_full_name: e.target.tenant_name.value, p_phone: e.target.tenant_phone.value, p_occupancy: 'مستأجر', p_is_primary: true, p_is_active: true, p_new_password: e.target.tenant_pass.value, p_start_ym: 140406 }); closeModal(m); toast('تغییرات اعمال شد'); go('units'); } catch (err) { showErr(err); } });
  } else if (scenario === 'replace-tenant') {
    container.innerHTML = `<div class="card" style="background:#fef3c7;margin-bottom:16px;font-size:13px"><b>📋 خلاصه:</b><ul style="margin:8px 0 0;padding-right:20px"><li>مستأجر فعلی «${esc(tenant?.full_name || '—')}» آرشیو می‌شود (دائمی)</li><li>مستأجر جدید با یوزر/پس جدید اضافه می‌شود</li></ul></div><form id="sc-f" class="grid g2"><label class="f">نام مستأجر جدید<input name="tenant_name" required></label><label class="f">موبایل<input name="tenant_phone" dir="ltr" required></label><label class="f">نام کاربری<input name="tenant_username" dir="ltr" required></label><label class="f">رمز اولیه<input name="tenant_pass" type="password" required autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric"></label><button class="btn sf" style="grid-column:1/-1" type="submit">✅ اعمال</button></form>`;
    $('#sc-f', container).addEventListener('submit', async e => { e.preventDefault(); try { if (tenant) await archiveAccount(tenant); await T('app_admin_save_account', { p_id: null, p_unit_no: u.unit_no, p_username: e.target.tenant_username.value, p_full_name: e.target.tenant_name.value, p_phone: e.target.tenant_phone.value, p_occupancy: 'مستأجر', p_is_primary: true, p_is_active: true, p_new_password: e.target.tenant_pass.value, p_start_ym: 140406 }); closeModal(m); toast('مستأجر تعویض شد'); go('units'); } catch (err) { showErr(err); } });
  } else if (scenario === 'replace-all') {
    container.innerHTML = `<div class="card" style="background:#fee2e2;margin-bottom:16px;font-size:13px"><b>⚠️ هشدار:</b><ul style="margin:8px 0 0;padding-right:20px"><li>همه‌ی ${fa(activeAccounts.length)} حساب فعال آرشیو می‌شوند (دائمی)</li><li>✅ تراکنش‌های قبلی حفظ می‌شوند</li></ul></div><form id="sc-f" class="grid g2"><label class="f">نام<input name="name" required></label><label class="f">موبایل<input name="phone" dir="ltr" required></label><label class="f">سکونت<select name="occupancy">${OCC.map(o => `<option>${o}</option>`).join('')}</select></label><label class="f">نام کاربری<input name="username" dir="ltr" required></label><label class="f">رمز اولیه<input name="pass" type="password" required autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric"></label><button class="btn rd" style="grid-column:1/-1" type="submit">⚠️ آرشیو همه و ساخت جدید</button></form>`;
    $('#sc-f', container).addEventListener('submit', async e => { e.preventDefault(); if (!confirm('مطمئنید؟ همه حساب‌ها آرشیو می‌شوند (دائمی).')) return; try { for (const acc of activeAccounts) await archiveAccount(acc); await T('app_admin_save_account', { p_id: null, p_unit_no: u.unit_no, p_username: e.target.username.value, p_full_name: e.target.name.value, p_phone: e.target.phone.value, p_occupancy: e.target.occupancy.value, p_is_primary: true, p_is_active: true, p_new_password: e.target.pass.value, p_start_ym: 140406 }); closeModal(m); toast('تغییرات اعمال شد'); go('units'); } catch (err) { showErr(err); } });
  } else if (scenario === 'vacant') {
    container.innerHTML = `<div class="card" style="background:#fee2e2;margin-bottom:16px;font-size:13px"><b>⚠️ همه‌ی حساب‌های این واحد آرشیو می‌شوند (دائمی).</b><p style="margin:8px 0 0">تراکنش‌های قبلی حفظ می‌شوند.</p></div><button class="btn rd" id="apply-vacant">🗑️ تایید خالی شدن</button>`;
    $('#apply-vacant', container)?.addEventListener('click', async () => { if (!confirm('مطمئنید؟ همه حساب‌های این واحد آرشیو می‌شوند (دائمی).')) return; try { for (const acc of activeAccounts) await archiveAccount(acc); closeModal(m); toast('واحد خالی شد'); go('units'); } catch (err) { showErr(err); } });
  }
}

async function viewRates(el) {
  const [rates, st, baleCfg, rateGuardUnits] = await Promise.all([T('app_get_rates'), T('app_get_settings'), T('app_admin_get_bale_config'), T('app_get_units')]);
  const rateGuardIssues = rateGuardUnits.length ? rateGuardUnits.filter(u=>u.residency_issue) : [{unit_no:null,residency_issue:'هنوز واحدی برای ساختمان ثبت نشده است'}];
  const rateGuardWarning = rateGuardIssues.length ? `<div class="card" style="margin-bottom:16px;border-color:var(--danger)"><b style="color:var(--danger)">ثبت، ویرایش و حذف نرخ شارژ و پس‌انداز تا تعیین تکلیف تمام واحدها مسدود است.</b><p class="sub" style="margin:8px 0 0">${rateGuardIssues.map(u=>(u.unit_no?'واحد '+fa(u.unit_no)+': ':'')+esc(u.residency_issue)).join(' · ')}</p><button class="btn sf sm" style="margin-top:10px" type="button" data-go="units">تعیین وضعیت واحدها</button></div>` : '';
  const getPayers = arr => !arr ? 'همه' : arr.length === 0 ? 'هیچ‌کس' : arr.map(o => esc(String(o).replace('مالک ساکن', 'ساکن'))).join('، ');
  let retainedParking = 0, retainedPayerParking = [...OCC], retainedPayerWater = [...OCC], retainedPayerGas = [...OCC];
  el.innerHTML = `<h1>${S.view === 'charge' ? 'ثبت شارژ' : 'تنظیمات ساختمان'}</h1>${rateGuardWarning}<div class="grid g2"><div><h2 style="margin-bottom:16px">لیست نرخ‌های ثبت شده</h2><div id="rates-accordion">${rates.map(r => `<div class="accordion-item"><div class="accordion-header"><span>📅 ${MONTHS[r.month - 1]} ${fa(r.year)}</span><span class="chip ex" style="font-size:11px">مشاهده ▼</span></div><div class="accordion-body"><table style="margin-bottom:16px"><tbody><tr><td style="border:0"><b>شارژ:</b> ${money(r.charge)}<br><small style="color:var(--muted)">${getPayers(r.payer_charge)}</small></td><td style="border:0"><b>پس‌انداز:</b> ${money(r.repair)}<br><small style="color:var(--muted)">${getPayers(r.payer_repair)}</small></td></tr></tbody></table><div style="display:flex;gap:8px"><button class="btn lt sm" data-er="${r.year}-${r.month}" ${rateGuardIssues.length?'disabled title="ابتدا وضعیت تمام واحدها را تأیید کنید"':''}>ویرایش</button><button class="btn rd sm" data-dr="${r.year}-${r.month}" ${rateGuardIssues.length?'disabled title="ابتدا وضعیت تمام واحدها را تأیید کنید"':''}>حذف</button></div></div></div>`).join('') || '<p class="sub">هیچ نرخی ثبت نشده است.</p>'}</div></div><div class="grid" style="align-content:start"><form id="rf" class="card grid g3"><h2 style="grid-column:1/-1;margin:0">ثبت / ویرایش نرخ</h2><label class="f">سال<select id="r-y">${yearOptions(TODAY.y)}</select></label><label class="f">ماه<select id="r-m">${monthOptions(TODAY.m)}</select></label><label class="f">شارژ<input id="r-c" inputmode="numeric"></label><div style="grid-column:1/-1;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap">پرداخت‌کننده شارژ: ${OCC.map(o => `<label style="display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" value="${o}" class="r-pch" checked> ${o.replace('مالک ساکن','ساکن')}</label>`).join('')}</div><label class="f">پس‌انداز<input id="r-r" inputmode="numeric"></label><div style="grid-column:1/-1;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap">پرداخت‌کننده پس‌انداز: ${OCC.map(o => `<label style="display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" value="${o}" class="r-prp" checked> ${o.replace('مالک ساکن','ساکن')}</label>`).join('')}</div><div style="grid-column:1/-1"><button class="btn sf" type="submit" ${rateGuardIssues.length?'disabled title="ابتدا وضعیت تمام واحدها را تأیید کنید"':''}>ذخیره نرخ</button></div></form><form id="sf" class="card grid g3"><h2 style="grid-column:1/-1;margin:0">تنظیمات کلی</h2><label class="f" style="grid-column:1/-1">نام ساختمان<input id="s-n" value="${esc(st.building_name || '')}"></label><label class="f">موجودی اولیه صندوق<input id="s-o" inputmode="numeric" value="${fmt(st.opening_balance)}"></label><label class="f">سال شروع محاسبه<select id="s-s-y">${yearOptions(Number(String(st.start_ym || '').slice(0,4)) || TODAY.y)}</select></label><label class="f">ماه شروع محاسبه<select id="s-s-m">${monthOptions(Number(String(st.start_ym || '').slice(4)) || TODAY.m)}</select></label><div style="align-self:end"><button class="btn" type="submit">ذخیره تنظیمات</button></div></form><form id="bale-settings-form" class="card grid" style="gap:12px"><h2 style="margin:0">اتصال به پیام‌رسان بله</h2><p class="sub" style="margin:0">با ذخیره این اطلاعات، تمام اعلان‌های همین ساختمان به گروه یا چت انتخاب‌شده ارسال می‌شود. توکن ربات به‌صورت محرمانه در سرور نگهداری می‌شود.</p><label class="f">توکن ربات بله<input id="bale-bot-token" dir="ltr" autocomplete="off" type="password" placeholder="${baleCfg?.configured ? 'توکن ثبت شده؛ برای تغییر، توکن جدید را وارد کنید' : 'توکن ربات را وارد کنید'}" autocorrect="off" autocapitalize="off" spellcheck="false"></label><label class="f">شناسه گروه / چت مقصد<input id="bale-chat-id" dir="ltr" value="${esc(baleCfg?.chat_id || '')}" placeholder="شناسه گروه یا چت مقصد"></label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn" type="submit">ذخیره اتصال بله</button><button class="btn lt" type="button" id="bale-discover">پیدا کردن خودکار گروه</button>${baleCfg?.configured ? '<button class="btn rd" type="button" id="bale-disconnect">قطع اتصال بله</button>' : ''}<span class="chip ${baleCfg?.configured ? 'ok' : 'pd'}">${baleCfg?.configured ? 'اتصال تنظیم شده' : 'هنوز متصل نشده'}</span></div><div id="bale-discovery-result" class="sub" style="margin:0"></div><p class="sub" style="margin:0">برای ویرایش، توکن یا شناسه مقصد را تغییر دهید و ذخیره کنید. خالی گذاشتن توکن، توکن قبلی را حفظ می‌کند. برای پیدا کردن خودکار گروه، اگر اتصال قبلی ندارید توکن ربات را وارد کنید؛ سپس گروهی را که ربات در آن پیام دریافت کرده انتخاب کنید.</p></form></div></div>`;
  const rateListPanel = $('#rates-accordion')?.parentElement;
  if (rateListPanel) rateListPanel.style.display = 'none';
  if (S.view === 'charge') {
    $('#sf')?.style.setProperty('display','none');
    $('#bale-settings-form')?.style.setProperty('display','none');
    $('#rf')?.style.setProperty('display','block');
  } else {
    $('#rf')?.style.setProperty('display','none');
    $('#sf')?.style.setProperty('display','grid');
    $('#bale-settings-form')?.style.setProperty('display','grid');
  }
  $('#rates-accordion')?.addEventListener('click', e => { if (e.target.closest('.accordion-header')) e.target.closest('.accordion-header')?.nextElementSibling?.classList.toggle('open'); });
  attachNumericInput('#r-c', '#r-r', '#s-o');
  $$('[data-er]').forEach(b => b.addEventListener('click', () => { if (rateGuardIssues.length) { toast('تا تعیین تکلیف تمام واحدها امکان ویرایش نرخ وجود ندارد'); return; } const [y, mo] = b.dataset.er.split('-').map(Number); const r = rates.find(x => x.year === y && x.month === mo); if (!r) return; $('#r-y').value = y; $('#r-m').value = mo; $('#r-c').value = fmt(r.charge); $('#r-r').value = fmt(r.repair); retainedParking = Number(r.parking) || 0; retainedPayerParking = Array.isArray(r.payer_parking) ? r.payer_parking : [...OCC]; retainedPayerWater = Array.isArray(r.payer_water) ? r.payer_water : [...OCC]; retainedPayerGas = Array.isArray(r.payer_gas) ? r.payer_gas : [...OCC]; $$('.r-pch').forEach(cb => cb.checked = (r.payer_charge || OCC).includes(cb.value)); $$('.r-prp').forEach(cb => cb.checked = (r.payer_repair || OCC).includes(cb.value)); $('#rf')?.scrollIntoView({ behavior: 'smooth' }); }));
  $$('[data-dr]').forEach(b => b.addEventListener('click', async () => { if (rateGuardIssues.length) { toast('تا تعیین تکلیف تمام واحدها امکان حذف نرخ وجود ندارد'); return; } if (!confirm('حذف شود؟')) return; const [y, mo] = b.dataset.dr.split('-').map(Number); try { await T('app_admin_delete_rate', { p_year: y, p_month: mo }); go('charge'); } catch (e) { showErr(e); } }));
  $('#rf')?.addEventListener('submit', async e => { e.preventDefault(); if (rateGuardIssues.length) { toast('تا تعیین تکلیف تمام واحدها امکان ثبت نرخ وجود ندارد'); return; } const getChecked = cls => $$('.' + cls).filter(x => x.checked).map(x => x.value); try { const y = +$('#r-y').value; const m = +$('#r-m').value; const charge = toNum($('#r-c').value); const repair = toNum($('#r-r').value); await T('app_admin_save_rate', { p_year: y, p_month: m, p_charge: charge, p_repair: repair, p_parking: retainedParking, p_payer_charge: getChecked('r-pch'), p_payer_repair: getChecked('r-prp'), p_payer_parking: retainedPayerParking, p_payer_water: retainedPayerWater, p_payer_gas: retainedPayerGas }); notifyBale(`📊 نرخ‌های ماه ${MONTHS[m-1]} ${y} ثبت/ویرایش شد:\n\n🔹 شارژ: ${fmt(charge)} تومان\n🔹 پس‌انداز: ${fmt(repair)} تومان`); toast('ذخیره شد و به بله ارسال گردید'); go('charge'); } catch (err) { showErr(err); } });
  $('#sf')?.addEventListener('submit', async e => { e.preventDefault(); const s = Number($('#s-s-y').value + String($('#s-s-m').value).padStart(2,'0')); try { await T('app_admin_save_settings', { p_building_name: $('#s-n').value, p_opening_balance: toNum($('#s-o').value), p_start_ym: s }); toast('ذخیره شد'); go('settings'); } catch (err) { showErr(err); } });
  $('#bale-settings-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const button = $('#bale-settings-form button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'در حال ذخیره...'; }
    try {
      await T('app_admin_save_bale_config', {
        p_bot_token: $('#bale-bot-token').value.trim(),
        p_chat_id: $('#bale-chat-id').value.trim()
      });
      toast('تنظیمات اتصال بله ذخیره شد');
      go('settings');
    } catch (err) { showErr(err); }
    finally { if (button) { button.disabled = false; button.textContent = 'ذخیره اتصال بله'; } }
  });
  $('#bale-disconnect')?.addEventListener('click', async () => {
    if (!confirm('اتصال بله برای این ساختمان قطع شود؟ توکن و شناسه ذخیره‌شده حذف می‌شوند و اعلان‌ها دیگر به بله ارسال نمی‌شوند.')) return;
    const b = $('#bale-disconnect'); if (b) { b.disabled = true; b.textContent = 'در حال قطع اتصال...'; }
    try { await T('app_admin_delete_bale_config'); toast('اتصال بله قطع شد'); go('settings'); }
    catch (err) { showErr(err); if (b) { b.disabled = false; b.textContent = 'قطع اتصال بله'; } }
  });
  $('#bale-discover')?.addEventListener('click', async () => {
    const b = $('#bale-discover'), out = $('#bale-discovery-result');
    const botToken = $('#bale-bot-token')?.value.trim() || '';
    if (b) { b.disabled = true; b.textContent = 'در حال جست‌وجوی گروه‌ها...'; }
    if (out) out.textContent = 'در حال بررسی پیام‌های دریافتی ربات...';
    try {
      const { data, error } = await sb.functions.invoke('send-bale', { body: { action: 'discover', app_token: S.token, building_id: Number(S.me?.building_id), bot_token: botToken } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'امکان دریافت گروه‌ها وجود ندارد');
      const chats = Array.isArray(data.chats) ? data.chats : [];
      if (!chats.length) { if (out) out.textContent = data.message || 'هنوز پیامی از گروه دریافت نشده است. در گروه یک پیام بفرستید و دوباره تلاش کنید.'; return; }
      if (out) out.innerHTML = '<label class="f">گروه‌های شناسایی‌شده<select id="bale-discovered-chat"><option value="">انتخاب گروه...</option>' + chats.map(x => '<option value="' + esc(String(x.id)) + '">' + esc(x.title || ('گروه ' + x.id)) + ' — ' + esc(String(x.id)) + '</option>').join('') + '</select></label><small>گروه موردنظر را انتخاب کنید؛ شناسه مقصد به‌صورت خودکار در فیلد بالا قرار می‌گیرد.</small>';
      $('#bale-discovered-chat')?.addEventListener('change', e => { if (e.target.value) $('#bale-chat-id').value = e.target.value; });
    } catch (err) { if (out) out.textContent = err?.message || 'جست‌وجوی گروه ناموفق بود'; }
    finally { if (b) { b.disabled = false; b.textContent = 'پیدا کردن خودکار گروه'; } }
  });
}

async function viewSettings(el) {
  const theme = localStorage.getItem('bm_theme') || 'default';
  const themePanel = `<section class="card" style="margin:14px 0"><h2 style="margin:0 0 12px">انتخاب تم برنامه</h2><div class="theme-picker" style="display:flex;gap:14px;flex-wrap:wrap"><button type="button" class="theme-dot default ${theme==='default'?'active':''}" data-settings-theme="default" title="سرمه‌ای" aria-label="تم سرمه‌ای"></button><button type="button" class="theme-dot emerald ${theme==='emerald'?'active':''}" data-settings-theme="emerald" title="زمردی" aria-label="تم زمردی"></button><button type="button" class="theme-dot dark ${theme==='dark'?'active':''}" data-settings-theme="dark" title="تیره" aria-label="تم تیره"></button><button type="button" class="theme-dot ocean ${theme==='ocean'?'active':''}" data-settings-theme="ocean" title="اقیانوسی" aria-label="تم اقیانوسی"></button></div></section>`;
  const accountLinks = `<div class="grid g2" style="margin:14px 0"><button class="card" type="button" data-settings-go="profile" style="text-align:right;cursor:pointer"><h2>پروفایل</h2><p class="sub">اطلاعات حساب، عکس، رمز عبور و اعلان‌ها</p></button>${S.me?.is_admin ? '<button class="card" type="button" data-settings-go="activity" style="text-align:right;cursor:pointer"><h2>گزارش فعالیت‌ها</h2><p class="sub">مشاهده رویدادها و فعالیت کاربران</p></button>' : ''}</div>`;
  if (S.me?.is_admin) {
    await viewRates(el);
    const heading = $('h1', el); if (heading) heading.textContent = 'تنظیمات';
    el.insertAdjacentHTML('afterbegin', accountLinks + themePanel);
  } else {
    el.innerHTML = '<h1>تنظیمات</h1>' + accountLinks + themePanel;
  }
  $$('[data-settings-go]', el).forEach(b => b.addEventListener('click', () => go(b.dataset.settingsGo)));
  $$('[data-settings-theme]', el).forEach(b => b.addEventListener('click', () => {
    setTheme(b.dataset.settingsTheme);
    $$('[data-settings-theme]', el).forEach(x => x.classList.toggle('active', x === b));
  }));
}

async function viewActivity(el) {
  const logs = await T('app_admin_get_activity_logs');
  const today = new Date().toDateString();
  const todayLogins = logs.filter(l => l.action === 'ورود' && new Date(l.created_at).toDateString() === today).length;
  el.innerHTML = `<h1>گزارش فعالیت‌ها</h1><p class="sub">آخرین رویدادهای ثبت شده</p><div class="grid g3" style="margin-bottom:20px"><div class="card" style="background:var(--accent);color:#fff"><small>ورودهای امروز</small><div style="font-size:28px;font-weight:900">${fa(todayLogins)} نفر</div></div><div class="card"><small>کل فعالیت‌ها</small><div style="font-size:28px;font-weight:900">${fa(logs.length)} مورد</div></div></div><div class="tbl-wrap"><table><thead><tr><th>کاربر</th><th>واحد</th><th>نوع فعالیت</th><th>جزئیات</th><th>زمان</th></tr></thead><tbody>${logs.map(l => `<tr><td><b>${esc(l.full_name || 'ناشناس')}</b></td><td>${l.unit_no ? 'واحد ' + fa(l.unit_no) : '—'}</td><td><span class="chip ${l.action.includes('ورود') ? 'ok' : 'ex'}">${esc(l.action)}</span></td><td>${esc(l.details || '—')}</td><td dir="ltr" style="text-align:right;font-size:12px">${new Date(l.created_at).toLocaleString('fa-IR')}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center">موردی نیست</td></tr>'}</tbody></table></div>`;
}

async function viewProfile(el) {
  const a = S.me;
  el.innerHTML = `${mustChangeBanner()}<h1>پروفایل</h1>
  <div class="card" style="margin:14px 0 18px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <div id="profile-avatar-preview" style="width:92px;height:92px;border-radius:50%;overflow:hidden;background:var(--bg);border:3px solid var(--line);display:grid;place-items:center;flex:none">${S.avatarData ? `<img src="${esc(S.avatarData)}" alt="عکس پروفایل" style="width:100%;height:100%;object-fit:cover">` : ICONS.profile.replace('<svg','<svg width="46" height="46"')}</div>
    <div style="flex:1;min-width:180px"><b style="display:block;margin-bottom:8px">عکس پروفایل</b><input id="profile-avatar-input" type="file" accept="image/jpeg,image/png,image/webp" hidden><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sf sm" id="profile-avatar-change">انتخاب یا تغییر عکس</button><button type="button" class="btn rd sm" id="profile-avatar-remove" ${S.avatarData ? '' : 'disabled'}>حذف عکس</button></div><p class="sub" style="margin:8px 0 0">تصویر از گالری انتخاب می‌شود و به حساب کاربری شما متصل می‌ماند.</p></div>
  </div>
  <div class="card" style="margin:14px 0 18px;border-color:var(--accent)"><h2 style="margin:0 0 6px">🔔 اعلان‌های موبایلی</h2><p class="sub" style="margin:0 0 12px">با فعال‌کردن این گزینه، اعلان‌های مهم ساختمان حتی هنگام بسته‌بودن صفحه برنامه روی گوشی نمایش داده می‌شوند.</p><button type="button" class="btn sf" id="enable-push-btn">فعال‌سازی اعلان‌ها</button><p id="push-status" class="sub" style="margin:8px 0 0"></p></div><p class="sub">واحد ${fa(a.unit_no)} · ${esc(a.occupancy || '')}</p><form id="pf2" class="card grid g2" style="max-width:760px"><label class="f">نام<input id="p-n" value="${esc(a.full_name || '')}"></label><label class="f">شماره موبایل<input id="p-ph" dir="ltr" value="${esc(a.phone || '')}"></label><label class="f" style="grid-column:1/-1">ایمیل<input id="p-e" dir="ltr" type="email" value="${esc(a.email || '')}"></label><h2 style="grid-column:1/-1;margin:12px 0 0">نام کاربری و رمز</h2><label class="f">نام کاربری<input id="p-u" dir="ltr" value="${esc(a.username || '')}"></label><label class="f">رمز فعلی<input id="p-c" dir="ltr" type="password" autocomplete="current-password" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric"></label><label class="f">رمز جدید<input id="p-np" dir="ltr" type="password" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric"></label><label class="f">تکرار رمز<input id="p-np2" dir="ltr" type="password" autocomplete="new-password" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="numeric"></label><div style="grid-column:1/-1"><button class="btn sf">ذخیره</button></div></form>`;
  if (a.is_admin) {
    try {
      const info = await T('app_management_transfer_info');
      const outgoing = info?.outgoing;
      const panel = document.createElement('section');
      panel.id = 'manager-transfer-panel';
      panel.style.margin = '14px 0 18px';
      if (outgoing?.status === 'pending') {
        panel.innerHTML = `<div class="card" style="border-color:var(--accent)">
          <h2 style="margin:0 0 8px">🔁 تحویل مدیریت ساختمان</h2>
          <p class="sub">درخواست انتقال برای ${esc(outgoing.target_name)} · واحد ${fa(outgoing.target_unit)} ارسال شده است. تا زمان پذیرش، اختیارات شما حفظ می‌شود.</p>
          <button type="button" class="btn rd sm" id="profile-transfer-cancel">لغو درخواست انتقال</button>
        </div>`;
      } else {
        const statusText = outgoing ? ({accepted:'آخرین درخواست پذیرفته شد',rejected:'آخرین درخواست رد شد',cancelled:'آخرین درخواست لغو شد'}[outgoing.status] || '') : '';
        panel.innerHTML = `<div class="card" style="border-color:var(--accent)">
          <h2 style="margin:0 0 8px">🔁 تحویل مدیریت ساختمان</h2>
          ${statusText ? `<p class="sub">${statusText}</p>` : ''}
          <p class="sub">یکی از ساکنان فعال ساختمان را به‌عنوان مدیر بعدی انتخاب کنید. تا زمان پذیرش درخواست، مدیریت و تمام اختیارات شما باقی می‌ماند.</p>
          <form id="profile-transfer-create" class="grid" style="gap:10px">
            <label class="f">انتخاب جانشین
              <select id="profile-transfer-target" required>
                <option value="">انتخاب کنید</option>
                ${(info?.candidates || []).map(x => `<option value="${x.id}">${esc(x.name)} · واحد ${fa(x.unit_no)}</option>`).join('')}
              </select>
            </label>
            <button class="btn" type="submit">ارسال درخواست انتقال</button>
          </form>
        </div>`;
      }
      const profileForm = $('#pf2');
      profileForm?.parentNode?.insertBefore(panel, profileForm);
      $('#profile-transfer-create')?.addEventListener('submit', async e => {
        e.preventDefault();
        const target = $('#profile-transfer-target')?.value;
        if (!target) { toast('جانشین را انتخاب کنید', true); return; }
        const submit = $('#profile-transfer-create button[type="submit"]');
        if (submit) submit.disabled = true;
        try {
          await T('app_management_transfer_create', { p_target_account_id: target });
          toast('درخواست انتقال برای جانشین ارسال شد');
          viewProfile(el);
        } catch (err) { if (submit) submit.disabled = false; showErr(err); }
      });
      $('#profile-transfer-cancel')?.addEventListener('click', async () => {
        if (!confirm('درخواست انتقال مدیریت لغو شود؟')) return;
        try {
          await T('app_management_transfer_cancel');
          toast('درخواست انتقال لغو شد');
          viewProfile(el);
        } catch (err) { showErr(err); }
      });
    } catch (err) {
      const panel = document.createElement('div');
      panel.className = 'card';
      panel.style.margin = '14px 0';
      panel.textContent = 'بخش تحویل مدیریت فعلاً بارگذاری نشد: ' + (err.message || 'خطای نامشخص');
      $('#pf2')?.parentNode?.insertBefore(panel, $('#pf2'));
    }
  } else {
    try {
      const info = await T('app_management_transfer_info');
      if (info?.incoming) {
        const panel = document.createElement('section');
        panel.style.margin = '14px 0 18px';
        panel.innerHTML = `<div class="card" style="border-color:var(--accent)">
          <h2 style="margin:0 0 8px">🔔 درخواست پذیرش مدیریت ساختمان</h2>
          <p class="sub">${esc(info.incoming.manager_name)} · مدیر فعلی، شما را برای انتقال مدیریت انتخاب کرده است. با پذیرش، نقش شما به مدیر ساختمان تغییر می‌کند و مدیر فعلی به ساکن تبدیل می‌شود.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn" data-profile-transfer-respond="accept" data-transfer-id="${info.incoming.id}">پذیرش انتقال</button>
            <button type="button" class="btn rd" data-profile-transfer-respond="reject" data-transfer-id="${info.incoming.id}">رد درخواست</button>
          </div>
        </div>`;
        $('#pf2')?.parentNode?.insertBefore(panel, $('#pf2'));
        $$('[data-profile-transfer-respond]', panel).forEach(btn => btn.addEventListener('click', async () => {
          const accept = btn.dataset.profileTransferRespond === 'accept';
          if (!confirm(accept ? 'با پذیرش، مدیریت ساختمان به حساب شما منتقل و مدیر فعلی به نقش ساکن برمی‌گردد. ادامه می‌دهید؟' : 'درخواست انتقال مدیریت رد شود؟')) return;
          $$('[data-profile-transfer-respond]', panel).forEach(x => x.disabled = true);
          try {
            await T('app_management_transfer_respond', { p_request_id: Number(btn.dataset.transferId), p_accept: accept });
            if (accept) {
              S.me = await T('app_me');
              sessionStorage.setItem('bm_me', JSON.stringify(S.me));
              toast('مدیریت ساختمان با موفقیت به شما منتقل شد');
              renderShell();
            } else {
              toast('درخواست انتقال رد شد');
              viewProfile(el);
            }
          } catch (err) {
            $$('[data-profile-transfer-respond]', panel).forEach(x => x.disabled = false);
            showErr(err);
          }
        }));
      }
    } catch (err) { console.warn('Transfer info unavailable in profile:', err); }
  }
  $('#profile-avatar-change')?.addEventListener('click', () => $('#profile-avatar-input')?.click());
  $('#profile-avatar-input')?.addEventListener('change', async e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) { toast('فقط تصویر JPG، PNG یا WEBP قابل قبول است', true); e.target.value = ''; return; }
    const button = $('#profile-avatar-change'); if (button) { button.disabled = true; button.textContent = 'در حال آماده‌سازی...'; }
    try {
      const image = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file); const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('خواندن تصویر ناموفق بود')); };
        img.src = url;
      });
      const size = 256, canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d'); const crop = Math.min(image.width, image.height);
      ctx.drawImage(image, (image.width-crop)/2, (image.height-crop)/2, crop, crop, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', .78);
      if (dataUrl.length > 400000) throw new Error('حجم تصویر پس از فشرده‌سازی هنوز زیاد است');
      await T('app_profile_avatar_set', { p_image_data: dataUrl });
      S.avatarData = dataUrl;
      const preview = $('#profile-avatar-preview'); if (preview) preview.innerHTML = `<img src="${esc(dataUrl)}" alt="عکس پروفایل" style="width:100%;height:100%;object-fit:cover">`;
      const topAvatar = $('#who-btn'); if (topAvatar) topAvatar.innerHTML = `<img src="${esc(dataUrl)}" alt="عکس پروفایل" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      const remove = $('#profile-avatar-remove'); if (remove) remove.disabled = false;
      toast('عکس پروفایل ذخیره شد');
    } catch (err) { showErr(err); }
    finally { if (button) { button.disabled = false; button.textContent = 'انتخاب یا تغییر عکس'; } e.target.value = ''; }
  });
  $('#profile-avatar-remove')?.addEventListener('click', async () => {
    if (!S.avatarData || !confirm('عکس پروفایل حذف شود؟')) return;
    const button = $('#profile-avatar-remove'); if (button) button.disabled = true;
    try {
      await T('app_profile_avatar_set', { p_image_data: null }); S.avatarData = null;
      const preview = $('#profile-avatar-preview'); if (preview) preview.innerHTML = ICONS.profile.replace('<svg','<svg width="46" height="46"');
      const topAvatar = $('#who-btn'); if (topAvatar) topAvatar.innerHTML = ICONS.profile.replace('<svg','<svg width="26" height="26"');
      toast('عکس پروفایل حذف شد');
    } catch (err) { showErr(err); if (button) button.disabled = false; }
  });
  $('#enable-push-btn')?.addEventListener('click', async e => {
    const btn = e.currentTarget; const status = $('#push-status');
    btn.disabled = true; btn.textContent = 'در حال فعال‌سازی...';
    try { await enableMobilePush(); btn.textContent = 'اعلان‌ها فعال هستند'; if (status) status.textContent = 'اعلان‌های این ساختمان روی این دستگاه فعال شد.'; toast('اعلان‌های موبایلی فعال شد'); }
    catch (err) { btn.textContent = 'تلاش دوباره برای فعال‌سازی'; if (status) status.textContent = err.message || 'فعال‌سازی اعلان‌ها ناموفق بود'; showErr(err); }
    finally { btn.disabled = false; }
  });
  $('#go-profile')?.addEventListener('click', e => e.preventDefault());
  $('#pf2').addEventListener('submit', async e => {
    e.preventDefault();
    if ($('#p-np').value !== $('#p-np2').value) { toast('تکرار رمز یکسان نیست', true); return; }
    const passwordChanged = !!$('#p-np').value;
    let hadPushSubscription = false;
    if (passwordChanged && 'Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      try {
        const registration = await getPushServiceWorker();
        hadPushSubscription = !!(await registration.pushManager.getSubscription());
      } catch (_) {}
    }
    try {
      const updated = await T('app_update_profile', {
        p_full_name: $('#p-n').value,
        p_phone: $('#p-ph').value,
        p_email: $('#p-e').value,
        p_username: $('#p-u').value,
        p_current_password: $('#p-c').value || null,
        p_new_password: $('#p-np').value || null
      });
      if (updated?.ok === false) throw new Error(updated.error || 'ذخیره مشخصات انجام نشد');
      S.me = updated;
      sessionStorage.setItem('bm_me', JSON.stringify(S.me));
      let pushWarning = '';
      if (passwordChanged && hadPushSubscription) {
        try {
          await enableMobilePush();
        } catch (pushErr) {
          const message = String(pushErr?.message || '');
          pushWarning = message.includes('این اشتراک اعلان قبلاً به حساب دیگری متصل شده است')
            ? 'اعلان‌های این گوشی برای حساب دیگری فعال است.'
            : 'فعال‌سازی دوباره اعلان‌ها انجام نشد؛ صفحه را تازه‌سازی کنید.';
        }
      }
      toast(pushWarning ? `ذخیره شد؛ ${pushWarning}` : 'ذخیره شد', !!pushWarning);
      renderShell();
    } catch (err) { showErr(err); }
  });
}

window.addEventListener('online', () => toast('اتصال اینترنت برقرار شد'));
window.addEventListener('offline', () => toast('اتصال اینترنت قطع شد', true));
const BACK_EXIT_WINDOW_MS = 2000;
let backPressCount = 0; let backPressTimer = null; let appHistoryReady = false;

function resetBackPress() { backPressCount = 0; if (backPressTimer) { clearTimeout(backPressTimer); backPressTimer = null; } }
function ensureAppHistory() {
  const current = history.state;
  if (!current?.app) {
    history.replaceState({ app: true, view: S.view || 'dash', root: true }, '', '#app');
    history.pushState({ app: true, view: S.view || 'dash', guard: true }, '', '#app');
  } else if (!current.guard) {
    history.pushState({ ...current, app: true, view: S.view || current.view || 'dash', guard: true }, '', '#app');
  }
  appHistoryReady = true;
}
function rearmHistoryGuard() { history.pushState({ app: true, view: S.view || 'dash', guard: true }, '', '#app'); }

function handleBackNavigation(event) {
  const openModals = document.querySelectorAll('.modal-bg');
  if (openModals.length) { openModals[openModals.length - 1].remove(); return; }
  if (event?.state?.modal) { rearmHistoryGuard(); return; }
  if (!appHistoryReady) { ensureAppHistory(); return; }
  if (S.me && S.view !== 'dash') {
    resetBackPress(); go('dash', true);
    history.replaceState({ app: true, view: 'dash', guard: true }, '', '#app'); return;
  }
  if (!S.me) { resetBackPress(); rearmHistoryGuard(); return; }
  if (backPressCount === 0) {
    backPressCount = 1; toast('برای خروج، دوباره دکمه بازگشت را بزنید', true); clearTimeout(backPressTimer);
    backPressTimer = setTimeout(() => { backPressCount = 0; backPressTimer = null; }, BACK_EXIT_WINDOW_MS);
    rearmHistoryGuard(); return;
  }
  resetBackPress(); history.back();
}

window.addEventListener('popstate', handleBackNavigation);
ensureAppHistory();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { resetBackPress(); } });
document.addEventListener('click', e => { if (!e.target.closest('.menu-dropdown')) { $('#main-menu')?.classList.remove('show'); } });
if (S.token) renderShell(); else renderLogin();
