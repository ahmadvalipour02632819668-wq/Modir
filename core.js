
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
  const v=ModirManagement.normalizeJalaliDigits(value), p=/^(\d{4})\/(\d{2})\/(\d{2})$/.exec(v);
  const y=p?+p[1]:TODAY.y, mo=p?+p[2]:TODAY.m, d=p?+p[3]:0, years=Array.from({length:201},(_,i)=>1300+i);
  const yearOpts=years.map(n=>'<option value="'+n+'" '+(n===y?'selected':'')+'>'+fa(n)+'</option>').join('');
  const monthOpts=MONTHS.map((n,i)=>'<option value="'+(i+1)+'" '+(i+1===mo?'selected':'')+'>'+n+'</option>').join('');
  return '<label class="f">'+label+'<div class="jalali-calendar" data-jalali-picker><div class="jalali-calendar-head"><select data-jp-month aria-label="ماه">'+monthOpts+'</select><select data-jp-year aria-label="سال">'+yearOpts+'</select></div><div class="jalali-calendar-week">'+['ش','ی','د','س','چ','پ','ج'].map(x=>'<span>'+x+'</span>').join('')+'</div><div class="jalali-calendar-days" data-jp-days>'+jalaliCalendarDays(y,mo,d)+'</div></div><input type="hidden" '+(id?'id="'+id+'" ':'')+(name?'name="'+name+'" ':'')+(required?'required ':'')+'value="'+(p?v:'')+'"></label>';
}
function jalaliCalendarDays(y,m,selected) {
  const first=ModirManagement.jalaliToGregorianDate(y+'/'+String(m).padStart(2,'0')+'/01');
  const offset=(new Date(first+'T00:00:00Z').getUTCDay()+1)%7, count=ModirManagement.jalaliMonthDays(y,m);
  return Array.from({length:offset},()=>'<span class="jalali-calendar-empty"></span>').join('')+
    Array.from({length:count},(_,i)=>{const day=i+1;return '<button type="button" class="jalali-day '+(day===selected?'selected':'')+'" data-jp-day="'+day+'" aria-label="روز '+fa(day)+'">'+fa(day)+'</button>';}).join('');
}
document.addEventListener('change',e=>{
  const picker=e.target.closest('[data-jalali-picker]'); if(!picker)return;
  const y=Number(picker.querySelector('[data-jp-year]').value),m=Number(picker.querySelector('[data-jp-month]').value);
  const hidden=picker.parentElement.querySelector('input[type="hidden"]'),old=Number(hidden.value.split('/')[2])||0,max=ModirManagement.jalaliMonthDays(y,m),day=Math.min(old,max);
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
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  try {
    const request = sb.rpc(fn, args, controller ? { signal: controller.signal } : undefined);
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        if (controller) controller.abort();
        reject(new Error('NETWORK_ERROR'));
      }, 20000);
    });
    const { data, error } = await Promise.race([request, timeout]);
    if (error) {
      const rawMsg = error.message || '';
      if (rawMsg.includes('AUTH_REQUIRED')) { logout(true); throw new Error('AUTH_ERROR'); }
      if (error.name === 'AbortError' || isNetworkError(rawMsg)) throw new Error('NETWORK_ERROR');
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
