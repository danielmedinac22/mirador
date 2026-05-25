/* Deck theme — slide counter, progress bar, arrow-key navigation. */
(function () {
  const root = document.querySelector('.mirador-content') || document.body;
  let slides = Array.from(root.querySelectorAll(':scope > section, :scope > .slide'));

  // If there are no explicit <section>s, treat each top-level h1/h2 as a slide boundary
  // and synthesise sections. Done client-side so authors can ship plain content.
  if (slides.length === 0) {
    const wrap = (node) => {
      const sec = document.createElement('section');
      sec.className = 'slide';
      sec.appendChild(node);
      return sec;
    };
    const children = Array.from(root.children);
    if (children.length > 0) {
      const sections = [];
      let current = null;
      for (const child of children) {
        if (child.matches && child.matches('h1, h2')) {
          if (current) sections.push(current);
          current = wrap(child);
        } else if (current) {
          current.appendChild(child);
        } else {
          current = wrap(child);
        }
      }
      if (current) sections.push(current);
      root.innerHTML = '';
      sections.forEach((s) => root.appendChild(s));
      slides = sections;
    }
  }
  const total = slides.length;
  if (total < 2) return;

  // Counter
  const counter = document.createElement('div');
  counter.className = 'deck-counter';
  counter.innerHTML = `<span class="current">1</span><span class="sep">/</span><span class="total">${total}</span>`;
  document.body.appendChild(counter);

  // Progress bar
  const progress = document.createElement('div');
  progress.className = 'deck-progress';
  progress.style.width = `${100 / total}%`;
  document.body.appendChild(progress);

  // Hint
  const hint = document.createElement('div');
  hint.className = 'deck-hint';
  hint.textContent = '↓ scroll or arrow keys';
  document.body.appendChild(hint);
  setTimeout(() => hint.remove(), 5000);

  // Current index detection via IntersectionObserver
  let currentIdx = 0;
  const update = (idx) => {
    currentIdx = idx;
    counter.querySelector('.current').textContent = String(idx + 1);
    progress.style.width = `${((idx + 1) / total) * 100}%`;
  };
  const io = new IntersectionObserver(
    (entries) => {
      let best = null;
      let bestRatio = 0;
      for (const e of entries) {
        if (e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio;
          best = e.target;
        }
      }
      if (best) update(slides.indexOf(best));
    },
    { threshold: [0.5, 0.6, 0.7, 0.8, 0.9] },
  );
  slides.forEach((s) => io.observe(s));

  // Keyboard nav
  const goTo = (idx) => {
    const clamped = Math.max(0, Math.min(total - 1, idx));
    slides[clamped].scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      goTo(currentIdx + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      goTo(currentIdx - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTo(total - 1);
    }
  });
})();
