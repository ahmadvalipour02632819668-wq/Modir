(function (window) {
function setTheme(theme) {
  if (theme === 'default') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('bm_theme', theme);
  document.querySelectorAll('.theme-dot').forEach(d => d.classList.toggle('active', d.dataset.t === theme));
}
window.ModirTheme = Object.freeze({ setTheme });
})(window);
