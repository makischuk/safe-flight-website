/* ============================================================
   Safe Flight — "Brand · Product · Experience" blob
   A hardcoded, interactive rebuild of the ethos graphic.
   - organic outline that morphs over time
   - gooey spring physics: the surface reaches toward the pointer
   - three labelled nodes wired back to a central dot
   ============================================================ */
(function () {
  "use strict";

  const TAU = Math.PI * 2;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // Label anchors, normalised to the canvas box (0..1).
  const LABELS = [
    { text: "Brand", x: 0.2, y: 0.5, anchor: "end" },
    { text: "Product", x: 0.66, y: 0.33, anchor: "start" },
    { text: "Experience", x: 0.5, y: 0.63, anchor: "middle" },
  ];
  const CENTER_DOT = { x: 0.46, y: 0.49 };

  class SafeFlightBlob {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      this.w = 0;
      this.h = 0;

      this.N = 110; // outline samples
      this.points = new Array(this.N).fill(0).map(() => ({
        dx: 0,
        dy: 0,
        vx: 0,
        vy: 0,
      }));

      this.pointer = { x: 0, y: 0, active: false };
      this.t = 0;
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

      this.resize();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.w = rect.width;
      this.h = rect.height;
      this.canvas.width = Math.round(rect.width * this.dpr);
      this.canvas.height = Math.round(rect.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
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
      const dt = Math.min(2, (now - (this._last || now)) / 16.6667);
      this._last = now;
      if (this._visible()) {
        this.t += dt;
        this._update(dt);
        this._draw();
      }
      this._raf = requestAnimationFrame(this._loop);
    }

    // Base (un-deformed) outline radius at angle a.
    _shape(a) {
      const rot = -0.5; // tilt long axis to upper-right / lower-left
      let s =
        1.0 +
        0.18 * Math.cos(2 * (a - rot)) + // two lobes → peanut
        0.05 * Math.cos(3 * a + 0.8) + // asymmetry
        0.045 * Math.cos(a + rot); // gentle kidney lean
      if (!reduceMotion) {
        const t = this.t * 0.02;
        s +=
          0.05 * Math.sin(a * 3 + t * 1.6) +
          0.035 * Math.sin(a * 2 - t * 1.1 + 1.7) +
          0.028 * Math.sin(a * 5 + t * 0.9);
      }
      return s;
    }

    _basePoint(i) {
      const a = (i / this.N) * TAU;
      const R = Math.min(this.w, this.h) * 0.4;
      const r = R * this._shape(a);
      const cx = this.w * 0.48;
      const cy = this.h * 0.5;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    }

    _update(dt) {
      const R = Math.min(this.w, this.h) * 0.4;
      const INF = R * 1.15; // pointer influence radius
      const REACH = R * 0.42; // how far surface reaches toward pointer
      const K = 0.11; // spring stiffness
      const DAMP = 0.78; // velocity damping

      for (let i = 0; i < this.N; i++) {
        const p = this.points[i];
        const base = this._basePoint(i);
        let tx = 0,
          ty = 0;

        if (this.pointer.active) {
          const vx = this.pointer.x - base.x;
          const vy = this.pointer.y - base.y;
          const d = Math.hypot(vx, vy) || 1;
          let infl = 1 - d / INF;
          if (infl > 0) {
            infl = infl * infl; // ease
            tx = (vx / d) * REACH * infl;
            ty = (vy / d) * REACH * infl;
          }
        }

        const ax = (tx - p.dx) * K - p.vx * (1 - DAMP);
        const ay = (ty - p.dy) * K - p.vy * (1 - DAMP);
        p.vx = (p.vx + ax * dt) * DAMP;
        p.vy = (p.vy + ay * dt) * DAMP;
        p.dx += p.vx * dt;
        p.dy += p.vy * dt;

        p.x = base.x + p.dx;
        p.y = base.y + p.dy;
      }
    }

    _draw() {
      const ctx = this.ctx;
      const w = this.w,
        h = this.h;
      ctx.clearRect(0, 0, w, h);

      const scale = Math.min(w, h);
      const accent =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--blob-accent")
          .trim() || "#ff5a1f";
      const dotCol =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--blob-dot")
          .trim() || "#ff2d18";
      const lineCol =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--blob-line")
          .trim() || "rgba(255,255,255,0.55)";

      // center dot + label positions (with a whisper of pointer parallax)
      const cx = w * CENTER_DOT.x;
      const cy = h * CENTER_DOT.y;
      const labelPts = LABELS.map((l) => {
        let lx = w * l.x;
        let ly = h * l.y;
        if (this.pointer.active) {
          lx += (this.pointer.x - lx) * 0.02;
          ly += (this.pointer.y - ly) * 0.02;
        }
        return { ...l, x: lx, y: ly };
      });

      // connector lines (dot → each label)
      ctx.lineWidth = 1;
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.85;
      labelPts.forEach((l) => {
        const ang = Math.atan2(l.y - cy, l.x - cx);
        const stopX = l.x - Math.cos(ang) * scale * 0.05;
        const stopY = l.y - Math.sin(ang) * scale * 0.05;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(stopX, stopY);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // organic outline
      this._strokeOutline(lineCol);

      // center dot
      ctx.fillStyle = dotCol;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, scale * 0.009), 0, TAU);
      ctx.fill();

      // labels
      ctx.fillStyle = accent;
      ctx.font = `500 ${Math.max(8, scale * 0.03)}px "Feijoa", Georgia, serif`;
      ctx.textBaseline = "middle";
      labelPts.forEach((l) => {
        ctx.textAlign = l.anchor;
        const pad = l.anchor === "end" ? -6 : l.anchor === "start" ? 6 : 0;
        ctx.fillText(l.text, l.x + pad, l.y);
      });
    }

    _strokeOutline(color) {
      const ctx = this.ctx;
      const pts = this.points;
      const n = pts.length;
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = color;
      ctx.lineJoin = "round";
      ctx.beginPath();
      // Catmull-Rom → bezier, closed loop
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        if (i === 0) ctx.moveTo(p1.x, p1.y);
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  window.SafeFlightBlob = SafeFlightBlob;
})();
