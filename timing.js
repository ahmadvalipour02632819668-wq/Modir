(function (window) {
function debounce(fn, ms = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}
window.ModirTiming = Object.freeze({ debounce });
})(window);
