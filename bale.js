(function (window) {
async function notifyBale(msg, imageBase64 = null) {
  try {
    if (!S.token || !S.me?.building_id) throw new Error('اطلاعات ساختمان یا نشست کاربر موجود نیست');
    const payload = { app_token: S.token, building_id: Number(S.me.building_id), text: msg };
    if (imageBase64) payload.image = imageBase64;
    const { data, error } = await sb.functions.invoke('send-bale', { body: payload });
    if (error) {
      let detail = error.message || 'ارسال به بله ناموفق بود';
      try {
        const response = error.context;
        if (response && typeof response.clone === 'function') {
          const body = await response.clone().json();
          if (body?.error) detail = body.error;
        }
      } catch (_) {}
      throw new Error(detail);
    }
    if (!data?.success) throw new Error(data?.error || 'ارسال به بله ناموفق بود');
    S.lastBaleError = '';
    console.log('✅ Bale: پیام با موفقیت ارسال شد');
    return true;
  } catch(e) {
    S.lastBaleError = e?.message || 'ارسال به بله ناموفق بود';
    console.warn('❌ Bale: ارسال پیام ناموفق بود:', e);
    return false;
  }
}
window.ModirBale = Object.freeze({ send: notifyBale });
})(window);
