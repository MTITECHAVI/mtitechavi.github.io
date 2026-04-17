import { coarsePointer, dprScale, prefersReducedMotion } from "./device";

type Stream = {
  col: number;
  y: number;
  speed: number;
  len: number;
};

export function initAsciiBackground() {
  const wrap = document.querySelector<HTMLElement>(".ascii-bg");
  if (!wrap) return;

  // Prefer canvas; keep old <pre> as no-JS fallback.
  const canvas =
    document.querySelector<HTMLCanvasElement>("#ascii-anim-canvas") ??
    (() => {
      const c = document.createElement("canvas");
      c.id = "ascii-anim-canvas";
      c.className = "ascii-stage ascii-stage--canvas";
      wrap.appendChild(c);
      return c;
    })();

  const legacyPre = document.getElementById("ascii-anim");
  if (legacyPre) legacyPre.setAttribute("hidden", "true");

  if (prefersReducedMotion()) {
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const headGlyphs = ".*@o+01#%&/|><=-ABCDEFGHXYZ";
  let cols = 40;
  let rows = 14;
  const streams: Stream[] = [];
  let grid: string[][] = [];

  let cw = 10;
  let lh = 14;
  let font = '600 16px ui-monospace, "Cascadia Code", Consolas, "Courier New", monospace';
  let fillStyle = "rgba(200, 195, 192, 0.28)";

  function trailChar(k: number, len: number) {
    const f = k / len;
    if (f < 0.14) return ":";
    if (f < 0.28) return "/";
    if (f < 0.42) return ".";
    if (f < 0.56) return "'";
    if (f < 0.7) return ",";
    if (f < 0.84) return "`";
    if (f < 0.93) return ";";
    return " ";
  }

  function initStreams() {
    streams.length = 0;
    if (cols < 4) return;
    const count = Math.min(56, Math.max(18, (cols * 0.58) | 0));
    const step = cols / count;
    for (let i = 0; i < count; i++) {
      const base = (i + 0.5) * step;
      const jitter = (Math.random() - 0.5) * Math.min(2.75, step * 0.6);
      let col = (base + jitter) | 0;
      col = Math.max(0, Math.min(cols - 1, col));
      streams.push({
        col,
        y: Math.random() * -rows * 1.25 - (i % 9) * 2.5,
        speed: 0.052 + Math.random() * 0.1,
        len: 10 + ((Math.random() * 14) | 0),
      });
    }
  }

  function measure() {
    const style = window.getComputedStyle(canvas);
    const fs = parseFloat(style.fontSize) || 16;
    const fw = style.fontWeight || "600";
    const ff = style.fontFamily || 'ui-monospace, "Courier New", monospace';
    font = `${fw} ${fs}px ${ff}`;
    fillStyle = style.color || "rgba(200, 195, 192, 0.28)";
    lh = fs;

    // Canvas text metrics baseline.
    ctx.font = font;
    const m = ctx.measureText("M");
    cw = Math.max(6, m.width || fs * 0.62);
  }

  function layout() {
    measure();
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const nextCols = Math.max(24, (w / cw) | 0);
    const nextRows = Math.max(16, (h / lh) | 0);
    if (nextCols !== cols || nextRows !== rows) {
      cols = nextCols;
      rows = nextRows;
      grid = new Array(rows);
      for (let y = 0; y < rows; y++) grid[y] = new Array(cols);
      initStreams();
    }
  }

  function resizeCanvas() {
    const dpr = dprScale(coarsePointer() ? 1.5 : 2);
    const w = Math.max(1, wrap.clientWidth);
    const h = Math.max(1, wrap.clientHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let raf = 0;
  let prev = 0;
  const targetMs = coarsePointer() ? 33 : 16; // ~30fps on touch, ~60fps on desktop

  function tick(now: number) {
    raf = requestAnimationFrame(tick);
    if (now - prev < targetMs) return;
    prev = now;

    // Clear
    ctx.clearRect(0, 0, wrap.clientWidth, wrap.clientHeight);
    ctx.font = font;
    ctx.fillStyle = fillStyle;
    ctx.textBaseline = "top";

    // Reset grid
    for (let y = 0; y < rows; y++) {
      const row = grid[y];
      for (let x = 0; x < cols; x++) row[x] = " ";
    }

    // Update streams
    for (let si = 0; si < streams.length; si++) {
      const s = streams[si];
      s.y += s.speed;
      if (s.y - s.len > rows + 4) {
        s.y = -2 - Math.random() * (rows * 0.55);
        s.len = 10 + ((Math.random() * 14) | 0);
        s.speed = 0.048 + Math.random() * 0.1;
      }
      const head = s.y | 0;
      for (let k = 0; k < s.len; k++) {
        const yy = head - k;
        if (yy < 0 || yy >= rows) continue;
        grid[yy][s.col] =
          k === 0 ? headGlyphs[(Math.random() * headGlyphs.length) | 0] : trailChar(k, s.len);
      }
    }

    // Draw lines
    for (let y = 0; y < rows; y++) {
      ctx.fillText(grid[y].join(""), 0, y * lh);
    }
  }

  function syncAll() {
    resizeCanvas();
    layout();
  }

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncAll) : null;
  if (ro) ro.observe(wrap);
  window.addEventListener("resize", syncAll, { passive: true });
  syncAll();

  function start() {
    if (raf) return;
    prev = 0;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (!raf) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  let visible = true;
  function updateRunState() {
    if (document.hidden || !visible) stop();
    else start();
  }

  const io =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((entries) => {
          const e = entries[0];
          visible = !!e?.isIntersecting;
          updateRunState();
        })
      : null;
  if (io) io.observe(wrap);
  updateRunState();

  // Safari tab-sleep wake: re-sync.
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) syncAll();
      updateRunState();
    },
    false,
  );
}

