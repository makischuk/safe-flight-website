/* ============================================================
   Safe Flight — "Brand · Product · Experience" metaball
   Three connected circles drift around; where they meet, the
   outline bridges with a smooth gooey neck (metaball field +
   marching-squares contour). One continuous thin white line.
   - autonomous orbit motion
   - pointer shoves the circles around (spring back to orbit)
   - white center dot wired to three labels
   ============================================================ */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Fixed label anchors, normalised to the canvas box (0..1).
  const LABELS = [
    { text: "Brand", x: 0.3, y: 0.45, anchor: "end" },
    { text: "Product", x: 0.6, y: 0.4, anchor: "start" },
    { text: "Experience", x: 0.53, y: 0.61, anchor: "middle" },
  ];
  const CENTER = { x: 0.47, y: 0.49 };

  // Three metaball circles (normalised base position + radius + orbit).
  // Centers sit far enough apart that the field dips between them → real necks.
  const CIRCLES = [
    { bx: 0.29, by: 0.37, r: 0.19, sx: 0.53, sy: 0.37, ph: 0.0, orbit: 0.075 },
    { bx: 0.7, by: 0.4, r: 0.2, sx: 0.41, sy: 0.61, ph: 2.1, orbit: 0.075 },
    { bx: 0.5, by: 0.69, r: 0.19, sx: 0.62, sy: 0.47, ph: 4.0, orbit: 0.08 },
  ];

  const THRESHOLD = 1.5; // iso value of the metaball field (higher = leaner necks)
  const GRID = 74; // contour resolution (divisions across the short side)

  // marching-squares segment table. bits: tl=1, tr=2, br=4, bl=8.
  // edge crossing points: a=top, b=right, c=bottom, d=left.
  const CASES = [
    [], [["d", "a"]], [["a", "b"]], [["d", "b"]],
    [["b", "c"]], [["d", "a"], ["b", "c"]], [["a", "c"]], [["d", "c"]],
    [["c", "d"]], [["a", "c"]], [["a", "b"], ["c", "d"]], [["b", "c"]],
    [["b", "d"]], [["a", "b"]], [["d", "a"]], [],
  ];

  class SafeFlightBlob {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      this.w = 0;
      this.h = 0;
      this.t = 0;

      this.circles = CIRCLES.map((c) => ({
        ...c,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rad: 0,
      }));

      this.pointer = { x: 0, y: 0, active: false };
      this.running = false;
      this._raf = null;

      this._onMove = this._onMove.bind(this);
      this._onLeave = this._onLeave.bind(this);
      this._loop = this._loop.bind(this);

      canvas.addEventListener("pointermove", this._onMove);
      canvas.addEventListener("pointerleave", this._onLeave);
      canvas.addEventListener("pointerdown", this._onMove);

      this._ro =
        "ResizeObserver" in window
          ? new ResizeObserver(() => this.resize())
          : null;
      if (this._ro) this._ro.observe(canvas);
      else window.addEventListener("resize", () => this.resize());

      this._readColors();
      this.resize();
      this._initPositions();
    }

    _readColors() {
      const cs = getComputedStyle(document.documentElement);
      this.colLine =
        cs.getPropertyValue("--blob-line").trim() || "rgba(255,255,255,0.85)";
      this.colDot =
        cs.getPropertyValue("--blob-dot").trim() || "#ffffff";
      this.colAccent =
        cs.getPropertyValue("--blob-label").trim() || "#ffffff";
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.w = rect.width;
      this.h = rect.height;
      this.canvas.width = Math.round(rect.width * this.dpr);
      this.canvas.height = Math.round(rect.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this._initPositions(); // snap circles to the new box so a resize never lags
    }

    _initPositions() {
      this.circles.forEach((c) => {
        c.x = c.bx * this.w;
        c.y = c.by * this.h;
      });
    }

    _onMove(e) {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - rect.left;
      this.pointer.y = e.clientY - rect.top;
      this.pointer.active = true;
    }
    _onLeave() {
      this.pointer.active = false;
    }

    start() {
      if (this.running) return;
      this.running = true;
      this._last = performance.now();
      this._raf = requestAnimationFrame(this._loop);
    }
    stop() {
      this.running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    destroy() {
      this.stop();
      if (this._ro) this._ro.disconnect();
      this.canvas.removeEventListener("pointermove", this._onMove);
      this.canvas.removeEventListener("pointerleave", this._onLeave);
      this.canvas.removeEventListener("pointerdown", this._onMove);
    }

    _visible() {
      return this.canvas.offsetParent !== null && this.w > 0 && this.h > 0;
    }

    _loop(now) {
      if (!this.running) return;
      const dt = Math.min(2.2, (now - (this._last || now)) / 16.6667);
      this._last = now;
      if (this._visible()) {
        this.t += dt;
        this._update(dt);
        this._draw();
      }
      this._raf = requestAnimationFrame(this._loop);
    }

    _update(dt) {
      const min = Math.min(this.w, this.h);
      const t = this.t * 0.012;
      const INF = min * 0.55;
      const K = 0.045; // spring back to orbit
      const DAMP = 0.86;

      for (const c of this.circles) {
        c.rad = c.r * min;

        // autonomous orbit target
        let tx = c.bx * this.w;
        let ty = c.by * this.h;
        if (!reduceMotion) {
          tx += Math.sin(t * c.sx + c.ph) * c.orbit * this.w;
          ty += Math.cos(t * c.sy + c.ph * 1.3) * c.orbit * this.h;
        }

        let fx = (tx - c.x) * K;
        let fy = (ty - c.y) * K;

        // pointer shoves the circle away, then it springs back
        if (this.pointer.active) {
          const dx = c.x - this.pointer.x;
          const dy = c.y - this.pointer.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < INF) {
            const push = (1 - d / INF) * 0.9;
            fx += (dx / d) * push;
            fy += (dy / d) * push;
          }
        }

        c.vx = (c.vx + fx) * DAMP;
        c.vy = (c.vy + fy) * DAMP;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }
    }

    _field(x, y) {
      let sum = 0;
      for (const c of this.circles) {
        const dx = x - c.x;
        const dy = y - c.y;
        sum += (c.rad * c.rad) / (dx * dx + dy * dy + 1);
      }
      return sum;
    }

    _draw() {
      const ctx = this.ctx;
      const w = this.w,
        h = this.h;
      ctx.clearRect(0, 0, w, h);
      const scale = Math.min(w, h);

      // ---- metaball contour via marching squares ----
      const step = scale / GRID;
      const cols = Math.ceil(w / step) + 1;
      const rows = Math.ceil(h / step) + 1;
      const T = THRESHOLD;

      // sample the field on the grid
      const g = this._grid || (this._grid = []);
      for (let i = 0; i <= cols; i++) {
        const col = g[i] || (g[i] = []);
        const x = i * step;
        for (let j = 0; j <= rows; j++) {
          col[j] = this._field(x, j * step);
        }
      }

      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const x0 = i * step;
        const x1 = x0 + step;
        for (let j = 0; j < rows; j++) {
          const y0 = j * step;
          const y1 = y0 + step;
          const tl = g[i][j];
          const tr = g[i + 1][j];
          const br = g[i + 1][j + 1];
          const bl = g[i][j + 1];

          let idx = 0;
          if (tl >= T) idx |= 1;
          if (tr >= T) idx |= 2;
          if (br >= T) idx |= 4;
          if (bl >= T) idx |= 8;
          const segs = CASES[idx];
          if (!segs.length) continue;

          // edge crossing points (lazy)
          const pts = {
            a: null,
            b: null,
            c: null,
            d: null,
          };
          const lerp = (lo, hi) => (T - lo) / (hi - lo);
          for (const seg of segs) {
            for (const e of seg) {
              if (pts[e]) continue;
              if (e === "a") pts.a = [x0 + step * lerp(tl, tr), y0];
              else if (e === "b") pts.b = [x1, y0 + step * lerp(tr, br)];
              else if (e === "c") pts.c = [x0 + step * lerp(bl, br), y1];
              else pts.d = [x0, y0 + step * lerp(tl, bl)];
            }
          }
          for (const seg of segs) {
            const p = pts[seg[0]];
            const q = pts[seg[1]];
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(q[0], q[1]);
          }
        }
      }
      ctx.lineWidth = Math.max(1, scale * 0.0038);
      ctx.strokeStyle = this.colLine;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // ---- center dot + connector lines + labels ----
      const cx = w * CENTER.x;
      const cy = h * CENTER.y;
      const labelPts = LABELS.map((l) => ({
        ...l,
        px: w * l.x,
        py: h * l.y,
      }));

      ctx.lineWidth = 1;
      ctx.strokeStyle = this.colLine;
      ctx.globalAlpha = 0.55;
      labelPts.forEach((l) => {
        const ang = Math.atan2(l.py - cy, l.px - cx);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(l.px - Math.cos(ang) * scale * 0.05, l.py - Math.sin(ang) * scale * 0.05);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      ctx.fillStyle = this.colDot;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2.5, scale * 0.011), 0, TAU);
      ctx.fill();

      ctx.fillStyle = this.colAccent;
      ctx.font = `600 ${Math.max(9, scale * 0.032)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.textBaseline = "middle";
      labelPts.forEach((l) => {
        ctx.textAlign = l.anchor;
        const pad = l.anchor === "end" ? -8 : l.anchor === "start" ? 8 : 0;
        ctx.fillText(l.text, l.px + pad, l.py);
      });
    }
  }

  window.SafeFlightBlob = SafeFlightBlob;
})();
