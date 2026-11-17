(function () {
async function compressImage(file) {
  return new Promise(resolve => {
    if (!(file instanceof File) || !file.type.startsWith('image/')) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas'); const MAX = 1000;
        let w = img.naturalWidth || img.width; let h = img.naturalHeight || img.height;
        if (!w || !h) { resolve(null); return; }
        const scale = Math.min(1, MAX / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d'); if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.62));
      };
      img.onerror = () => resolve(null); img.src = ev.target.result;
    };
    reader.onerror = () => resolve(null); reader.readAsDataURL(file);
  });
}

window.ModirMedia = Object.freeze({ compressImage });
})();
