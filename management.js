(function (window) {\nconst { normalizeJalaliDigits, jalaliToGregorianDate, gregorianToJalaliDate, jalaliMonthDays } = window.ModirJalaliDate;\n
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
  const [rates, rateGuardUnits, st, baleCfg] = await Promise.all([
    T('app_get_rates'),
    T('app_get_units'),
    S.view === 'charge' ? Promise.resolve({}) : T('app_get_settings'),
    S.view === 'charge' ? Promise.resolve(null) : T('app_admin_get_bale_config')
  ]);
  const rateGuardIssues = rateGuardUnits.length ? rateGuardUnits.filter(u=>u.residency_issue) : [{unit_no:null,residency_issue:'هنوز واحدی برای ساختمان ثبت نشده است'}];
  const rateGuardWarning = rateGuardIssues.length ? `<div class="card" style="margin-bottom:16px;border-color:var(--danger)"><b style="color:var(--danger)">ثبت، ویرایش و حذف نرخ شارژ و پس‌انداز تا تعیین تکلیف تمام واحدها مسدود است.</b><p class="sub" style="margin:8px 0 0">${rateGuardIssues.map(u=>(u.unit_no?'واحد '+fa(u.unit_no)+': ':'')+esc(u.residency_issue)).join(' · ')}</p><button class="btn sf sm" style="margin-top:10px" type="button" data-go="units">تعیین وضعیت واحدها</button></div>` : '';
  const getPayers = arr => !arr ? 'همه' : arr.length === 0 ? 'هیچ‌کس' : arr.map(o => esc(String(o).replace('مالک ساکن', 'ساکن'))).join('، ');
  let retainedParking = 0, retainedPayerParking = [...OCC], retainedPayerWater = [...OCC], retainedPayerGas = [...OCC];
  el.innerHTML = `<h1>${S.view === 'charge' ? 'ثبت شارژ' : 'تنظیمات ساختمان'}</h1>${rateGuardWarning}<div class="grid g2"><div><h2 style="margin-bottom:16px">لیست نرخ‌های ثبت شده</h2><div id="rates-accordion">${rates.map(r => `<div class="accordion-item"><div class="accordion-header"><span>📅 ${MONTHS[r.month - 1]} ${fa(r.year)}</span><span class="chip ex" style="font-size:11px">مشاهده ▼</span></div><div class="accordion-body"><table style="margin-bottom:16px"><tbody><tr><td style="border:0"><b>شارژ:</b> ${money(r.charge)}<br><small style="color:var(--muted)">${getPayers(r.payer_charge)}</small></td><td style="border:0"><b>پس‌انداز:</b> ${money(r.repair)}<br><small style="color:var(--muted)">${getPayers(r.payer_repair)}</small></td></tr></tbody></table><div style="display:flex;gap:8px"><button class="btn lt sm" data-er="${r.year}-${r.month}" ${rateGuardIssues.length?'disabled title="ابتدا وضعیت تمام واحدها را تأیید کنید"':''}>ویرایش</button><button class="btn rd sm" data-dr="${r.year}-${r.month}" ${rateGuardIssues.length?'disabled title="ابتدا وضعیت تمام واحدها را تأیید کنید"':''}>حذف</button></div></div></div>`).join('') || '<p class="sub">هیچ نرخی ثبت نشده است.</p>'}</div></div><div class="grid" style="align-content:start"><form id="rf" class="card grid g3"><h2 style="grid-column:1/-1;margin:0">ثبت / ویرایش نرخ</h2><label class="f">سال<select id="r-y">${ModirPeriodUi.yearOptions(TODAY.y)}</select></label><label class="f">ماه<select id="r-m">${ModirPeriodUi.monthOptions(TODAY.m)}</select></label><label class="f">شارژ<input id="r-c" inputmode="numeric"></label><div style="grid-column:1/-1;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap">پرداخت‌کننده شارژ: ${OCC.map(o => `<label style="display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" value="${o}" class="r-pch" checked> ${o.replace('مالک ساکن','ساکن')}</label>`).join('')}</div><label class="f">پس‌انداز<input id="r-r" inputmode="numeric"></label><div style="grid-column:1/-1;font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap">پرداخت‌کننده پس‌انداز: ${OCC.map(o => `<label style="display:flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" value="${o}" class="r-prp" checked> ${o.replace('مالک ساکن','ساکن')}</label>`).join('')}</div><div style="grid-column:1/-1"><button class="btn sf" type="submit" ${rateGuardIssues.length?'disabled title="ابتدا وضعیت تمام واحدها را تأیید کنید"':''}>ذخیره نرخ</button></div></form><form id="sf" class="card grid g3"><h2 style="grid-column:1/-1;margin:0">تنظیمات کلی</h2><label class="f" style="grid-column:1/-1">نام ساختمان<input id="s-n" value="${esc(st.building_name || '')}"></label><label class="f">موجودی اولیه صندوق<input id="s-o" inputmode="numeric" value="${fmt(st.opening_balance)}"></label><label class="f">سال شروع محاسبه<select id="s-s-y">${ModirPeriodUi.yearOptions(Number(String(st.start_ym || '').slice(0,4)) || TODAY.y)}</select></label><label class="f">ماه شروع محاسبه<select id="s-s-m">${ModirPeriodUi.monthOptions(Number(String(st.start_ym || '').slice(4)) || TODAY.m)}</select></label><div style="align-self:end"><button class="btn" type="submit">ذخیره تنظیمات</button></div></form><form id="bale-settings-form" class="card grid" style="gap:12px"><h2 style="margin:0">اتصال به پیام‌رسان بله</h2><p class="sub" style="margin:0">با ذخیره این اطلاعات، تمام اعلان‌های همین ساختمان به گروه یا چت انتخاب‌شده ارسال می‌شود. توکن ربات به‌صورت محرمانه در سرور نگهداری می‌شود.</p><label class="f">توکن ربات بله<input id="bale-bot-token" dir="ltr" autocomplete="off" type="password" placeholder="${baleCfg?.configured ? 'توکن ثبت شده؛ برای تغییر، توکن جدید را وارد کنید' : 'توکن ربات را وارد کنید'}" autocorrect="off" autocapitalize="off" spellcheck="false"></label><label class="f">شناسه گروه / چت مقصد<input id="bale-chat-id" dir="ltr" value="${esc(baleCfg?.chat_id || '')}" placeholder="شناسه گروه یا چت مقصد"></label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn" type="submit">ذخیره اتصال بله</button><button class="btn lt" type="button" id="bale-discover">پیدا کردن خودکار گروه</button>${baleCfg?.configured ? '<button class="btn rd" type="button" id="bale-disconnect">قطع اتصال بله</button>' : ''}<span class="chip ${baleCfg?.configured ? 'ok' : 'pd'}">${baleCfg?.configured ? 'اتصال تنظیم شده' : 'هنوز متصل نشده'}</span></div><div id="bale-discovery-result" class="sub" style="margin:0"></div><p class="sub" style="margin:0">برای ویرایش، توکن یا شناسه مقصد را تغییر دهید و ذخیره کنید. خالی گذاشتن توکن، توکن قبلی را حفظ می‌کند. برای پیدا کردن خودکار گروه، اگر اتصال قبلی ندارید توکن ربات را وارد کنید؛ سپس گروهی را که ربات در آن پیام دریافت کرده انتخاب کنید.</p></form></div></div>`;
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
  el.innerHTML = `${ModirAccountUi.mustChangeBanner()}<h1>پروفایل</h1>
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

  // Public management API: views and shared Jalali date utilities.
  window.ModirManagement = Object.freeze({
    viewUnits,
    viewRates,
    viewSettings,
    viewActivity,
    viewProfile,
    normalizeJalaliDigits,
    jalaliToGregorianDate,
    gregorianToJalaliDate,
    jalaliMonthDays
  });
})(window);
