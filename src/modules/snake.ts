import { coarsePointer, dprScale, prefersReducedMotion } from "./device";

type Vec = { x: number; y: number };
type Pt = { x: number; y: number };

export function initSnake() {
  const viewport = document.getElementById("ascii-snake-viewport") as HTMLElement | null;
  const root = document.getElementById("ascii-snake-root") as HTMLElement | null;
  const canvas = document.getElementById("ascii-snake-canvas") as HTMLCanvasElement | null;
  const scoreEl = document.getElementById("snake-score") as HTMLElement | null;
  const a11yStatusEl = document.getElementById("snake-a11y-status") as HTMLElement | null;
  const contentZoneEl = document.querySelector(".content") as HTMLElement | null;
  if (!viewport || !root || !canvas || !scoreEl) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  function announce(msg: string) {
    if (a11yStatusEl) a11yStatusEl.textContent = msg || "";
  }

  const HIGH_STORAGE_KEY = "phikra-snake-highscore";
  let highScore = 0;
  function loadHighScore() {
    try {
      const raw = localStorage.getItem(HIGH_STORAGE_KEY);
      if (!raw) return;
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n >= 0 && n < 1e6) highScore = n;
    } catch {}
  }
  function saveHighScore() {
    try {
      localStorage.setItem(HIGH_STORAGE_KEY, String(highScore));
    } catch {}
  }
  loadHighScore();

  let W = 20;
  let H = 11;
  let cw = 8;
  let lh = 11;
  let acc = 0;
  let timePrev = 0;
  let maxStepsPerFrame = 6;
  let running = false;
  let renderNeeded = false;

  let snake: Pt[] = [];
  let dir: Vec = { x: 1, y: 0 };
  let nextDir: Vec = { x: 1, y: 0 };
  let food: Pt = { x: 0, y: 0 };
  let score = 0;
  let gameOver = false;

  const mqMobileGrid = window.matchMedia("(max-width: 768px), (pointer: coarse)");

  function getTickMs() {
    if (prefersReducedMotion()) return 100;
    const len = snake?.length ?? 0;
    if (len <= 0) return 46;
    const speedup = Math.min(24, Math.floor((len - 3) / 2) * 2);
    return Math.max(17, 46 - speedup);
  }

  function visualViewportClip() {
    const v = window.visualViewport;
    if (v && v.width > 0 && v.height > 0) {
      return { l: v.offsetLeft, t: v.offsetTop, r: v.offsetLeft + v.width, b: v.offsetTop + v.height };
    }
    return { l: 0, t: 0, r: window.innerWidth, b: window.innerHeight };
  }

  function playAreaBox() {
    let w = viewport.clientWidth;
    let h = viewport.clientHeight;
    if (w < 12 || h < 12) {
      const r = viewport.getBoundingClientRect();
      w = r.width;
      h = r.height;
    }
    if (mqMobileGrid.matches && window.visualViewport) {
      const vv = window.visualViewport;
      if (vv.width > 0) w = Math.min(w, vv.width);
      if (vv.height > 0) h = Math.min(h, vv.height);
    }
    return { w: Math.max(0, w), h: Math.max(0, h) };
  }

  function computeFont() {
    const style = window.getComputedStyle(canvas);
    const fs = parseFloat(style.fontSize) || 11;
    const fw = style.fontWeight || "600";
    const ff = style.fontFamily || 'ui-monospace, "Cascadia Code", Consolas, "Courier New", monospace';
    const font = `${fw} ${fs}px ${ff}`;
    ctx.font = font;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    lh = fs;
    const m = ctx.measureText("M");
    cw = Math.max(6, m.width || fs * 0.62);
  }

  function resizeCanvas() {
    const dpr = dprScale(coarsePointer() ? 1.5 : 2);
    const r = viewport.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cellFullyVisible(fc: number, fy: number) {
    const vr = viewport.getBoundingClientRect();
    const fw = W * cw;
    const fh = H * lh;
    const gL = vr.left + (vr.width - fw) * 0.5;
    const gT = vr.top + (vr.height - fh) * 0.5;
    const ml = gL + fc * cw;
    const mt = gT + fy * lh;
    const mr = ml + cw;
    const mb = mt + lh;
    const clip = visualViewportClip();
    const pad = 6;
    return ml >= clip.l + pad && mt >= clip.t + pad && mr <= clip.r - pad && mb <= clip.b - pad;
  }

  function cellOverlapsContentZone(fc: number, fy: number) {
    if (!contentZoneEl) return false;
    const cr = contentZoneEl.getBoundingClientRect();
    if (cr.width <= 0 || cr.height <= 0) return false;
    const vr = viewport.getBoundingClientRect();
    const fw = W * cw;
    const fh = H * lh;
    const gL = vr.left + (vr.width - fw) * 0.5;
    const gT = vr.top + (vr.height - fh) * 0.5;
    const cellLeft = gL + fc * cw;
    const cellTop = gT + fy * lh;
    const cellRight = cellLeft + cw;
    const cellBottom = cellTop + lh;
    return !(cellRight <= cr.left || cellLeft >= cr.right || cellBottom <= cr.top || cellTop >= cr.bottom);
  }

  function placeFood() {
    // Pass 0: visible + avoid content. Pass 1: visible. Pass 2: any.
    for (let pass = 0; pass < 3; pass++) {
      const avoidContent = pass === 0;
      const requireVisible = pass < 2;
      for (let tries = 0; tries < 500; tries++) {
        const fx = (Math.random() * W) | 0;
        const fy = (Math.random() * H) | 0;
        let ok = true;
        for (let si = 0; si < snake.length; si++) {
          if (snake[si].x === fx && snake[si].y === fy) {
            ok = false;
            break;
          }
        }
        if (ok && requireVisible && !cellFullyVisible(fx, fy)) ok = false;
        if (ok && avoidContent && cellOverlapsContentZone(fx, fy)) ok = false;
        if (ok) {
          food = { x: fx, y: fy };
          return;
        }
      }
    }
    food = { x: 0, y: 0 };
  }

  function setScoreDisplay() {
    scoreEl.textContent = `${score} · best ${highScore}`;
  }

  function resizeGrid() {
    const box = playAreaBox();
    if (box.w < 40 || box.h < 32) return;
    computeFont();

    const ow = W;
    const oh = H;
    let nW = Math.max(8, (box.w / cw) | 0);
    let nH = Math.max(6, (box.h / lh) | 0);
    if (nW > 200) nW = 200;
    if (nH > 100) nH = 100;
    W = nW;
    H = nH;
    if (running && snake?.length && (ow !== W || oh !== H)) {
      reset();
    } else {
      renderNeeded = true;
    }
  }

  let resizeFrame = 0;
  function scheduleResize() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      resizeCanvas();
      resizeGrid();
    });
  }

  function reset() {
    if (!running) return;
    const edge = (Math.random() * 4) | 0;
    let t: number;
    if (edge === 0) {
      t = (Math.random() * W) | 0;
      dir = { x: 0, y: 1 };
      snake = [{ x: t, y: 0 }, { x: t, y: 1 }, { x: t, y: 2 }];
    } else if (edge === 1) {
      t = (Math.random() * W) | 0;
      dir = { x: 0, y: -1 };
      snake = [{ x: t, y: H - 1 }, { x: t, y: H - 2 }, { x: t, y: H - 3 }];
    } else if (edge === 2) {
      t = (Math.random() * H) | 0;
      dir = { x: 1, y: 0 };
      snake = [{ x: 0, y: t }, { x: 1, y: t }, { x: 2, y: t }];
    } else {
      t = (Math.random() * H) | 0;
      dir = { x: -1, y: 0 };
      snake = [{ x: W - 1, y: t }, { x: W - 2, y: t }, { x: W - 3, y: t }];
    }
    nextDir = { x: dir.x, y: dir.y };
    score = 0;
    gameOver = false;
    acc = 0;
    announce("");
    setScoreDisplay();
    placeFood();
    renderNeeded = true;
  }

  function tryStart() {
    if (running) return;
    running = true;
    acc = 0;
    root.classList.add("ascii-snake--running");
    scoreEl.removeAttribute("hidden");
    scheduleResize();
    reset();
  }

  function step() {
    if (gameOver) return;
    if (nextDir.x !== -dir.x || nextDir.y !== -dir.y) {
      dir.x = nextDir.x;
      dir.y = nextDir.y;
    }
    let nx = snake[0].x + dir.x;
    let ny = snake[0].y + dir.y;
    nx = ((nx % W) + W) % W;
    ny = ((ny % H) + H) % H;
    const ate = nx === food.x && ny === food.y;
    snake.unshift({ x: nx, y: ny });
    if (!ate) {
      snake.pop();
    } else {
      score += 1;
      if (score > highScore) {
        highScore = score;
        saveHighScore();
      }
      setScoreDisplay();
      placeFood();
    }
    for (let i = 1; i < snake.length; i++) {
      if (snake[0].x === snake[i].x && snake[0].y === snake[i].y) {
        if (i === snake.length - 1) continue;
        gameOver = true;
        announce(`Game over. Your score was ${score}. Press R to restart.`);
        return;
      }
    }
  }

  function draw() {
    const r = viewport.getBoundingClientRect();
    const vw = r.width;
    const vh = r.height;
    ctx.clearRect(0, 0, vw, vh);
    if (!running || !snake.length) return;
    computeFont();

    const fw = W * cw;
    const fh = H * lh;
    const gL = (vw - fw) * 0.5;
    const gT = (vh - fh) * 0.5;

    // Base snake color.
    ctx.fillStyle = "#e50d4a";
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // Draw snake + spaces not needed.
    for (let i = snake.length - 1; i >= 0; i--) {
      const p = snake[i];
      ctx.fillText(i === 0 ? "@" : "o", gL + p.x * cw, gT + p.y * lh);
    }

    // Draw food with glow.
    ctx.fillStyle = "#9ff7e8";
    ctx.shadowColor = "rgba(120, 255, 230, 0.85)";
    ctx.shadowBlur = coarsePointer() ? 10 : 14;
    ctx.fillText("*", gL + food.x * cw, gT + food.y * lh);

    if (gameOver) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(232, 221, 216, 0.72)";
      ctx.fillText("GAME OVER — R to restart", gL, gT + fh + lh);
    }
  }

  function onKey(e: KeyboardEvent) {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as any).isContentEditable)) {
      return;
    }
    const k = e.key;
    if (!running) {
      if (k === "Tab" || k === "Escape") return;
      tryStart();
      if (k === "r" || k === "R") {
        e.preventDefault();
        return;
      }
    }
    if (k === "ArrowUp" || k === "w" || k === "W") {
      nextDir = { x: 0, y: -1 };
      e.preventDefault();
    } else if (k === "ArrowDown" || k === "s" || k === "S") {
      nextDir = { x: 0, y: 1 };
      e.preventDefault();
    } else if (k === "ArrowLeft" || k === "a" || k === "A") {
      nextDir = { x: -1, y: 0 };
      e.preventDefault();
    } else if (k === "ArrowRight" || k === "d" || k === "D") {
      nextDir = { x: 1, y: 0 };
      e.preventDefault();
    } else if (k === "r" || k === "R") {
      if (running) {
        scheduleResize();
        reset();
      }
      e.preventDefault();
    }
  }

  window.addEventListener("keydown", onKey, false);

  viewport.addEventListener("click", () => {
    tryStart();
    viewport.focus();
  });
  root.addEventListener(
    "touchstart",
    () => {
      tryStart();
    },
    { passive: true },
  );
  root.querySelectorAll<HTMLElement>("[data-snake-dir]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      tryStart();
      const t = (ev.currentTarget as HTMLElement).getAttribute("data-snake-dir")!.split(",");
      nextDir = { x: parseInt(t[0], 10), y: parseInt(t[1], 10) };
      viewport.focus();
    });
  });

  window.addEventListener("resize", scheduleResize, false);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleResize);
    window.visualViewport.addEventListener("scroll", scheduleResize);
  }
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => scheduleResize()).observe(root);
  }
  scheduleResize();

  function gameLoop(now: number) {
    if (timePrev === 0) {
      timePrev = now > 0 ? now : 1;
      if (renderNeeded) {
        draw();
        renderNeeded = false;
      }
      requestAnimationFrame(gameLoop);
      return;
    }
    let dt = now - timePrev;
    timePrev = now;
    if (dt > 250) dt = 250;
    if (dt < 0) dt = 0;
    if (running) {
      acc += dt;
    }
    let steps = 0;
    while (running && !gameOver && steps < maxStepsPerFrame) {
      const stepTick = getTickMs();
      if (acc < stepTick) break;
      acc -= stepTick;
      steps += 1;
      step();
    }
    if (steps > 0 || renderNeeded) {
      draw();
      renderNeeded = false;
    }
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

  // Pause draw when tab hidden (logic still steps only if rAF runs, so stop rAF).
  document.addEventListener("visibilitychange", () => {
    // No-op: rAF throttled by browser; we already debounce resize on wake in other modules.
    if (!document.hidden) scheduleResize();
  });
}

