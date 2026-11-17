(function (window) {
  const monthOptions = (sel, withAll = false) => (withAll ? `<option value="">همه ماه‌ها</option>` : '') + MONTHS.map((n, i) => `<option value="${i+1}" ${+sel === i+1 ? 'selected' : ''}>${n}</option>`).join('');
  const yearOptions = (sel) => { const ys = []; for (let y = TODAY.y + 10; y >= 1403; y--) ys.push(y); return ys.map(y => `<option value="${y}" ${+y === +sel ? 'selected' : ''}>${fa(y)}</option>`).join(''); };
  const unitOptions = (sel, withBuilding = true, withAll = false) => (withAll ? `<option value="">همه</option>` : '') + (withBuilding ? `<option value="0" ${+sel === 0 ? 'selected' : ''}>ساختمان</option>` : '') + Array.from({length:(S.unitCount || 10)}, (_,i) => `<option value="${i+1}" ${+sel === i+1 ? 'selected' : ''}>واحد ${fa(i+1)}</option>`).join('');
  let periodAbort = null;
  function bindPeriod(cb) {
    periodAbort?.abort(); periodAbort = new AbortController(); const opt = { signal: periodAbort.signal };
    $('#pk-m')?.addEventListener('change', e => { S.m = +e.target.value; cb(); }, opt);
    $('#pk-y')?.addEventListener('change', e => { S.y = +e.target.value; cb(); }, opt);
  }
  function periodPicker() { return `<div style="display:flex;gap:10px;margin-bottom:20px"><select id="pk-m" style="width:120px">${monthOptions(S.m)}</select><select id="pk-y" style="width:100px">${yearOptions(S.y)}</select></div>`; }
  window.ModirPeriodUi = Object.freeze({ monthOptions, yearOptions, unitOptions, bindPeriod, periodPicker });
})(window);
