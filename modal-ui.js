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
  history.pushState({ ...(history.state || {}), app: true, modal: true, view: S.view || 'dash' }, '', '#modal');
  return bg;
}

window.ModirModal = Object.freeze({ open: openModal, close: closeModal });
})(window);
