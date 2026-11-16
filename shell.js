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
    dash: ModirDashboard.viewDash, announcements: ModirCommunity.viewAnnouncements, 'neighbor-alerts': ModirCommunity.viewNeighborAlerts, requests: ModirCommunity.viewRequests, tx: ModirFinance.viewTx, pay: ModirCommunity.viewPay,
    report: ModirFinance.viewReport, units: viewUnits, rates: viewRates, charge: viewRates, settings: viewSettings, activity: viewActivity, profile: viewProfile, services: viewServices,
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

