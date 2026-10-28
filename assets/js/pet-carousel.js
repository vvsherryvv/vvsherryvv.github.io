(() => {
  const stepFor = (track) => {
    const firstCard = track.querySelector(".pet-card, .flow-card, .step-card");
    return firstCard ? firstCard.getBoundingClientRect().width + 20 : 320;
  };

  document.querySelectorAll("[data-carousel-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-carousel-target");
      const dir = Number(btn.getAttribute("data-carousel-dir") || "1");
      const track = targetId ? document.getElementById(targetId) : null;
      if (!track) return;
      track.scrollBy({ left: dir * stepFor(track) * 1.2, behavior: "smooth" });
    });
  });

  const petTrack = document.getElementById("pet-carousel-track");
  if (petTrack) {
    const prev = document.querySelector("[data-carousel-prev]");
    const next = document.querySelector("[data-carousel-next]");
    if (prev && !prev.hasAttribute("data-carousel-target")) {
      prev.addEventListener("click", () => {
        petTrack.scrollBy({ left: -stepFor(petTrack) * 2, behavior: "smooth" });
      });
    }
    if (next && !next.hasAttribute("data-carousel-next-bound")) {
      next.addEventListener("click", () => {
        petTrack.scrollBy({ left: stepFor(petTrack) * 2, behavior: "smooth" });
      });
    }
  }
})();
