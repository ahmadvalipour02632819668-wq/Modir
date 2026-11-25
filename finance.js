const readJalaliValue = (selector, label) => {
  const hidden = $(selector, m);
  const picker = hidden?.parentElement?.querySelector('[data-jalali-picker]');
  let raw = ModirManagement.normalizeJalaliDigits(hidden?.value || '');

  if (!raw && picker) {
    const year = picker.querySelector('[data-jp-year]')?.value;
    const month = picker.querySelector('[data-jp-month]')?.value;
    const day = picker.querySelector('[data-jp-day].selected')?.dataset.jpDay;
    if (year && month && day) {
      raw = ModirManagement.normalizeJalaliDigits(
        String(year) + '/' + String(month).padStart(2, '0') + '/' + String(day).padStart(2, '0')
      );
    }
  }

  if (!/^[0-9]{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/.test(raw)) {
    throw new Error(label + ' معتبر نیست؛ لطفاً تاریخ را به شکل سال/ماه/روز شمسی انتخاب کنید.');
  }
  return raw;
};

const readJalaliDate = (selector, label) => {
  const raw = readJalaliValue(selector, label);
  try {
    const converted = ModirManagement.jalaliToGregorianDate(raw);
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(converted)) {
      throw new Error('invalid converted date');
    }
    return converted;
  } catch (_) {
    throw new Error(label + ' معتبر نیست؛ تاریخ انتخاب‌شده: ' + raw);
  }
};

const transactionDate = readJalaliValue('#tx-date', 'تاریخ تراکنش');
readJalaliDate('#tx-date', 'تاریخ تراکنش');

let billStart = null, billEnd = null;
if (isBill) {
  billStart = readJalaliDate('#bill-period-start', 'دوره قبض (از تاریخ)');
  billEnd = readJalaliDate('#bill-period-end', 'دوره قبض (تا تاریخ)');
  if (!billStart || !billEnd) {
    throw new Error('دوره قبض معتبر نیست؛ هر دو تاریخ شروع و پایان را وارد کنید.');
  }
  if (billEnd < billStart) {
    throw new Error('دوره قبض معتبر نیست؛ تاریخ پایان نباید قبل از تاریخ شروع باشد.');
  }
}
