/* ============================================================
   Safe Flight — page orchestration
   Buttery load-in cascade: wordmark → email → sections I…IV.
   ============================================================ */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  function runReveal() {
    // reveal in DOM order, with the wordmark ("logo") leading.
    // We reveal every [data-reveal] regardless of whether its layout is
    // currently shown — elements hidden via CSS (the other breakpoint's
    // wordmark / email) stay display:none, so marking them here just means
    // they're already revealed if the viewport later crosses the breakpoint.
    const all = Array.from(document.querySelectorAll("[data-reveal]"));
    all.sort((a, b) => {
      const la = a.dataset.reveal === "logo" ? 0 : 1;
      const lb = b.dataset.reveal === "logo" ? 0 : 1;
      return la - lb;
    });

    if (reduceMotion) {
      all.forEach((el) => el.classList.add("is-in"));
      return;
    }

    all.forEach((el, i) => {
      const delay = i === 0 ? 120 : 460 + (i - 1) * 130;
      setTimeout(() => el.classList.add("is-in"), delay);
    });
  }

  function boot() {
    const go = () => requestAnimationFrame(runReveal);
    // let the webfont settle so the reveal doesn't flash-reflow
    if (document.fonts && document.fonts.ready) {
      let done = false;
      const once = () => {
        if (done) return;
        done = true;
        go();
      };
      document.fonts.ready.then(once);
      setTimeout(once, 500); // fallback
    } else {
      go();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
