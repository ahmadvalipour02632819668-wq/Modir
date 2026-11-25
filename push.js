(function (window) {
const PUSH_VAPID_PUBLIC_KEY = 'BMb3MKzCKqT82g57EkjMcb2b8pu3bH3UNmxZ5rtubHvXIM08iGJKOuFyYyaeH41UbbLQ5uXI2PGrgJa90u0mvzs';
let pushServiceWorkerRegistration = null;
let pushPromptShown = false;
function getNativeLocalNotifications() {
  const capacitor = window.Capacitor;
  if (!capacitor?.isNativePlatform?.() || capacitor.getPlatform?.() !== 'android') return null;
  return capacitor.Plugins?.LocalNotifications || null;
}
async function enableNativeNotifications(plugin) {
  await plugin.createChannel({
    id: 'building-updates',
    name: 'اعلان‌های ساختمان',
    description: 'اطلاعیه‌ها و پیام‌های مهم ساختمان',
    importance: 5,
    visibility: 1,
    sound: 'default',
    vibration: true
  });
  let permission = await plugin.checkPermissions();
  if (permission.display !== 'granted') permission = await plugin.requestPermissions();
  if (permission.display !== 'granted') {
    throw new Error('اجازه اعلان در تنظیمات گوشی فعال نشده است.');
  }
}
function pushBase64UrlToBytes(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
}
async function getPushServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('مرورگر شما اعلان مستقیم را پشتیبانی نمی‌کند');
  if (!window.isSecureContext) throw new Error('برای اعلان موبایلی باید سایت با HTTPS باز شود');
  if (!pushServiceWorkerRegistration) {
    pushServiceWorkerRegistration = await navigator.serviceWorker.register(new URL('./sw.js', document.baseURI), { scope: new URL('./', document.baseURI).pathname });
    await navigator.serviceWorker.ready;
  }
  return pushServiceWorkerRegistration;
}
async function enableMobilePush() {
  if (!S.token) throw new Error('ابتدا وارد حساب شوید');
  const nativeNotifications = getNativeLocalNotifications();
  if (nativeNotifications) {
    await enableNativeNotifications(nativeNotifications);
    return true;
  }
  if (!('Notification' in window)) throw new Error('مرورگر شما اعلان را پشتیبانی نمی‌کند');
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') throw new Error('اجازه نمایش اعلان داده نشد. می‌توانید از تنظیمات مرورگر آن را فعال کنید.');
  const registration = await getPushServiceWorker();
  const applicationServerKey = pushBase64UrlToBytes(PUSH_VAPID_PUBLIC_KEY);
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const currentKey = subscription.options?.applicationServerKey;
    const currentBytes = currentKey ? new Uint8Array(currentKey) : null;
    const sameKey = currentBytes && currentBytes.length === applicationServerKey.length &&
      applicationServerKey.every((byte, index) => byte === currentBytes[index]);
    if (!sameKey) {
      await subscription.unsubscribe();
      subscription = null;
    }
  }
  if (!subscription) subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, applicationServerKey
  });
  const json = subscription.toJSON();
  const { error } = await sb.rpc('app_push_save_subscription', {
    p_token: S.token, p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth, p_user_agent: navigator.userAgent
  });
  if (error) throw error;
}
async function detachPushSubscription(token) {
  if (!token || !('serviceWorker' in navigator)) return;
  const registration = await getPushServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription?.endpoint) return;
  const { error } = await sb.rpc('app_push_remove_subscription', {
    p_token: token, p_endpoint: subscription.endpoint
  });
  if (error) throw error;
}
async function maybeAskForPushPermission() {
  const nativeNotifications = getNativeLocalNotifications();
  if (!S.token || (!nativeNotifications && !('Notification' in window)) || pushPromptShown) return;
  let currentPermission = 'default';
  if (nativeNotifications) {
    try {
      currentPermission = (await nativeNotifications.checkPermissions()).display;
    } catch (error) {
      console.warn('Native notification permission check failed:', error);
    }
  } else {
    currentPermission = Notification.permission;
  }
  // Refresh a previously granted web-push subscription after VAPID key rotation.
  if (currentPermission === 'granted') {
    // Refresh silently in the background. A real cross-device conflict is
    // reported only when the user explicitly enables notifications.
    pushPromptShown = true;
    if (!nativeNotifications) {
      enableMobilePush().catch(error => {
        console.warn('Push subscription refresh failed:', error);
      });
    }
    return;
  }
  pushPromptShown = true;
  const permissionBlocked = currentPermission === 'denied' && !nativeNotifications;
  const message = nativeNotifications
    ? 'برای فعال‌سازی اعلان‌های Resident Manager، اجازه نمایش اعلان‌ها را در گوشی صادر کنید.'
    : permissionBlocked
      ? 'دسترسی اعلان‌ها در تنظیمات مرورگر مسدود شده است. برای فعال‌سازی، مجوز اعلان این سایت را از تنظیمات مرورگر روی اجازه قرار دهید.'
      : 'برای دریافت اطلاعیه‌ها و پیام‌های مهم ساختمان، اجازه نمایش اعلان‌ها را صادر کنید.';
  const actionButton = permissionBlocked ? '' : '<button type="button" class="btn sf" id="allow-push-now" style="width:100%;margin-top:10px">اجازه می‌دهم</button>';
  const closeLabel = permissionBlocked ? 'متوجه شدم' : 'فعلاً نه';
  const prompt = window.ModirModal.open('<div style="text-align:center;padding:10px 4px"><div style="font-size:38px;margin-bottom:8px">🔔</div><h2 style="margin:0 0 8px">فعال‌سازی اعلان‌های ساختمان</h2><p class="sub" style="line-height:1.9">' + esc(message) + '</p>' + actionButton + '<button type="button" class="btn lt" id="skip-push-now" style="width:100%;margin-top:8px">' + closeLabel + '</button><p id="push-prompt-status" class="sub" style="margin:8px 0 0"></p></div>');
  $('#skip-push-now', prompt)?.addEventListener('click', () => prompt.remove());
  $('#allow-push-now', prompt)?.addEventListener('click', async e => {
    const button = e.currentTarget;
    const status = $('#push-prompt-status', prompt);
    button.disabled = true;
    button.textContent = 'در حال فعال‌سازی...';
    try {
      await enableMobilePush();
      prompt.remove();
      toast(nativeNotifications
        ? 'مجوز اعلان‌های گوشی فعال شد'
        : 'اشتراک اعلان‌های موبایلی فعال شد');
    } catch (error) {
      if (status) status.textContent = error.message || 'فعال‌سازی اعلان‌ها ناموفق بود';
      button.disabled = false;
      button.textContent = 'تلاش دوباره';
    }
  });
}
async function sendMobilePush(event, title, body, targetAccountId = null) {
  if (!S.token) return null;
  try {
    const { data, error } = await sb.functions.invoke('send-web-push', {
      body: { token: S.token, event, title, body, target_account_id: targetAccountId, url: new URL('./', document.baseURI).pathname }
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'ارسال اعلان انجام نشد');
    if (data.sent === 0) console.info('Mobile push had no active recipient subscriptions:', data);
    return data;
  } catch (error) {
    console.warn('Mobile push failed:', error);
    return null;
  }
}

window.ModirPush = Object.freeze({
  getServiceWorker: getPushServiceWorker,
  enable: enableMobilePush,
  detachSubscription: detachPushSubscription,
  maybeAskForPermission: maybeAskForPushPermission,
  send: sendMobilePush
});
})(window);
