/* ============================================================
   Safe Flight — page orchestration
   - buttery load-in cascade: logo → text → sections I…V
   - instantiate the interactive blob(s)
   - click / keyboard → fullscreen blob with a centered X close
   ============================================================ */
(function () {
  "use strict";

  const card = document.getElementById("card");
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---------- load-in cascade ---------- */
  function runReveal() {
    const all = Array.from(document.querySelectorAll("[data-reveal]"));
    // only the layout that is actually visible
    const visible = all.filter((el) => el.offsetParent !== null);
    // logo leads, everything else follows in DOM order
    visible.sort((a, b) => {
      const la = a.dataset.reveal === "logo" ? 0 : 1;
      const lb = b.dataset.reveal === "logo" ? 0 : 1;
      return la - lb;
    });

    if (reduceMotion) {
      visible.forEach((el) => el.classList.add("is-in"));
      card.classList.add("is-loaded");
      return;
    }

    setTimeout(() => card.classList.add("is-loaded"), 320);
    visible.forEach((el, i) => {
      const delay = i === 0 ? 120 : 500 + (i - 1) * 175;
      setTimeout(() => el.classList.add("is-in"), delay);
    });
  }

  function boot() {
    // give the webfont a beat so the reveal doesn't flash-reflow
    const go = () => requestAnimationFrame(runReveal);
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

  /* ---------- blobs ---------- */
  const blobs = [];
  document.querySelectorAll(".blob-canvas").forEach((c) => {
    const b = new SafeFlightBlob(c);
    b.start();
    blobs.push(b);
  });

  /* ---------- fullscreen ---------- */
  let overlay = null;

  function openFullscreen() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "blob-fs";
    overlay.innerHTML =
      '<canvas class="blob-fs__canvas"></canvas>' +
      '<button class="blob-fs__close" aria-label="Close fullscreen">✕</button>';
    document.body.appendChild(overlay);
    document.body.classList.add("fs-open");

    const fsBlob = new SafeFlightBlob(overlay.querySelector(".blob-fs__canvas"));
    fsBlob.resize();
    fsBlob.start();

    requestAnimationFrame(() => overlay.classList.add("is-open"));

    const close = () => closeFullscreen(fsBlob);
    overlay.querySelector(".blob-fs__close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(); // click backdrop
    });
    overlay._onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", overlay._onKey);
    overlay._blob = fsBlob;
    overlay._closeFn = close;
  }

  function closeFullscreen(fsBlob) {
    if (!overlay) return;
    const ov = overlay;
    overlay = null;
    document.removeEventListener("keydown", ov._onKey);
    ov.classList.remove("is-open");
    document.body.classList.remove("fs-open");
    const cleanup = () => {
      fsBlob.destroy();
      ov.remove();
    };
    if (reduceMotion) cleanup();
    else setTimeout(cleanup, 500);
  }

  document.querySelectorAll(".blob-wrap").forEach((wrap) => {
    wrap.addEventListener("click", openFullscreen);
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFullscreen();
      }
    });
  });

  /* ---------- go ---------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
