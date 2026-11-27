(function () {
  const BACK_EXIT_WINDOW_MS = 2000;
  let backPressCount = 0;
  let backPressTimer = null;
  let appHistoryReady = false;

function resetBackPress() { backPressCount = 0; if (backPressTimer) { clearTimeout(backPressTimer); backPressTimer = null; } }
function ensureAppHistory() {
  const current = history.state;
  if (!current?.app) {
    history.replaceState({ app: true, view: S.view || 'dash', root: true }, '', '#app');
    history.pushState({ app: true, view: S.view || 'dash', guard: true }, '', '#app');
  } else if (!current.guard) {
    history.pushState({ ...current, app: true, view: S.view || current.view || 'dash', guard: true }, '', '#app');
  }
  appHistoryReady = true;
}
function rearmHistoryGuard() { history.pushState({ app: true, view: S.view || 'dash', guard: true }, '', '#app'); }

function handleBackNavigation(event) {
  const openModals = document.querySelectorAll('.modal-bg');
  if (openModals.length) { openModals[openModals.length - 1].remove(); return; }
  if (event?.state?.modal) { rearmHistoryGuard(); return; }
  if (!appHistoryReady) { ensureAppHistory(); return; }
  if (S.me && S.view !== 'dash') {
    resetBackPress(); go('dash', true);
    history.replaceState({ app: true, view: 'dash', guard: true }, '', '#app'); return;
  }
  if (!S.me) { resetBackPress(); rearmHistoryGuard(); return; }
  if (backPressCount === 0) {
    backPressCount = 1; toast('برای خروج، دوباره دکمه بازگشت را بزنید', true); clearTimeout(backPressTimer);
    backPressTimer = setTimeout(() => { backPressCount = 0; backPressTimer = null; }, BACK_EXIT_WINDOW_MS);
    rearmHistoryGuard(); return;
  }
  resetBackPress(); history.back();
}

window.addEventListener('popstate', handleBackNavigation);
ensureAppHistory();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { resetBackPress(); } });
document.addEventListener('click', e => { if (!e.target.closest('.menu-dropdown')) { $('#main-menu')?.classList.remove('show'); } });
if (S.token) renderShell(); else renderLogin();
})();

// Deployment refresh: force GitHub Pages and browser caches to fetch the current navigation bundle.
