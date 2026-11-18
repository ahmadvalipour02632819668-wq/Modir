import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error("CHECK FAILED:", message);
  process.exitCode = 1;
};

const index = read("index.html");
const modules = [
  "core.js",
  "icons.js",
  "theme-ui.js",
  "timing.js",
  "menu-ui.js",
  "alert-ui.js",
  "alert-center.js",
  "sms.js",
  "media.js",
  "pwa.js",
  "assistant.js",
  "modal-ui.js",
  "push.js",
  "shell.js",
  "account-ui.js",
  "period-ui.js",
  "dashboard-ui.js",
  "dashboard.js",
  "community.js",
  "finance.js",
  "jalali-date.js",
  "management.js",
  "navigation.js",
];

if (!index.includes('href="./app.css?v=1"')) fail("index.html must load app.css");
if (index.includes("./app.js")) fail("obsolete monolithic app.js reference remains");
if (!index.includes("./finance.js?v=9")) fail("finance.js cache version must be refreshed after selector fixes");
if (index.includes("<style>")) fail("application CSS must stay in app.css");
if (index.includes("html2canvas")) fail("html2canvas must not block initial page loading");

const actual = [...index.matchAll(/<script\s+src=["']\.\/([^"'?]+)(?:\?[^"']*)?["']/g)]
  .map((match) => match[1])
  .filter((name) => modules.includes(name));
if (JSON.stringify(actual) !== JSON.stringify(modules)) {
  fail(`JavaScript load order mismatch. Expected: ${modules.join(" -> ")}; found: ${actual.join(" -> ")}`);
}
const localScriptTags = [...index.matchAll(/<script\s+src=["']\.\/[^"']+["'][^>]*>/g)].map((match) => match[0]);
if (localScriptTags.length !== modules.length || localScriptTags.some((tag) => !/\bdefer\b/.test(tag) || /\basync\b/.test(tag))) {
  fail("all ordered local JavaScript files must use defer and must not use async");
}

for (const file of modules) {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`missing module: ${file}`);
    continue;
  }
  if (!read(file).trim()) fail(`empty module: ${file}`);
}

const contracts = {
  "icons.js": ["ModirIcons", "ICONS", "LINE_ICONS", "ico"],
  "modal-ui.js": ["ModirModal", "open", "close"],
  "push.js": ["ModirPush", "getServiceWorker", "enable", "detachSubscription", "maybeAskForPermission", "send"],
  "theme-ui.js": ["ModirTheme", "setTheme"],
  "timing.js": ["ModirTiming", "debounce"],
  "sms.js": ["ModirSms", "smsLink", "smsBtn"],
  "dashboard-ui.js": ["ModirDashboardUi", "countUp", "bindEyes", "EYE"],
  "account-ui.js": ["ModirAccountUi", "mustChangeBanner"],
  "menu-ui.js": ["ModirMenuUi", "getMenuItems", "navItems"],
  "alert-ui.js": ["ModirAlertUi", "getSeenAlertIds", "markAlertSeen", "markAlertPrefixSeen"],
  "alert-center.js": ["ModirAlertCenter", "collectAlertItems", "renderAlertCenter", "refreshManagerAlertBadge"],
  "period-ui.js": ["ModirPeriodUi", "monthOptions", "yearOptions", "unitOptions", "bindPeriod", "periodPicker"],
  "media.js": ["ModirMedia", "compressImage"],
  "pwa.js": ["ModirPwa", "isAppInstalled", "installPwa", "installTileHtml", "renderInstallBanner"],
  "assistant.js": ["ModirAssistant", "mount"],
  "dashboard.js": ["ModirDashboard", "reqTable", "viewDash", "renderPollsInAnnouncements"],
  "community.js": ["ModirCommunity", "viewAnnouncements", "viewNeighborAlerts", "viewRequests", "payModal", "viewPay"],
  "finance.js": ["ModirFinance", "viewTx", "viewReport"],
  "jalali-date.js": ["ModirJalaliDate", "normalizeJalaliDigits", "jalaliToGregorianDate", "gregorianToJalaliDate", "jalaliMonthDays"],
  "management.js": ["ModirManagement", "viewUnits", "viewRates", "viewSettings", "viewActivity", "viewProfile"],
};
const managementSource = read("management.js");
const financeSource = read("finance.js");
if (managementSource.includes("modal(") || financeSource.includes("modal(") ||
    !managementSource.includes("window.ModirModal.open(") || !financeSource.includes("window.ModirModal.open(") ||
    !index.includes("./modal-ui.js?v=1") || !index.includes("./push.js?v=1")) {
  fail("all modal consumers must use the explicitly loaded ModirModal API");
}
if (!managementSource.includes("S.view === 'charge' ? Promise.resolve({}) : T('app_get_settings')") ||
    !managementSource.includes("S.view === 'charge' ? Promise.resolve(null) : T('app_admin_get_bale_config')")) {
  fail("charge view must skip settings-only RPC requests");
}

const coreSource = read("core.js");
const pushSource = read("push.js");
if (coreSource.includes("PUSH_VAPID_PUBLIC_KEY") || !pushSource.includes("window.ModirPush = Object.freeze") ||
    !shellSource.includes("window.ModirPush.maybeAskForPermission") ||
    !shellSource.includes("window.ModirPush.detachSubscription") ||
    !shellSource.includes("window.ModirPush.send(") ||
    !read("management.js").includes("window.ModirPush.enable()") ||
    !read("management.js").includes("window.ModirPush.getServiceWorker()") ||
    !read("dashboard.js").includes("window.ModirPush.send(") ||
    !read("community.js").includes("window.ModirPush.send(")) {
  fail("push lifecycle and delivery must be owned by the explicit ModirPush module API");
}
const shellSource = read("shell.js");
const themeSource = read("theme-ui.js");
const timingSource = read("timing.js");
if (coreSource.includes("function setTheme(") || !themeSource.includes("window.ModirTheme = Object.freeze({ setTheme })") || !shellSource.includes("window.ModirTheme.setTheme") || !read("management.js").includes("window.ModirTheme.setTheme")) {
  fail("theme behavior must be owned by theme-ui.js and consumed through ModirTheme");
}
if (coreSource.includes("function debounce(") || !timingSource.includes("window.ModirTiming") || !shellSource.includes("window.ModirTiming.debounce") || !read("finance.js").includes("window.ModirTiming.debounce")) {
  fail("debounce must be owned by timing.js and consumed through ModirTiming");
}
if (!coreSource.includes("controller.abort()") ||
    !coreSource.includes("sb.rpc(fn, args, controller ? { signal: controller.signal } : undefined)") ||
    !coreSource.includes("error.name === 'AbortError' || isNetworkError(rawMsg)") ||
    !index.includes("./core.js?v=4") ||
    !index.includes("rpc: function (name, args, options)") ||
    !index.includes("signal: options && options.signal")) {
  fail("RPC timeout must abort the underlying fetch and core.js cache must be refreshed");
}

const alertCenterSource = read("alert-center.js");
const shellAlertSource = read("shell.js");
if (!alertCenterSource.includes("ALERT_ITEMS_CACHE_TTL_MS = 30000") ||
    !alertCenterSource.includes("alertItemsContextKey()") ||
    !alertCenterSource.includes("alertItemsCacheKey === contextKey") ||
    !alertCenterSource.includes("alertItemsLoadKey === contextKey") ||
    !shellAlertSource.includes("collectAlertItems({ force: true })") ||
    !index.includes("./alert-center.js?v=2")) {
  fail("alert-center reads must be cached, deduplicated and force-refreshed when the panel opens");
}

if (!financeSource.includes("function loadHtml2Canvas()") || (financeSource.match(/loadHtml2Canvas\(\)/g) || []).length < 3) {
  fail("finance.js must lazy-load html2canvas only when an image export is requested");
}

if (!financeSource.includes('t.source === "payment" ?') ||
    !financeSource.includes("پرداخت تأییدشده") ||
    !financeSource.includes("data-correct") ||
    !financeSource.includes("app_admin_correct_approved_payment") ||
    !financeSource.includes("payment_corrected")) {
  fail("approved payment correction must be auditable and use a dedicated correction action");
}

if (/(^|[^$])\$\([^)]*\)\s*\.forEach/.test(financeSource) || financeSource.includes("$$$")) {
  fail("finance.js must use $$() for multi-element forEach selectors; $() selects only one element");
}

const serviceWorkerSource = read("sw.js");
if (!serviceWorkerSource.includes("new URL(event.request.url).origin !== self.location.origin")) {
  fail("service worker must not intercept cross-origin GET requests");
}

const assistantSource = read("assistant.js");
if ((assistantSource.match(/addEventListener\(['"]resize['"]/g) || []).length !== 1 ||
    !assistantSource.includes("window.__modirAiPlacePanel")) {
  fail("assistant resize handling must use one reusable window listener");
}


if (!/document\.visibilityState === 'visible' && S\.me\?\.is_admin/.test(shellSource) ||
    !/\},\s*60000\);/.test(shellSource)) {
  fail("manager alert polling must be limited to visible manager sessions and run no more than once per minute");
}

const dashboardSource = read("dashboard.js");
const managementSourceForIcons = read("management.js");
if (!dashboardSource.includes("window.ModirIcons.ico(k)") || !managementSourceForIcons.includes("window.ModirIcons.ICONS.profile") || !shellSource.includes("ModirIcons.LINE_ICONS")) {
  fail("dashboard, management and shell must consume the shared ModirIcons API");
}
if (/\$\{\s*mustChangeBanner\s*\(\s*\)\s*\}/.test(dashboardSource)) {
  fail("dashboard.js must call ModirAccountUi.mustChangeBanner(), not the removed local helper");
}

for (const [file, names] of Object.entries(contracts)) {
  if (!fs.existsSync(path.join(root, file))) continue;
  const source = read(file);
  const apiName = names[0];
  const apiStart = source.indexOf(`window.${apiName} = Object.freeze({`);
  if (apiStart < 0) {
    fail(`${file}: missing frozen public API ${apiName}`);
    continue;
  }
  const apiEnd = source.indexOf("});", apiStart);
  const apiBlock = source.slice(apiStart, apiEnd < 0 ? source.length : apiEnd);
  for (const method of names.slice(1)) {
    if (!apiBlock.includes(method)) fail(`${file}: public API ${apiName} does not expose ${method}`);
  }
}


const sharedContracts = {
  "core.js": [
    "sb", "S", "T", "api", "$", "$" + "$", "esc", "fmt", "fa", "money",
    "toNum", "toast", "showErr", "MONTHS", "CATS", "OCC",
    "jalaliDatePicker", "TODAY", "notifyBale", "sendMobilePush",
    "enableMobilePush", "detachPushSubscription"
  ],
  "shell.js": [
    "modal", "closeModal", "go", "renderShell", "renderLogin", "logout",
    
  ],
};
for (const [file, names] of Object.entries(sharedContracts)) {
  const source = read(file);
  const declarations = source.split(/\r?\n/).map((line) => line.trimStart());
  for (const name of names) {
    const declared = declarations.some((line) =>
      line.startsWith(`const ${name} `) || line.startsWith(`let ${name} `) ||
      line.startsWith(`var ${name} `) || line.startsWith(`function ${name}(`) ||
      line.startsWith(`async function ${name}(`)
    );
    if (!declared) fail(`${file}: missing shared runtime contract ${name}`);
  }
};
if (process.exitCode) process.exit(process.exitCode);
console.log(`Structure check passed: ${modules.length} ordered JavaScript files, public API contracts and app.css.`);
