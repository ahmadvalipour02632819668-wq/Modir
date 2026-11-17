(function (window) {
  const BAL_KEY = 'bm_hide_bal';

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

  window.ModirDashboardUi = Object.freeze({ countUp, bindEyes, EYE });
})(window);
