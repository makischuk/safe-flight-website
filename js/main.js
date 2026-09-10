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

  /* ---------- fullscreen (FLIP: the same blob scales up + moves) ---------- */
  let fsOpen = false;
  let xbtn = null;
  const EASE = "cubic-bezier(.16,1,.3,1)";

  const activeWrap = () =>
    [...document.querySelectorAll(".blob-wrap")].find((w) => w.offsetParent);
  const activeHead = () => {
    const h = document.querySelector(".layout--desktop .ethos-head");
    return h && h.offsetParent ? h : null;
  };

  // Animate `el` from its current box to the box it has after `mutate()` runs
  // (FLIP), using the Web Animations API for reliable from→to playback.
  function flipTo(el, mutate, dur) {
    const first = el.getBoundingClientRect();
    mutate();
    const last = el.getBoundingClientRect();
    if (reduceMotion) return;
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = last.width ? first.width / last.width : 1;
    const sy = last.height ? first.height / last.height : 1;
    el.animate(
      [
        {
          transformOrigin: "top left",
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
        },
        { transformOrigin: "top left", transform: "none" },
      ],
      { duration: dur * 1000, easing: EASE }
    );
  }

  // Shrink a fullscreen element back to its inline box, staying at full-res
  // layout (is-fs) for the whole animation so it stays crisp, then drop is-fs.
  function shrinkToInline(el, dur) {
    const first = el.getBoundingClientRect(); // fullscreen
    el.classList.remove("is-fs");
    const target = el.getBoundingClientRect(); // inline
    el.classList.add("is-fs");
    const finish = () => el.classList.remove("is-fs");
    if (reduceMotion) return finish();
    const dx = target.left - first.left;
    const dy = target.top - first.top;
    const sx = first.width ? target.width / first.width : 1;
    const sy = first.height ? target.height / first.height : 1;
    const anim = el.animate(
      [
        { transformOrigin: "top left", transform: "none" },
        {
          transformOrigin: "top left",
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
        },
      ],
      { duration: dur * 1000, easing: EASE }
    );
    anim.onfinish = finish;
    anim.oncancel = finish;
  }

  // A non-none transform/filter/perspective on an ancestor makes it the
  // containing block for our fixed fullscreen blob (pinning it off-center).
  // Neutralize such ancestors while open, restore them on close.
  let fsNeutralized = [];
  function neutralizeAncestors(el) {
    fsNeutralized = [];
    let p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (
        cs.transform !== "none" ||
        cs.filter !== "none" ||
        cs.perspective !== "none" ||
        cs.willChange.indexOf("transform") !== -1
      ) {
        fsNeutralized.push([p, p.style.cssText]);
        p.style.transform = "none";
        p.style.filter = "none";
        p.style.perspective = "none";
        p.style.willChange = "auto";
      }
      p = p.parentElement;
    }
  }
  function restoreAncestors() {
    fsNeutralized.forEach(([p, css]) => (p.style.cssText = css));
    fsNeutralized = [];
  }

  function ensureX() {
    if (xbtn) return;
    xbtn = document.createElement("button");
    xbtn.className = "blob-fs-x";
    xbtn.setAttribute("aria-label", "Close fullscreen");
    xbtn.textContent = "✕";
    xbtn.addEventListener("click", closeFullscreen);
    document.body.appendChild(xbtn);
  }

  function onFsKey(e) {
    if (e.key === "Escape") closeFullscreen();
  }

  function openFullscreen() {
    if (fsOpen) return;
    const wrap = activeWrap();
    if (!wrap) return;
    fsOpen = true;
    document.body.classList.add("fs-open");
    neutralizeAncestors(wrap);
    flipTo(wrap, () => wrap.classList.add("is-fs"), 0.62);
    const head = activeHead();
    if (head) flipTo(head, () => head.classList.add("is-fs"), 0.62);
    ensureX();
    requestAnimationFrame(() => xbtn.classList.add("is-in"));
    document.addEventListener("keydown", onFsKey);
  }

  function closeFullscreen() {
    if (!fsOpen) return;
    fsOpen = false;
    document.removeEventListener("keydown", onFsKey);
    document.body.classList.remove("fs-open");
    if (xbtn) xbtn.classList.remove("is-in");
    const wrap = document.querySelector(".blob-wrap.is-fs");
    const head = document.querySelector(".ethos-head.is-fs");
    if (wrap) shrinkToInline(wrap, 0.55);
    if (head) flipTo(head, () => head.classList.remove("is-fs"), 0.55);
    setTimeout(restoreAncestors, reduceMotion ? 0 : 580);
  }

  document.querySelectorAll(".blob-wrap").forEach((wrap) => {
    wrap.addEventListener("click", () => {
      if (!fsOpen) openFullscreen();
    });
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
