// Owl site: optional holiday-outfit toggle for the pet companions. Page works fully without JS.
(() => {
  const btn = document.querySelector("[data-pet-toggle]");
  if (!btn) return;
  const imgs = document.querySelectorAll("img[data-holiday]");
  imgs.forEach((img) => {
    img.dataset.everyday = img.getAttribute("src");
    img.dataset.altEveryday = img.getAttribute("alt");
  });
  btn.hidden = false;
  btn.addEventListener("click", () => {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    imgs.forEach((img) => {
      img.src = on ? img.dataset.holiday : img.dataset.everyday;
      img.alt = on ? img.dataset.altHoliday : img.dataset.altEveryday;
    });
  });
})();
