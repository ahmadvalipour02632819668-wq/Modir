(function (window) {
let html2CanvasPromise = null;
function loadHtml2Canvas() {
  if (typeof window.html2canvas === 'function') return Promise.resolve(window.html2canvas);
  if (!html2CanvasPromise) {
    html2CanvasPromise = new Promise((resolve, reject) => {
      const sources = [
        'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
      ];
      const loadNext = (index) => {
        if (index >= sources.length) { reject(new Error('بارگذاری ابزار ساخت تصویر ناموفق بود؛ اتصال اینترنت را بررسی کنید.')); return; }
        const script = document.createElement('script');
        script.src = sources[index];
        script.async = true;
        script.onload = () => typeof window.html2canvas === 'function'
          ? resolve(window.html2canvas)
          : loadNext(index + 1);
        script.onerror = () => loadNext(index + 1);
        document.head.appendChild(script);
      };
      loadNext(0);
    }).catch(error => { html2CanvasPromise = null; throw error; });
  }
  return html2CanvasPromise;
}
async function viewTx(el) {
  const admin = S.me.is_admin; if (!S.txFilter) S.txFilter = { y: String(S.y), m: '', unit: '', type: '' }; const f = S.txFilter;
  const unitParam = admin && f.unit !== '' ? +f.unit : null;
  const [list, units] = await Promise.all([
    T('app_get_transactions', { p_year: f.y ? +f.y : null, p_month: f.m ? +f.m : null, p_unit: unitParam }),
    admin ? T('app_get_units') : Promise.resolve([])
  ]);
  const rows = list.filter(t => !f.type || t.tx_type === f.type);
  const inc = rows.filter(t => t.tx_type === 'درآمد').reduce((s, t) => s + t.amount, 0); const exp = rows.filter(t => t.tx_type === 'هزینه').reduce((s, t) => s + t.amount, 0);
  const residencyIssues = admin ? (units.length ? units.filter(u=>u.residency_issue) : [{unit_no:null,residency_issue:'هنوز واحدی برای ساختمان ثبت نشده است'}]) : [];
  const phoneOf = u => { const un = units.find(x => x.unit_no === u); const a = un?.accounts.find(a => a.is_primary && a.is_active) || un?.accounts[0]; return a?.phone; };
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;gap:12px;flex-wrap:wrap"><div><h1>تراکنش‌ها</h1><p class="sub" style="margin:0">درآمد ${fmt(inc)} · هزینه ${fmt(exp)} · ${fa(rows.length)} ردیف</p></div><div style="display:flex;gap:10px;flex-wrap:wrap">${admin && !residencyIssues.length ? '<button class="btn sf" id="tx-charge">ثبت شارژ</button><button class="btn lt" id="tx-new">ثبت تراکنش</button>' : ''}<button class="btn lt" id="tx-csv">خروجی اکسل</button></div></div>${admin && residencyIssues.length ? `<div class="card" style="margin:-8px 0 16px;border-color:var(--danger);background:var(--bg)"><b style="color:var(--danger)">ثبت تمام تراکنش‌های مالی این ساختمان مسدود است.</b><p class="sub" style="margin:8px 0 0">ابتدا در بخش «مدیریت واحدها» وضعیت سکونت این واحدها را مشخص و تأیید کنید: ${residencyIssues.map(u=>(u.unit_no?'واحد '+fa(u.unit_no)+' ':'')+'('+esc(u.residency_issue)+')').join('، ')}</p></div>` : ''}<div class="card no-print" style="margin-bottom:16px;padding:14px;display:flex;gap:8px;flex-wrap:wrap"><label class="f" style="width:110px">سال<select id="f-y"><option value="">همه</option>${ModirPeriodUi.yearOptions(f.y)}</select></label><label class="f" style="width:130px">ماه<select id="f-m">${ModirPeriodUi.monthOptions(f.m, true)}</select></label>${admin ? `<label class="f" style="width:130px">واحد<select id="f-u">${ModirPeriodUi.unitOptions(f.unit, true, true)}</select></label>` : ''}<label class="f" style="width:110px">نوع<select id="f-t"><option value="">همه</option><option value="درآمد" ${f.type === 'درآمد' ? 'selected' : ''}>درآمد</option><option value="هزینه" ${f.type === 'هزینه' ? 'selected' : ''}>هزینه</option><option value="بازپرداخت" ${f.type === 'بازپرداخت' ? 'selected' : ''}>بازپرداخت</option></select></label></div><div class="tbl-wrap"><table><thead><tr><th>تاریخ</th><th>واحد</th><th>نوع</th><th>محل</th><th>شرح</th><th>مبلغ</th><th>سکونت</th>${admin ? '<th></th>' : ''}</tr></thead><tbody>${rows.map(t => `<tr><td class="num">${fa(t.tx_date)}</td><td>${t.unit_no ? 'واحد ' + fa(t.unit_no) : '<b>ساختمان</b>'}</td><td>${t.tx_type === 'درآمد' ? '<span class="chip ok">درآمد</span>' : t.tx_type === 'بازپرداخت' ? '<span class="chip ex">بازپرداخت</span>' : '<span class="chip no">هزینه</span>'}${t.source === 'payment' ? ' <span class="chip pd">پرداخت</span>' : ''}</td><td>${esc(t.location || '—')}</td><td>${esc(t.description || '—')}</td><td>${money(t.amount)}</td><td class="muted">${esc(t.occupancy || '—')}</td>${admin ? `<td><div style="display:flex;gap:6px;flex-wrap:nowrap">${t.unit_no ? ModirSms.smsBtn(phoneOf(t.unit_no), `${S.building} - واحد ${t.unit_no}\n${t.tx_type === 'درآمد' ? 'دریافت' : 'ثبت'} ${fmt(t.amount)} تومان بابت ${t.description} ثبت شد.`) : ''}${t.source === "payment" ? (t.payment_corrected ? '<span class="chip pd">پرداخت اصلاح‌شده</span>' : '<button class="btn sf sm" data-correct="' + t.id + '">اصلاح پرداخت</button><span class="chip pd">پرداخت تأییدشده</span>') : t.source === "payment_correction" ? '<span class="chip pd">سند اصلاحی</span>' : '<button class="btn lt sm" data-edit="' + t.id + '">ویرایش</button><button class="btn rd sm" data-dl="' + t.id + '">حذف</button>'}</div></td>` : ''}</tr>`).join('') || `<tr><td colspan="${admin?8:7}" class="muted" style="text-align:center">تراکنشی نیست</td></tr>`}</tbody></table></div>`;
  $$('[data-edit], [data-dl]', el).forEach(b => { const tx = rows.find(t => String(t.id) === b.dataset.edit || String(t.id) === b.dataset.dl); if (tx?.source === 'account_exit_refund') b.remove(); });
  const upd = window.ModirTiming.debounce(() => { f.y = $('#f-y')?.value ?? ''; f.m = $('#f-m')?.value ?? ''; f.unit = $('#f-u')?.value ?? ''; f.type = $('#f-t')?.value ?? ''; go('tx'); }, 300);
  ['#f-y', '#f-m', '#f-u', '#f-t'].forEach(s => $(s)?.addEventListener('change', upd));
  $('#tx-csv')?.addEventListener('click', () => exportCsv(rows)); if (!admin) return;
  $('#tx-charge')?.addEventListener('click', () => go('charge')); $('#tx-new')?.addEventListener('click', () => txModal(null, units));
    // دکمه ویرایش تراکنش
  $$('[data-edit]').forEach(b => b.addEventListener('click', () => {
    const tx = rows.find(t => t.id == b.dataset.edit);
    if (tx) txModal(tx, units);
  }));
  $$('[data-correct]').forEach(b => b.addEventListener('click', async () => {
    const reason = prompt('دلیل اصلاح این پرداخت را بنویسید (حداقل ۵ نویسه):');
    if (reason === null) return;
    if (reason.trim().length < 5) { toast('دلیل اصلاح باید حداقل ۵ نویسه باشد', true); return; }
    if (!confirm('یک سند معکوس برای کل مبلغ این پرداخت ثبت شود؟ تراکنش اصلی حذف یا ویرایش نمی‌شود.')) return;
    b.disabled = true;
    try {
      await T('app_admin_correct_approved_payment', { p_id: +b.dataset.correct, p_reason: reason.trim() });
      toast('سند اصلاحی ثبت شد و مانده بدهی دوباره محاسبه می‌شود');
      go('tx');
    } catch (e) { showErr(e); b.disabled = false; }
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

  const m = window.ModirModal.open(`
    <h2>${isNew ? 'ثبت تراکنش جدید' : 'ویرایش تراکنش'}</h2>
    <form id="tf" class="grid g2" style="gap:16px">
      <label class="f">نوع
        <select id="t-type">
          <option value="درآمد" ${t.tx_type === 'درآمد' ? 'selected' : ''}>درآمد (دریافت)</option>
          <option value="هزینه" ${t.tx_type === 'هزینه' ? 'selected' : ''}>هزینه (پرداخت)</option>
        </select>
      </label>
      <label class="f" id="wrap-unit"><span id="unit-label">واحد</span>
        <select id="t-unit">${ModirPeriodUi.unitOptions(t.unit_no ?? 0, true)}</select>
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
        <div class="grid g2">${jalaliDatePicker('از تاریخ','',t.bill_period_start ? ModirManagement.gregorianToJalaliDate(t.bill_period_start) : '', 'bill-period-start',false)}
        ${jalaliDatePicker('تا تاریخ','',t.bill_period_end ? ModirManagement.gregorianToJalaliDate(t.bill_period_end) : '', 'bill-period-end',false)}</div>
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
  $$( 'input[name="expense-kind"]',m).forEach(x=>x.addEventListener('change',updateFormUI));
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
        if(isBill){billStart=ModirManagement.jalaliToGregorianDate($('#bill-period-start',m).value);billEnd=ModirManagement.jalaliToGregorianDate($('#bill-period-end',m).value);if(billEnd<billStart)throw new Error('تاریخ پایان دوره قبض نباید قبل از شروع باشد');}
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
        <label class="f">از ماه<select id="range-from-month">${ModirPeriodUi.monthOptions(fromM)}</select></label><label class="f">از سال<select id="range-from-year">${ModirPeriodUi.yearOptions(fromY)}</select></label>
        <label class="f">تا ماه<select id="range-to-month">${ModirPeriodUi.monthOptions(toM)}</select></label><label class="f">تا سال<select id="range-to-year">${ModirPeriodUi.yearOptions(toY)}</select></label>
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
    $('#range-bale-btn')?.addEventListener('click',async()=>{const b=$('#range-bale-btn'),c=$('#range-report-content');if(!b||!c)return;const old=b.textContent;b.disabled=true;try{b.textContent='در حال ساخت تصویر...';const renderCanvas=await loadHtml2Canvas();const canvas=await renderCanvas(c,{backgroundColor:'#fff',scale:2,useCORS:true,logging:false});const ok=await notifyBale(`📊 گزارش بازه‌ای `+(c.dataset.rangeTitle||'')+`\n`+(S.me?.building_name||S.building),canvas.toDataURL('image/jpeg',0.88));if(!ok)throw new Error('ارسال گزارش به بله ناموفق بود');toast('گزارش بازه‌ای به گروه بله ارسال شد');}catch(err){showErr(err)}finally{b.textContent=old;b.disabled=false}});
    return;
  }
  const [rep, reportTransactions] = await Promise.all([
    T('app_report',{p_year:S.y,p_month:S.m}),
    T('app_get_transactions',{p_year:S.y,p_month:S.m,p_unit:null})
  ]);
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:12px;flex-wrap:wrap"><div><h1 style="margin:0">گزارش `+rep.month_name+` `+fa(rep.year)+`</h1></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">`+ModirPeriodUi.periodPicker()+`<button class="btn lt" id="report-range-mode">گزارش بازه‌ای</button><button class="btn sf no-print" id="bale-btn">ارسال به بله 📤</button><button class="btn lt no-print" id="pr-btn">چاپ</button></div></div>
  <div class="tbl-wrap report-table-wrap" style="border-radius:16px;overflow-x:auto;border:1px solid #e5e9f0;background:#fff;width:100%;box-shadow:0 5px 18px rgba(35,45,80,.06)"><table style="width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;font-size:14px;font-weight:600;text-align:center;direction:rtl;background:#fff"><thead><tr><th colspan="7" style="background:#303b70;color:white;padding:13px;border:0;font-size:15px">گزارش `+rep.month_name+` ماه - `+fa(rep.year)+`/`+String(rep.month).padStart(2,'0')+`</th></tr><tr>`+['واحد','شارژ','قبض آب','قبض گاز','پس‌انداز','بدهی قبلی','جمع مبلغ قابل پرداخت'].map(x=>`<th style="background:#eef1f8;color:#394366;border:1px solid #cbd3df;padding:8px 6px;font-size:12px">`+x+`</th>`).join('')+`</tr></thead><tbody>`+(rep.rows||[]).map(r=>{
    const shared=(reportTransactions||[]).flatMap(t=>{if(t.tx_type!=='هزینه'||Number(t.ym)!==Number(S.y)*100+Number(S.m))return[];let a=t.expense_shares;if(typeof a==='string'){try{a=JSON.parse(a)}catch(_){a=[]}}if(!Array.isArray(a))return[];const sh=a.find(x=>String(x.account_id||'')===String(r.account_id||''));return sh?[{id:t.id,cat:String(t.category||'').toLowerCase(),amount:Number(sh.amount)||0}]:[]});
    const items=c=>shared.filter(x=>x.cat===c),sum=a=>a.reduce((n,x)=>n+x.amount,0),status=(base,paid,cat)=>({amount:(Number(base)||0)+sum(items(cat)),paid:(Number(base)<=0||!!paid)&&items(cat).every(x=>(reportTransactions||[]).filter(t=>Number(t.ym)===Number(S.y)*100+Number(S.m)&&String(t.account_id||'')===String(r.account_id||'')&&t.tx_type==='درآمد'&&String(t.category||'')==='expense:'+x.id).reduce((n,t)=>n+(Number(t.amount)||0),0)>=x.amount)});
    const c=status(r.charge,r.ok_charge,'charge'),w=status(r.water,r.ok_water,'water'),g=status(r.gas,r.ok_gas,'gas'),p=status(r.repair,r.ok_repair,'repair'),bg=(a,ok)=>Number(a)<=0?'#f1f3f6':(ok?'#e2f3e8':'#fde8e7'),cell=(color,val)=>`<td style="background:`+color+`;border:1px solid #aeb9c8;padding:7px 6px;color:#25304a;font-weight:700;white-space:nowrap">`+fmt(val)+`</td>`;
    return `<tr><td style="background:#f5f6fa;border:1px solid #cbd3df;padding:6px 5px;font-weight:800">واحد `+fa(r.unit_no)+`<div style="font-size:11px;font-weight:normal">`+esc(r.occupancy||'')+`</div></td>`+cell(bg(c.amount,c.paid),c.amount)+cell(bg(w.amount,w.paid),w.amount)+cell(bg(g.amount,g.paid),g.amount)+cell(bg(p.amount,p.paid),p.amount)+cell(Number(r.prev_debt)>0?'#fff0d6':'#f1f3f6',r.prev_debt)+cell(Number(r.remaining)<=0?'#dff3e6':'#fde5e5',r.remaining)+`</tr>`;
  }).join('')||'<tr><td colspan="7">اطلاعاتی برای این دوره وجود ندارد.</td></tr>'`+</tbody></table></div>`;
  ModirPeriodUi.bindPeriod(()=>go('report'));
  $('#report-range-mode')?.addEventListener('click',()=>{S.reportMode='range';S.rangeFromYear=S.y;S.rangeFromMonth=S.m;S.rangeToYear=S.y;S.rangeToMonth=S.m;go('report')});
  $('#pr-btn')?.addEventListener('click',()=>{const table=$('.report-table-wrap table');const rows=table?.querySelectorAll('tbody tr').length||1;const estimatedHeight=rows*23+105;const scale=Math.max(.42,Math.min(.82,720/estimatedHeight));document.documentElement.style.setProperty('--report-print-scale',String(scale));window.print();});
  $('#bale-btn')?.addEventListener('click',async()=>{const b=$('#bale-btn'),table=$('.tbl-wrap table');if(!b||!table)return;const old=b.textContent;b.disabled=true;try{b.textContent='در حال ساخت تصویر...';const renderCanvas=await loadHtml2Canvas();const canvas=await renderCanvas(table,{backgroundColor:'#fff',scale:2,useCORS:true,logging:false});const ok=await notifyBale(`📊 گزارش ماهانه `+rep.month_name+` `+fa(rep.year)+`\n`+(S.me?.building_name||S.building),canvas.toDataURL('image/jpeg',0.88));if(!ok)throw new Error('ارسال گزارش به بله ناموفق بود');toast('گزارش با موفقیت به گروه بله ارسال شد')}catch(err){showErr(err)}finally{b.textContent=old;b.disabled=false}});
}

  // Public finance API: entry points used by the application shell.
  window.ModirFinance = Object.freeze({
    viewTx,
    viewReport
  });
})(window);
