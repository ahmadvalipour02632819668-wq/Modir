(function (window) {
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
  const seen = ModirAlertUi.getSeenAlertIds();
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
    ModirAlertUi.markAlertSeen(b.dataset.alertId);
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
    const seen = ModirAlertUi.getSeenAlertIds();
    const unread = items.filter(x => !seen.has(x.id)).length;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.style.display = unread ? 'block' : 'none';
    badge.title = unread + ' مورد جدید';
  } catch (error) {
    console.warn('Alert count could not be refreshed:', error);
  }
}

window.ModirAlertCenter = Object.freeze({ collectAlertItems, renderAlertCenter, refreshManagerAlertBadge });
})(window);
