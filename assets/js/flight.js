/* Optional motion only: every destination and all content work without JavaScript. */
(() => {
  const root = document.documentElement;
  const button = document.querySelector('.motion-toggle');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const stops = [...document.querySelectorAll('.flight-instruments a')];
  const sections = stops.map(link => document.querySelector(link.hash));
  const progress = document.querySelector('.route-progress');
  let paused = preference.matches;
  let scheduled = false;

  function render() {
    scheduled = false;
    const range = root.scrollHeight - innerHeight;
    const fraction = range > 0 ? Math.min(1, Math.max(0, scrollY / range)) : 0;
    progress.textContent = `${Math.round(fraction * 100)}%`;
    let active = 0;
    sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= innerHeight * .45) active = index;
    });
    stops.forEach((link, index) => {
      if (index === active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    root.style.setProperty('--flight-offset', paused ? '0px' : `${Math.min(scrollY, innerHeight) * .13}px`);
    root.style.setProperty('--flight-tilt', paused ? '-5deg' : `${-5 + Math.min(scrollY / innerHeight, 1) * 12}deg`);
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(render); }
  }
  function updateMotion() {
    root.classList.toggle('motion-paused', paused);
    button.setAttribute('aria-pressed', String(paused));
    button.querySelector('.motion-label').textContent = paused ? button.dataset.resume : button.dataset.pause;
    button.querySelector('[aria-hidden]').textContent = paused ? '▷' : 'Ⅱ';
    schedule();
  }
  button.addEventListener('click', () => { paused = !paused; updateMotion(); });
  preference.addEventListener('change', event => { paused = event.matches; updateMotion(); });
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  updateMotion();
})();
