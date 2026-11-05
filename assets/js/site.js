// Screenshot fallback: if a language-specific screenshot (e.g. hero-en.png) is missing, show the default (zh) file.
(() => {
  document.querySelectorAll("img[data-fallback]").forEach((img) => {
    const swap = () => {
      if (img.dataset.fellBack) return;
      img.dataset.fellBack = "1";
      img.src = img.dataset.fallback;
    };
    img.addEventListener("error", swap);
    if (img.complete && img.naturalWidth === 0) swap();
  });
})();
