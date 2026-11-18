(function (window) {
function closeModal(bg) {
  if (!bg?.isConnected) return;
  if (history.state?.modal) history.back();
  else bg.remove();
}

function openModal(html) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal"><button class="x" aria-label="بستن">×</button>${html}</div>`;
  bg.addEventListener('click', e => {
    if (e.target === bg || e.target.classList.contains('x')) closeModal(bg);
  });
  document.body.appendChild(bg);
  history.pushState({ ...(history.state || {}), app: true, modal: true, view: window.S?.view || 'dash' }, '', '#modal');
  return bg;
}


function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function askDialog({ title, message, kind = 'confirm', value = '', placeholder = '', danger = false }) {
  return new Promise(resolve => {
    const input = kind === 'prompt'
      ? '<label class="f" style="display:block;margin-top:16px"><input id="modir-dialog-input" type="text" value="' + escapeHtml(value) + '" placeholder="' + escapeHtml(placeholder) + '" style="width:100%"></label>'
      : '';
    const buttons = kind === 'alert'
      ? '<button type="button" class="btn" id="modir-dialog-ok" style="flex:1">متوجه شدم</button>'
      : '<button type="button" class="btn lt" id="modir-dialog-cancel" style="flex:1">انصراف</button><button type="button" class="btn ' + (danger ? 'rd' : '') + '" id="modir-dialog-ok" style="flex:1">' + (kind === 'prompt' ? 'ثبت' : 'تأیید') + '</button>';
    const modal = openModal('<div class="modir-dialog"><h2>' + escapeHtml(title) + '</h2><p class="sub" style="line-height:1.9;white-space:pre-wrap">' + escapeHtml(message) + '</p>' + input + '<div style="display:flex;gap:10px;margin-top:22px">' + buttons + '</div></div>');
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      window.removeEventListener('popstate', onBack);
      if (modal.isConnected) {
        if (history.state?.modal) history.back();
        else modal.remove();
      }
      resolve(result);
    };
    const onBack = () => { if (!settled) { settled = true; resolve(kind === 'confirm' ? false : null); } };
    window.addEventListener('popstate', onBack, { once: true });
    modal.addEventListener('click', event => {
      if (event.target === modal || event.target.closest('.x')) {
        event.stopImmediatePropagation();
        finish(kind === 'confirm' ? false : null);
      }
    }, true);
    modal.querySelector('#modir-dialog-ok').addEventListener('click', () => {
      finish(kind === 'prompt' ? modal.querySelector('#modir-dialog-input').value : true);
    });
    modal.querySelector('#modir-dialog-cancel')?.addEventListener('click', () => finish(kind === 'confirm' ? false : null));
    modal.querySelector('#modir-dialog-input')?.focus();
  });
}
function confirmDialog(message, options = {}) {
  return askDialog({ ...options, message, kind: 'confirm' });
}
function promptDialog(message, options = {}) {
  return askDialog({ ...options, message, kind: 'prompt' });
}
function alertDialog(message, options = {}) {
  return askDialog({ ...options, message, kind: 'alert' });
}

window.ModirModal = Object.freeze({ open: openModal, close: closeModal, confirm: confirmDialog, prompt: promptDialog, alert: alertDialog });
})(window);
