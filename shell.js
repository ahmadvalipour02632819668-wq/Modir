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


async function viewServices(el) {
  const items = ModirMenuUi.getMenuItems().filter(([k]) => k !== 'dash');
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
      <div class="tiles">${list.map(([k, l], i) => `<button class="tile" data-v="${k}" style="animation-delay:${i * 50}ms">${k === 'neighbor-alerts' ? `<svg class="neighbor-alert-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 42 38H6L24 5Z" fill="#ef4444"><animate attributeName="opacity" values="1;0.35;1" dur="0.8s" repeatCount="indefinite"/></path><path d="M24 17v10" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="33" r="2" fill="#fff"/></svg>` : ModirIcons.ico(k)}<span>${esc(l)}</span></button>`).join('')}</div></div>`;
  }).join('');
  $$('.tile', el).forEach(b => b.addEventListener('click', () => go(b.dataset.v)));
}

async function renderShell() {
  const renderId = ++S.renderId;
  $('#app').innerHTML = `<div class="loading-screen"><div class="spinner"></div><p class="sub">در حال اتصال به سرور...</p></div>`;
  try {
    const account = await T('app_me');
    if (renderId !== S.renderId) return;
    S.me = account; S.unitCount = Number(account.units_count || S.unitCount || 10); S.building = account.building_name || S.building; sessionStorage.setItem('bm_me', JSON.stringify(S.me));
    ModirAssistant.mount();
  } catch (e) {
    if (e.message === 'AUTH_ERROR') { logout(true); return; }
    if (e.message === 'NETWORK_ERROR') { showConnectionError(); return; }
    showErr(e); return;
  }

  S.avatarData = null;

  const curTheme = localStorage.getItem('bm_theme') || 'default';

  $('#app').innerHTML = `
    <header class="top">
      <div class="top-in">
        <button class="ic-btn avatar" id="who-btn" aria-label="رفتن به تنظیمات" title="تنظیمات">${S.avatarData ? `<img src="${esc(S.avatarData)}" alt="عکس پروفایل" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : ICONS.profile.replace('<svg','<svg width="26" height="26"')}</button>
        <div class="appbar-title" id="appbar-title"></div>
        <button class="ic-btn" id="go-req" aria-label="${S.me.is_admin ? 'اعلان‌های مدیر' : 'پیام‌ها'}" title="${S.me.is_admin ? 'موارد نیازمند رسیدگی' : 'پیام‌ها'}" style="position:relative">${S.me.is_admin ? '<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>' : '<svg width="26" height="26" viewBox="0 0 48 48" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"><path d="M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H20l-8 7v-7a4 4 0 0 1-4-4z"/><g fill="#fff" stroke="none"><circle cx="17" cy="20" r="2.4"/><circle cx="24" cy="20" r="2.4"/><circle cx="31" cy="20" r="2.4"/></g></svg>'}<span id="manager-alert-count" style="display:none;position:absolute;top:-3px;right:-3px;min-width:19px;height:19px;padding:0 5px;border-radius:99px;background:#ef4444;color:#fff;font-size:11px;font-weight:900;line-height:19px;text-align:center;border:2px solid var(--navy)"></span></button>
        <button class="ic-btn logout-top" id="direct-logout" title="خروج از حساب">${ModirIcons.ICONS.logout.replace('<svg','<svg width="22" height="22"')}</button>
        <div id="alert-center" style="display:none"></div>
      </div>
    </header>
    <main id="view"></main>
    <nav class="bnav"><div class="bnav-in">
      <div class="bnav-bg"></div>
      <div class="bnav-diamond" id="bnav-dia"><span></span></div>
      <div class="bnav-items">
        ${ModirMenuUi.navItems().map(([k, l]) => `<button data-v="${k}">${ModirIcons.LINE_ICONS[k] || ModirIcons.ico(k)}<span>${esc(l)}</span></button>`).join('')}
      </div>
    </div></nav>`;

  $('#direct-logout').addEventListener('click', () => logout());
  $('#who-btn').addEventListener('click', () => go('settings'));
  
  $$('.theme-dot').forEach(d => d.addEventListener('click', () => window.ModirTheme.setTheme(d.dataset.t)));

  $('#go-req').addEventListener('click', async () => {
    const panel = $('#alert-center');
    if (panel?.style.display === 'block') { panel.style.display = 'none'; return; }
    try { ModirAlertCenter.renderAlertCenter(await ModirAlertCenter.collectAlertItems({ force: true })); }
    catch (error) { console.warn('Alert center could not be opened:', error); }
  });
  if (window.__modirManagerAlertTimer) clearInterval(window.__modirManagerAlertTimer);
  window.__modirManagerAlertTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && S.me?.is_admin) {
      ModirAlertCenter.refreshManagerAlertBadge();
    }
  }, 60000);
  if (!window.__modirVisibilityHandler) {
    window.__modirVisibilityHandler = () => {
      if (document.visibilityState === 'visible' && S.me?.is_admin) ModirAlertCenter.refreshManagerAlertBadge();
    };
    document.addEventListener('visibilitychange', window.__modirVisibilityHandler);
  }
  document.querySelectorAll('.bnav-items button').forEach(b => b.addEventListener('click', () => go(b.dataset.v)));
  if (!window.__modirResizeHandler) {
    window.__modirResizeHandler = window.ModirTiming.debounce(() => renderShellHeaderState(false), 100);
    window.addEventListener('resize', window.__modirResizeHandler);
  }
  if ('serviceWorker' in navigator && window.isSecureContext) getPushServiceWorker().catch(err => console.warn('Service worker registration failed:', err));
  go(S.view);
  const avatarToken = S.token;
  T('app_profile_avatar_get').then(data => {
    if (S.token !== avatarToken || !S.me) return;
    S.avatarData = data || null;
    const avatarButton = $('#who-btn');
    if (avatarButton && data) avatarButton.innerHTML = '<img src="' + esc(data) + '" alt="عکس پروفایل" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
  }).catch(avatarErr => console.warn('Profile photo could not be loaded:', avatarErr));
  setTimeout(maybeAskForPushPermission, 500);
}

function go(v, isBackNavigation = false) {
  const views = {
    dash: ModirDashboard.viewDash, announcements: ModirCommunity.viewAnnouncements, 'neighbor-alerts': ModirCommunity.viewNeighborAlerts, requests: ModirCommunity.viewRequests, tx: ModirFinance.viewTx, pay: ModirCommunity.viewPay,
    report: ModirFinance.viewReport, units: ModirManagement.viewUnits, rates: ModirManagement.viewRates, charge: ModirManagement.viewRates, settings: ModirManagement.viewSettings, activity: ModirManagement.viewActivity, profile: ModirManagement.viewProfile, services: viewServices,
  };
  if (!views[v]) v = 'dash';
  S.view = v;
  const el = $('#view'); if (!el) return;
  el.innerHTML = `<p class="sub">در حال بارگذاری...</p>`;
  renderShellHeaderState();
  if (S.me?.is_admin) ModirAlertCenter.refreshManagerAlertBadge();
  const currentRenderId = ++S.renderId;
  Promise.resolve(views[v](el)).then(() => { if (v === 'dash') ModirPwa.renderInstallBanner(); }).catch(e => {
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
  const all = [...ModirMenuUi.getMenuItems(), ['services', 'خدمات']];
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


