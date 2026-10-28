(() => {
  const track = document.getElementById("pet-carousel-track");
  if (!track) return;
  const prev = document.querySelector("[data-carousel-prev]");
  const next = document.querySelector("[data-carousel-next]");
  const step = () => {
    const firstCard = track.querySelector(".pet-card");
    return firstCard ? firstCard.getBoundingClientRect().width + 20 : 320;
  };
  if (prev) {
    prev.addEventListener("click", () => {
      track.scrollBy({ left: -step() * 2, behavior: "smooth" });
    });
  }
  if (next) {
    next.addEventListener("click", () => {
      track.scrollBy({ left: step() * 2, behavior: "smooth" });
    });
  }
})();
