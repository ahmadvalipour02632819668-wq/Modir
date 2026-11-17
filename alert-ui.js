(function (window) {
  function alertSeenKey() {
    return 'bm_alerts_seen:' + String(S.me?.id || S.me?.account_id || S.me?.username || S.me?.building_id || 'account');
  }
  function getSeenAlertIds() {
    try {
      const value = JSON.parse(localStorage.getItem(alertSeenKey()) || '[]');
      return new Set(Array.isArray(value) ? value : []);
    } catch (_) { return new Set(); }
  }
  function saveSeenAlertIds(seen) {
    localStorage.setItem(alertSeenKey(), JSON.stringify([...seen].slice(-3000)));
  }
  function markAlertSeen(id) {
    const seen = getSeenAlertIds();
    seen.add(String(id));
    saveSeenAlertIds(seen);
  }
  function markAlertPrefixSeen(prefix) {
    const seen = getSeenAlertIds();
    (window.__modirCurrentAlerts || []).filter(item => item.id.startsWith(prefix)).forEach(item => seen.add(item.id));
    saveSeenAlertIds(seen);
  }
  window.ModirAlertUi = Object.freeze({ getSeenAlertIds, markAlertSeen, markAlertPrefixSeen });
})(window);
