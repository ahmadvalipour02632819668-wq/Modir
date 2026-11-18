(function (window) {
async function viewAnnouncements(el) {
  ModirAlertUi.markAlertPrefixSeen('announcement:');
  const list = await T('app_get_announcements');
  const adminForm = S.me.is_admin ? `<form id="af" class="card grid g3" style="margin-bottom:20px;border-color:var(--accent)"><h2 style="grid-column:1/-1;margin:0">ارسال اعلان جدید</h2><label class="f">عنوان<input id="a-title" required maxlength="180"></label><label class="f">نوع<select id="a-type"><option value="general">اطلاعیه عمومی</option><option value="meeting">دعوت به جلسه</option></select></label><label class="f" style="grid-column:1/-1">متن کامل<textarea id="a-content" rows="3" required maxlength="5000"></textarea></label><div style="grid-column:1/-1"><button class="btn">ثبت اعلان</button></div></form>` : '';
  el.innerHTML = `<h1>اعلانات ساختمان</h1><p class="sub">اطلاعیه‌ها و دعوت‌نامه‌ها</p>${adminForm}<div class="grid g2">${list.map(a => `<div class="card"><div style="display:flex;justify-content:space-between;margin-bottom:8px;gap:8px;flex-wrap:wrap"><h2 style="margin:0">${esc(a.title)}</h2><span class="chip ${a.type === 'meeting' ? 'pd' : 'ex'}">${a.type === 'meeting' ? 'جلسه' : (a.type === 'resident_message' ? 'پیام گروهی ساکن' : 'اطلاعیه')}</span></div><p style="white-space:pre-wrap;margin:0 0 16px">${esc(a.content)}</p><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><span style="font-size:12px;color:var(--muted)">${new Date(a.created_at).toLocaleDateString('fa-IR')}</span>${S.me.is_admin ? `<button class="btn rd sm" data-del="${a.id}">حذف</button>` : ''}</div></div>`).join('') || '<div class="card sub">هیچ اعلانی وجود ندارد.</div>'}</div>`;
  if (S.me.is_admin) {
    $('#af')?.addEventListener('submit', async e => {
      e.preventDefault();
      try {
        const title = $('#a-title').value; const content = $('#a-content').value; const type = $('#a-type').value;
        await T('app_admin_save_announcement', { p_title: title, p_content: content, p_type: type });
        window.ModirBale.send(`📢 اعلان جدید در ساختمان:\n\n🔹 ${title}\n\n${content}`);
        await window.ModirPush.send('announcement_created', title, content);
        toast('ثبت شد'); go('announcements');
      } catch (err) { showErr(err); }
    });
    $$('[data-del]').forEach(b => b.addEventListener('click', async () => { if (!await window.ModirModal.confirm('حذف شود؟')) return; try { await T('app_admin_delete_announcement', { p_id: +b.dataset.del }); toast('حذف شد'); go('announcements'); } catch (e) { showErr(e); } }));
  }
  await ModirDashboard.renderPollsInAnnouncements(el);
}

async function viewNeighborAlerts(el) {
  ModirAlertUi.markAlertPrefixSeen('neighbor:');
  ModirAlertUi.markAlertPrefixSeen('neighbor-summary:');
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
    if (!await window.ModirModal.confirm('یادآوری محرمانه برای واحد ' + fa(target) + ' ارسال شود؟')) return;
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
  ModirAlertUi.markAlertPrefixSeen('request:');
  ModirAlertUi.markAlertPrefixSeen('registration:');
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
        window.ModirBale.send(`🔔 درخواست جدید از واحد ${S.me.unit_no}:\n\n🔹 نوع: ${type}\n📝 توضیحات: ${desc}`);
        await window.ModirPush.send('resident_request_created', 'درخواست جدید از واحد ' + S.me.unit_no, type + (desc ? ' · ' + desc : ''));
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
        await window.ModirPush.send('group_message_created', title, message);
        const baleSent = await window.ModirBale.send(`💬 ${title}\n\n${message}`);
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
      if (!approve && !await window.ModirModal.confirm('درخواست ثبت‌نام رد شود؟')) return;
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
      if (!await window.ModirModal.confirm('درخواست انتقال مدیریت لغو شود؟')) return;
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
  const m = window.ModirModal.open(`
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
      window.ModirBale.send(
        `📩 پاسخ به درخواست واحد ${r.unit_no}\n\n` +
        `🔹 نوع: ${r.type}\n` +
        `📌 وضعیت: ${statusLabel}\n\n` +
        `💬 پاسخ مدیر:\n${reply}`
      );

      await window.ModirPush.send('manager_reply_created', 'پاسخ مدیر به درخواست واحد ' + r.unit_no, reply, r.account_id);
      window.ModirModal.close(m);
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

  const m = window.ModirModal.open(`
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
    $$('.debt-amount', m).forEach(inp => {
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
      if (fileInput.files.length > 0) base64Image = await ModirMedia.compressImage(fileInput.files[0]);
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
        window.ModirBale.send(`💸 پرداخت جدید (بر اساس بدهی):\n\n👤 واحد ${selectedUnit} - ${isAdmin ? (selectedAccount?.full_name || selectedAccount?.occupancy || '') : S.me.full_name}\n💰 مبلغ: ${fmt(totalAmount)} تومان`);
      } else {
        const res = await T('app_process_payment_fifo', {
          p_total_amount: totalAmount, p_pay_date: $('#pf-d', m).value, p_ref_code: $('#pf-r', m).value,
          p_note: $('#pf-n', m).value, p_receipt_image: base64Image,
          p_target_unit: isAdmin ? selectedUnit : null
        });
        if (!res.ok) throw new Error(res.error);
        window.ModirBale.send(`💸 پرداخت جدید (مبلغ دلخواه):\n\n👤 واحد ${selectedUnit} - ${S.me.full_name}\n💰 مبلغ: ${fmt(totalAmount)} تومان`);
      }
      if (!isAdmin) await window.ModirPush.send('payment_request_created', 'پرداخت جدید از واحد ' + selectedUnit, 'مبلغ ' + fmt(totalAmount) + ' تومان برای بررسی ثبت شد.');
      window.ModirModal.close(m);
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
  ModirAlertUi.markAlertPrefixSeen('payment:');
  const admin = S.me.is_admin; const list = await T('app_get_payment_requests'); const pending = list.filter(p => p.status === 'pending');
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;gap:12px;flex-wrap:wrap"><div><h1>${admin ? 'بررسی پرداخت‌ها' : 'پرداخت بدهی'}</h1><p class="sub" style="margin:0">${admin ? 'پرداخت‌های منتظر تایید شما' : 'پرداخت خود را ثبت کنید.'}</p></div>${admin ? '' : '<button class="btn sf" id="np">ثبت پرداخت جدید</button>'}</div>${admin ? `<h2>منتظر تایید (${fa(pending.length)})</h2>${ModirDashboard.reqTable(pending, true)}<h2 style="margin-top:28px">سابقه</h2>${ModirDashboard.reqTable(list.filter(p => p.status !== 'pending'), true)}` : ModirDashboard.reqTable(list, false)}`;
  $('#np')?.addEventListener('click', async () => { const rep = await T('app_report', { p_year: S.y, p_month: S.m }); const r = rep.rows[0]; payModal(r); });
  $$('[data-ap]').forEach(b => b.addEventListener('click', () => approveModal(list.find(p => p.id == b.dataset.ap))));
}

function approveModal(p) {
  const m = window.ModirModal.open(`<h2>تایید پرداخت واحد ${fa(p.unit_no)}</h2><p class="sub">${esc(p.full_name || '')} · بابت ${esc(CATS[p.category] || p.category)} · ${MONTHS[p.month-1]} ${fa(p.year)}</p>${p.receipt_image ? `<div style="margin-bottom:16px;text-align:center"><img src="${esc(p.receipt_image)}" style="max-width:100%;max-height:300px;border-radius:12px;border:1px solid var(--line)"></div>` : `<div class="card" style="background:var(--bg);margin-bottom:16px;text-align:center;color:var(--muted)">تصویری بارگذاری نشده است</div>`}<div class="grid g2"><label class="f">مبلغ تاییدی (تومان)<input id="ap-a" value="${fmt(p.amount)}" inputmode="numeric"></label><label class="f">یادداشت<input id="ap-n"></label></div><div style="margin-top:20px;display:flex;gap:10px"><button class="btn" id="ap-go" style="flex:1">تایید و ثبت</button><button class="btn rd" id="ap-rj">رد کردن</button></div>`);
  attachNumericInputIn(m, '#ap-a');
  $('#ap-rj', m).addEventListener('click', async () => { const note = await window.ModirModal.prompt('دلیل رد:') ?? null; if (note === null) return; try { await T('app_admin_review_payment', { p_id: p.id, p_approve: false, p_admin_note: note }); await window.ModirPush.send('payment_reviewed', 'نتیجه بررسی پرداخت', 'پرداخت شما رد شد. ' + note, p.account_id); window.ModirModal.close(m); toast('رد شد'); go('pay'); } catch (e) { showErr(e); } });
  $('#ap-go', m).addEventListener('click', async () => {
    try {
      const approvedAmount = toNum($('#ap-a', m).value);
      if (approvedAmount <= 0 || approvedAmount > Number(p.amount)) {
        toast('مبلغ تأییدشده باید بیشتر از صفر و حداکثر برابر مبلغ درخواست‌شده باشد', true);
        return;
      }
      await T('app_admin_review_payment', { p_id: p.id, p_approve: true, p_amount: approvedAmount, p_admin_note: $('#ap-n', m).value });
      window.ModirBale.send(`✅ پرداخت تایید شد:\n\n👤 واحد ${p.unit_no} - ${p.full_name}\n💰 مبلغ: ${fmt(approvedAmount)} تومان\n📅 بابت: ${CATS[p.category] || p.category} - ${MONTHS[p.month-1]} ${p.year}`);
      await window.ModirPush.send('payment_reviewed', 'پرداخت شما تایید شد', 'پرداخت ' + fmt(p.amount) + ' تومان تایید شد.', p.account_id);
      window.ModirModal.close(m); toast('تایید شد'); go('pay');
    } catch (e) { showErr(e); }
  });
}

  // Public community API: views and payment modal consumed by other areas.
  window.ModirCommunity = Object.freeze({
    viewAnnouncements,
    viewNeighborAlerts,
    viewRequests,
    payModal,
    viewPay
  });
})(window);
