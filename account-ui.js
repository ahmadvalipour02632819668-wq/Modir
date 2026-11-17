(function (window) {
  const mustChangeBanner = () => S.me?.must_change_password ? `<div class="card" style="background:#fef3c7;color:#92400e;margin-bottom:20px">رمز عبور شما هنوز پیش‌فرض است. از بخش <a href="#" id="go-profile">پروفایل</a> آن را تغییر دهید.</div>` : '';

  window.ModirAccountUi = Object.freeze({ mustChangeBanner });
})(window);
