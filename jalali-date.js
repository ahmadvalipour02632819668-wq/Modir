(function (window) {
  function normalizeJalaliDigits(value) {
    return String(value || '').trim().replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  }
  function jalaliToGregorianDate(value) {
    const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(normalizeJalaliDigits(value));
    if (!m) throw new Error('تاریخ را به شکل ۱۴۰۵/۰۸/۱۶ وارد کنید');
    const jy = +m[1], jm = +m[2], jd = +m[3];
    if (jm < 1 || jm > 12 || jd < 1 || jd > (jm <= 6 ? 31 : 30)) throw new Error('روز یا ماه شمسی معتبر نیست');
    const f = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
    for (let i = 0; i < 740; i++) {
      const dt = new Date(Date.UTC(jy + 621, 0, 1 + i, 12)), p = f.formatToParts(dt), g = k => Number(p.find(x => x.type === k)?.value);
      if (g('year') === jy && g('month') === jm && g('day') === jd) return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth()+1).padStart(2,'0') + '-' + String(dt.getUTCDate()).padStart(2,'0');
    }
    throw new Error('تاریخ شمسی قابل تبدیل نیست');
  }
  function gregorianToJalaliDate(value) {
    const d = String(value || '').slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    const p = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'UTC'}).formatToParts(new Date(d+'T12:00:00Z'));
    const g = k => p.find(x => x.type === k)?.value;
    return g('year')+'/'+String(g('month')).padStart(2,'0')+'/'+String(g('day')).padStart(2,'0');
  }
  function jalaliMonthDays(y,m) {
    const a=jalaliToGregorianDate(y+'/'+String(m).padStart(2,'0')+'/01'), ny=m===12?y+1:y, nm=m===12?1:m+1, b=jalaliToGregorianDate(ny+'/'+String(nm).padStart(2,'0')+'/01');
    return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
  }
  window.ModirJalaliDate = Object.freeze({normalizeJalaliDigits,jalaliToGregorianDate,gregorianToJalaliDate,jalaliMonthDays});
})(window);
