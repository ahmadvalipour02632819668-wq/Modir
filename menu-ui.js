(function (window) {
  function getMenuItems() {
    const a = S.me?.is_admin;
    return [
      ['dash', 'داشبورد'], a && ['units', 'مدیریت واحدها'], ['announcements', 'اعلانات'],
      ['neighbor-alerts', 'زنگ همسایگی'], ['requests', a ? 'درخواست‌ها' : 'ارتباط با مدیر'], ['tx', 'تراکنش‌ها'],
      a && ['pay', 'تایید پرداخت‌ها'], ['report', 'گزارش ماهانه'],
      ['settings', 'تنظیمات'], ['profile', 'پروفایل'], a && ['activity', 'گزارش فعالیت‌ها'],
    ].filter(Boolean);
  }
  function navItems() {
    const a = S.me?.is_admin;
    return [
      ['tx', 'تراکنش‌ها'], a ? ['pay', 'تایید پرداخت'] : ['requests', 'ارتباط با مدیر'],
      ['dash', 'خانه'], ['report', 'گزارش'], ['services', 'خدمات'],
    ];
  }
  window.ModirMenuUi = Object.freeze({ getMenuItems, navItems });
})(window);
