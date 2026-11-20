(function (window) {
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
  const chg = (Number(r.charge) || 0) + chargeExpense;
  const w = (Number(r.water) || 0) + waterExpense;
  const g = (Number(r.gas) || 0) + gasExpense;
  const rep_amt = (Number(r.repair) || 0) + repairExpense;
  const park = Number(r.parking) || 0;
  const extraExpenses = expenseItems.filter(x =>
    !isExpenseFor(x, 'charge', ['شارژ']) &&
    !isExpenseFor(x, 'water', ['آب']) &&
    !isExpenseFor(x, 'gas', ['گاز']) &&
    !isExpenseFor(x, 'repair', ['پس‌انداز', 'تعمیر'])
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
          <div style="display:flex;align-items:center;gap:10px"><button class="eye" type="button">${ModirDashboardUi.EYE}</button><span class="bc-amt" data-count="${rem}">${fmt(rem)}</span></div>
        </div>
        ${rem > 0 ? `<button class="btn sf sm" onclick="ModirCommunity.payModal(${r.unit_no || 'null'}, '${r.account_id || ''}')" style="background:var(--peach);color:var(--navy);border:none;padding:8px 16px;font-size:13px;font-weight:900;box-shadow:0 4px 12px rgba(247,174,116,.3);">💸 پرداخت بدهی</button>` : ''}
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
  const admin = !!S.me.is_admin;
  let rep, managerResidencyUnits = [], fund = null, residentRequests = [];
  if (admin) {
    [rep, managerResidencyUnits, fund] = await Promise.all([
      T('app_report', { p_year: S.y, p_month: S.m }),
      T('app_get_units'),
      T('app_fund_summary', { p_year: S.y, p_month: S.m })
    ]);
  } else {
    [rep, residentRequests] = await Promise.all([
      T('app_report', { p_year: S.y, p_month: S.m }),
      T('app_get_payment_requests')
    ]);
  }
  const managerResidencyIssues = admin ? (managerResidencyUnits.length ? managerResidencyUnits.filter(u=>u.residency_issue) : [{unit_no:null,residency_issue:'هنوز واحدی برای ساختمان ثبت نشده است'}]) : [];
  const residencyWarning = managerResidencyIssues.length ? `<div class="card" style="margin-bottom:16px;border-color:var(--danger);background:var(--bg)"><b style="color:var(--danger)">ثبت هرگونه تراکنش مالی تا تعیین تکلیف و تأیید تمام واحدها مسدود است.</b><p class="sub" style="margin:8px 0 0">واحدهای نیازمند اقدام: ${managerResidencyIssues.map(u=>(u.unit_no?'واحد '+fa(u.unit_no)+': ':'')+esc(u.residency_issue)).join(' · ')}</p><button class="btn sf sm" style="margin-top:10px" data-go="units">تعیین وضعیت واحدها</button></div>` : '';
  const missing = rep.missing_rates?.length ? `<div class="card" style="background:#fee2e2;color:#991b1b;margin-bottom:20px">مبالغ شارژ/پس‌انداز برای این ماه‌ها تعریف نشده: ${rep.missing_rates.map(fa).join('، ')}</div>` : '';

  if (!admin) {
    const r = rep.rows[0]; const reqs = residentRequests;
    el.innerHTML = `${ModirAccountUi.mustChangeBanner()}
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:8px">
        <div><h1>سلام ${esc(S.me.full_name || ('واحد ' + fa(S.me.unit_no)))} 👋</h1><p class="sub" style="margin:0">صورتحساب ${rep.month_name} ${fa(rep.year)}</p></div>
        ${ModirPeriodUi.periodPicker()}
      </div>
      <div><div class="sec-title">دسترسی سریع</div>
        <div class="quick">${[['pay','پرداخت بدهی'],['tx','تراکنش‌ها'],['announcements','اعلانات'],['requests','ارتباط با مدیر']].map(([k,l]) => `<button class="tile" data-go="${k}">${window.ModirIcons.ico(k)}<span>${l}</span></button>`).join('') + ModirPwa.installTileHtml()}</div></div>
      ${missing}
      <div style="margin-top:20px">${r ? billCard(r, rep) : '<p class="sub">صورتحسابی ثبت نشده.</p>'}</div>
      <div class="sec-title">سابقه پرداخت‌ها</div>
      ${reqTable(reqs.slice(0, 8), false)}`;
    ModirPeriodUi.bindPeriod(() => go('dash'));
    $('#go-profile')?.addEventListener('click', e => { e.preventDefault(); go('profile'); });
    $$('[data-go]', el).forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
   $$('[data-install]', el).forEach(b => b.addEventListener('click', ModirPwa.installPwa));
    ModirDashboardUi.countUp(el); ModirDashboardUi.bindEyes(el);
    return;
  }

  const rows = rep.rows || [];
  const unitCredits = rows.reduce((sum, row) => sum + Math.max(0, -(Number(row.remaining) || 0)), 0);
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
      ${ModirPeriodUi.periodPicker()}
    </div>
    ${missing}
    ${residencyWarning}
    ${ModirAccountUi.mustChangeBanner()}
    <div><div class="sec-title">دسترسی سریع</div>
      <div class="quick">${[['units','واحدها'],['pay','تایید پرداخت'],['announcements','اعلانات'],['settings','تنظیمات']].map(([k,l]) => `<button class="tile" data-go="${k}">${window.ModirIcons.ico(k)}${k==='pay' && +fund.pending_payments ? `<i class="badge">${fa(fund.pending_payments)}</i>` : ''}<span>${l}</span></button>`).join('') + ModirPwa.installTileHtml()}</div></div>
    <div class="grid dashboard-money-grid" style="margin:14px 0 12px">
      <div class="bank-card"><i class="shine"></i>
        <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px">صندوق ساختمان</b><span style="color:#ffd27a;font-size:20px">★</span></div>
        <div class="bc-row"><span>موجودی کل صندوق (تومان)</span></div>
        <div class="bc-row" style="margin-top:4px;justify-content:flex-start"><button class="eye" type="button">${ModirDashboardUi.EYE}</button><span class="bc-amt" data-count="${Number(fund.balance||0)}">${fmt(Number(fund.balance||0))}</span></div>
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.2);font-size:12px;line-height:2">
          <div class="bc-row"><span>بستانکاری واحدها</span><b>${fmt(unitCredits)}</b></div>
          <div class="bc-row"><span>موجودی آزاد و قابل استفاده</span><b>${fmt(Number(fund.balance||0))}</b></div></div>
        <div class="bc-row" style="margin-top:10px"><span></span><button class="pill" type="button" data-go="tx">گردش حساب</button></div>
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

  ModirPeriodUi.bindPeriod(() => go('dash'));
  $$('[data-go]', el).forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
   $$('[data-install]', el).forEach(b => b.addEventListener('click', ModirPwa.installPwa));
  ModirDashboardUi.countUp(el); ModirDashboardUi.bindEyes(el);
  setupPaymentScrollAnimation(el, unitMap);
  $('#go-pay')?.addEventListener('click', () => go('pay'));
  $('#go-profile')?.addEventListener('click', e => { e.preventDefault(); go('profile'); });
  $$('.win', el).forEach(b => b.addEventListener('click', () => {
    const uData = mapUnits.find(x => x.unit_no == b.dataset.u); if (!uData) return;
    const cardsHtml = uData.accounts.length ? uData.accounts.map(r => billCard(r, rep)).join('<hr style="border:0;border-top:1px dashed var(--line);margin:20px 0">') : '<p class="sub" style="text-align:center;padding:20px">حسابی برای این واحد ثبت نشده است.</p>';
    const smsHtml = uData.accounts.map(r => r.phone ? ModirSms.smsBtn(r.phone, reminderText(r, rep), `پیامک به ${r.full_name || r.occupancy}`) : '').join('');
const m = window.ModirModal.open(`
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
    const options = (p.options || []).map(o => {
      const percent = Math.max(0, Math.min(100, Number(o.percent) || 0));
      return `
      <div class="poll-option-row">
        <div class="poll-result-top">
          <span class="poll-option-label">${esc(o.text)}</span>
          <strong class="poll-option-result">${fa(Number(o.votes || 0))} رأی <b>${fa(percent.toFixed(1))}٪</b></strong>
        </div>
        <div class="poll-result-track" role="progressbar" aria-label="${esc(o.text)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
          <span class="poll-result-fill" style="width:${percent}%"></span>
        </div>
      </div>`;
    }).join('');
    const canVote = p.is_active && !p.my_vote;
    const voteForm = canVote ? `
      <form data-vote-form="${p.id}" style="margin-top:12px">
        <div class="poll-vote-list">
          ${(p.options || []).map(o => `<label class="poll-vote-choice"><input type="radio" name="poll-option-${p.id}" value="${o.id}" required><span>${esc(o.text)}</span><i aria-hidden="true">✓</i></label>`).join('')}
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
      <div class="card poll-card">
        <div class="poll-card-head">
          <h2 style="margin:0">${esc(p.title)}</h2>
          <span class="chip ${p.is_active ? 'ok' : 'ex'}">${p.is_active ? 'فعال' : 'غیرفعال'}</span>
        </div>
        ${p.description ? `<p class="sub" style="white-space:pre-wrap">${esc(p.description)}</p>` : ''}
        <div class="poll-results-list">${options}</div>
        <p class="sub" style="font-size:12px;margin:10px 0 0">مجموع آرای ثبت‌شده: ${fa(Number(p.total_votes || 0))}</p>
        ${voteForm}${voteStatus}
        ${adminToggle ? `<div style="margin-top:14px">${adminToggle}</div>` : ''}
      </div>`;
  }).join('');


  const section = document.createElement('section');
  section.style.marginTop = '24px';
  if (!document.getElementById('poll-visual-style')) {
    const style = document.createElement('style');
    style.id = 'poll-visual-style';
    style.textContent = `
      .poll-card{overflow:hidden}
      .poll-vote-list{gap:9px}
      .poll-vote-choice{position:relative;display:flex;align-items:center;gap:12px;padding:13px 14px;border:1px solid var(--line);border-radius:13px;background:var(--bg);transition:border-color .2s,background .2s,transform .2s,box-shadow .2s;cursor:pointer}
      .poll-vote-choice:hover{border-color:var(--accent);transform:translateY(-1px)}
      .poll-vote-choice:has(input:checked){border-color:var(--accent);background:var(--card);box-shadow:0 0 0 2px var(--line);animation:pollPick .28s ease}
      .poll-vote-choice input{accent-color:var(--accent);width:19px;height:19px;flex:0 0 19px;margin:0}
      .poll-vote-choice span{flex:1;min-width:0;line-height:1.8}
      .poll-vote-choice i{display:grid;place-items:center;width:23px;height:23px;border-radius:50%;background:var(--accent);color:#fff;font-style:normal;font-weight:900;font-size:13px;opacity:0;transform:scale(.5);transition:opacity .18s,transform .18s}
      .poll-vote-choice:has(input:checked) i{opacity:1;transform:scale(1)}
      .poll-option-row{display:block;padding:12px 0;border-bottom:1px solid var(--line)}
      .poll-result-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px}
      .poll-option-result{display:flex;gap:7px;align-items:center;white-space:nowrap}
      .poll-option-result b{font-size:14px;color:var(--accent)}
      .poll-result-track{height:10px;border-radius:20px;background:var(--bg);overflow:hidden}
      .poll-result-fill{display:block;height:100%;border-radius:20px;background:linear-gradient(90deg,var(--accent),var(--peach));transition:width .65s cubic-bezier(.2,.8,.2,1)}
      @keyframes pollPick{0%{transform:scale(.985)}60%{transform:scale(1.012)}100%{transform:scale(1)}}
      @media(prefers-reduced-motion:reduce){.poll-vote-choice,.poll-vote-choice i,.poll-result-fill{transition:none;animation:none}}
    `;
    document.head.appendChild(style);
  }
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
        const pollText = `📊 نظرسنجی جدید ساختمان\n\nعنوان: ${title}${description ? `\n\nتوضیحات: ${description}` : ''}\n\nگزینه‌ها:\n${options.map((x, i) => `${i + 1}) ${x}`).join('\n')}\n\nوضعیت: ${isActive ? 'فعال؛ امکان ثبت رأی وجود دارد' : 'فعلاً غیرفعال؛ رأی‌گیری پس از فعال‌سازی مدیر آغاز می‌شود'}\n\nبرای مشاهده نظرسنجی و ثبت رأی به بخش «اعلانات» برنامه Resident Manager مراجعه کنید.`;
        const sent = await window.ModirBale.send(pollText);
        try {
          await window.ModirPush.send('poll_created', 'نظرسنجی جدید: ' + title, description || options.join('، '));
        } catch (pushErr) {
          console.warn('Poll push notification failed:', pushErr);
        }
        toast(
          sent
            ? (isActive ? 'نظرسنجی ایجاد و متن کامل آن در گروه بله ارسال شد' : 'نظرسنجی غیرفعال ایجاد و در گروه بله اعلام شد')
            : 'نظرسنجی ایجاد شد؛ ارسال به بله ناموفق بود: ' + (S.lastBaleError || 'علت نامشخص'),
          !sent
        );
        go('announcements');
      } catch (err) { showErr(err); }
    });

    $$('[data-poll-toggle]').forEach(b => b.addEventListener('click', async () => {
      try {
        await T('app_admin_set_poll_active', {
          p_poll_id: Number(b.dataset.pollToggle),
          p_active: b.dataset.next === 'true'
        });
        if (b.dataset.next === 'true') {
          try {
            const allPolls = await T('app_get_polls');
            const current = (allPolls || []).find(p => Number(p.id) === Number(b.dataset.pollToggle));
            if (current) {
              const text = `🟢 رأی‌گیری نظرسنجی آغاز شد\n\n${current.title}${current.description ? `\n\n${current.description}` : ''}\n\nگزینه‌ها:\n${(current.options || []).map((o, i) => `${i + 1}) ${o.text}`).join('\n')}\n\nبرای ثبت رأی به بخش «اعلانات» برنامه Resident Manager مراجعه کنید.`;
              const sent = await window.ModirBale.send(text);
              if (!sent) console.warn('Poll activation notification failed:', S.lastBaleError);
            }
          } catch (notifyErr) { console.warn('Poll activation notification failed:', notifyErr); }
        }
        toast('وضعیت نظرسنجی تغییر کرد');
        go('announcements');
      } catch (err) { showErr(err); }
    }));

    $$('[data-poll-delete]').forEach(b => b.addEventListener('click', async () => {
      const ok = await window.ModirModal.confirm('این نظرسنجی، همه گزینه‌ها و تمام آرای آن برای همیشه حذف می‌شود و دیگر در صفحه هیچ‌کس نمایش داده نخواهد شد. ادامه می‌دهید؟');
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
          baleSent = await window.ModirBale.send(resultsText);
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

  // Public dashboard API: only functions consumed by other application areas.
  window.ModirDashboard = Object.freeze({
    reqTable,
    viewDash,
    renderPollsInAnnouncements
  });
})(window);
