(function () {
function smsLink(phone, text) {
  if (!phone) return ''; const safe = String(phone).replace(/[^\d+\-]/g, '').trim(); if (!safe) return '';
  const sep = /iPhone|iPad|iPod/.test(navigator.userAgent) ? '&' : '?'; return `sms:${safe}${sep}body=${encodeURIComponent(text)}`;
}
function smsBtn(phone, text, label = 'پیامک') {
  if (!phone) return `<span class="muted" title="شماره ثبت نشده">—</span>`;
  return `<a class="btn lt sm" href="${smsLink(phone, text)}" style="padding:4px 8px;font-size:12px;">✉ ${esc(label)}</a>`;
}

window.ModirSms = Object.freeze({ smsLink, smsBtn });
})();
