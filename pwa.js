(function () {
// Register the PWA service worker on every normal visit, not only when push notifications are enabled.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('./sw.js', document.baseURI), { scope: new URL('./', document.baseURI).pathname })
      .then(() => navigator.serviceWorker.ready)
      .catch(error => console.warn('PWA service worker registration failed:', error));
  }, { once: true });
}

let deferredInstallPrompt = null;
let installPromptDismissed = false;
function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
async function installPwa() {
  if (isAppInstalled()) return;
  if (deferredInstallPrompt) {
    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === 'accepted') {
      document.querySelectorAll('[data-install]').forEach(button => button.remove());
      document.getElementById('pwa-install-banner')?.remove();
    }
    return;
  }
  const help = /iphone|ipad|ipod/i.test(navigator.userAgent)
    ? 'برای نصب در آیفون، دکمه اشتراک‌گذاری Safari را بزنید و «افزودن به صفحه اصلی» را انتخاب کنید.'
    : 'برای نصب، منوی سه‌نقطه مرورگر را باز کنید و «Install app» یا «Add to Home screen» را انتخاب کنید.';
  await window.ModirModal.alert(help);
}
function installTileHtml() {
  if (isAppInstalled()) return '';
  return `<button class="tile" type="button" data-install aria-label="نصب برنامه">
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="5" width="28" height="38" rx="5"/><path d="M24 14v15m-7-7 7 7 7-7M19 36h10"/></svg>
    <span>نصب برنامه</span>
  </button>`;
}
function renderInstallBanner() {
  const view = document.getElementById('view');
  if (!view || S.view !== 'dash' || isAppInstalled() || installPromptDismissed || !deferredInstallPrompt || document.getElementById('pwa-install-banner')) return;
  const banner = document.createElement('section');
  banner.id = 'pwa-install-banner';
  banner.style.cssText = 'margin:14px 16px 18px;padding:16px;border-radius:18px;background:linear-gradient(135deg,#2d3463,#46528f);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 8px 24px #20264a22';
  banner.innerHTML = '<div style="min-width:0"><b style="display:block;font-size:15px;margin-bottom:5px">📲 نصب اپلیکیشن ساختمان</b><span style="font-size:12px;opacity:.9">برای دسترسی سریع‌تر، برنامه را روی گوشی نصب کنید.</span></div><div style="display:flex;align-items:center;gap:8px;flex-shrink:0"><button id="pwa-install-action" style="border:0;border-radius:12px;padding:10px 16px;background:#fff;color:#2d3463;font:inherit;font-weight:800">نصب</button><button id="pwa-install-close" aria-label="بستن" style="border:0;background:transparent;color:#fff;font-size:22px;padding:2px 5px">×</button></div>';
  view.prepend(banner);
  document.getElementById('pwa-install-action').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    banner.remove();
  });
  document.getElementById('pwa-install-close').addEventListener('click', () => { installPromptDismissed = true; banner.remove(); });
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  renderInstallBanner();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.getElementById('pwa-install-banner')?.remove();
});

window.ModirPwa = Object.freeze({
  isAppInstalled,
  installPwa,
  installTileHtml,
  renderInstallBanner,
});
})();
