import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const window = {};
vm.runInNewContext(fs.readFileSync(new URL("../jalali-date.js", import.meta.url), "utf8"), {
  window, Intl, Date, Error, Math, String, Number, Object
});
const dates = window.ModirJalaliDate;

test("normalizes Persian and Arabic-Indic digits", () => {
  assert.equal(dates.normalizeJalaliDigits("۱۴۰۳/۱۲/۳۰"), "1403/12/30");
  assert.equal(dates.normalizeJalaliDigits("١٤٠٣/١٢/٣٠"), "1403/12/30");
});

test("converts a Jalali leap-year final day and round-trips", () => {
  const gregorian = dates.jalaliToGregorianDate("۱۴۰۳/۱۲/۳۰");
  assert.match(gregorian, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dates.gregorianToJalaliDate(gregorian), "1403/12/30");
});

test("calculates Jalali month lengths including Esfand", () => {
  assert.equal(dates.jalaliMonthDays(1403, 12), 30);
  assert.equal(dates.jalaliMonthDays(1402, 12), 29);
  assert.equal(dates.jalaliMonthDays(1403, 7), 30);
});

test("rejects impossible Jalali dates", () => {
  assert.throws(() => dates.jalaliToGregorianDate("1403/07/31"), /معتبر نیست/);
  assert.throws(() => dates.jalaliToGregorianDate("1403/13/01"), /معتبر نیست/);
});
