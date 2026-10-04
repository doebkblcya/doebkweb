type Action = 'idle' | 'tilt' | 'lick' | 'yawn';
type Format = 'webm' | 'hevc';
type Clip = {
  webm: string; hevc: string;
  layout: { left: number; top: number; width: number; height: number };
};
const BLEND_MS = 1000 * 2 / 24;
const CLICK_GAP_MS = 500;

export function initAboutCats() {
  const figures = [...document.querySelectorAll<HTMLElement>('[data-about-cat]')];
  if (!figures.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  const probe = document.createElement('video');
  const ua = navigator.userAgent;
  const apple = /iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    || (/Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua));
  const format: Format | undefined = apple
    ? (probe.canPlayType('video/mp4; codecs="hvc1"') ? 'hevc' : undefined)
    : (probe.canPlayType('video/webm; codecs="vp9"') ? 'webm' : undefined);
  let active = true, focused = document.hasFocus(), covered = false;

  const controllers = figures.map(figure => {
    const button = figure.querySelector<HTMLButtonElement>('button')!;
    const canvas = figure.querySelector<HTMLCanvasElement>('canvas')!;
    const ctx = canvas.getContext('2d');
    const clips = JSON.parse(figure.dataset.clips!) as Record<Action, Clip>;
    const outgoing = document.createElement('canvas');
    outgoing.width = canvas.width; outgoing.height = canvas.height;
    const out = outgoing.getContext('2d')!;
    // Two reusable decoders per cat; cached actions remain compressed Blobs.
    const slots = [0, 1].map(() => {
      const video = document.createElement('video');
      video.muted = true; video.playsInline = true; video.preload = 'auto';
      video.disablePictureInPicture = true;
      video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1;
      figure.append(video);
      return { video, action: undefined as Action | undefined, ready: Promise.resolve(), cancel: () => {} };
    });
    const sources = new Map<Action, Promise<string>>();
    let visible = false, failed = !ctx || !format, disposed = false;
    let started = false, starting = false, warming = false;
    let current = 0, action: Action = 'idle', pending: Action | undefined;
    let token = 0, lastClick = -Infinity, timer = 0;
    let frameHandle = 0, frameVideo: HTMLVideoElement | undefined, raf = 0, lastDraw = 0;
    let transitionStart: number | undefined;
    const canPlay = () => active && focused && visible && !document.hidden && !covered && !reduced.matches && !failed && !disposed;
    const clearTimer = () => { clearTimeout(timer); timer = 0; };
    const scheduleLick = () => {
      clearTimer();
      if (canPlay() && started && action === 'idle' && !pending) {
        timer = window.setTimeout(() => {
          timer = 0;
          if (canPlay() && action === 'idle' && !pending) void choose('lick');
        }, 8000 + Math.random() * 4000);
      }
    };
    const stopDrawing = () => {
      if (frameHandle && frameVideo) frameVideo.cancelVideoFrameCallback(frameHandle);
      cancelAnimationFrame(raf);
      frameHandle = raf = 0; frameVideo = undefined;
    };
    const draw = (now: number) => {
      const v = slots[current].video;
      if (!ctx || v.readyState < 2 || !started) return;
      const layout = clips[action].layout;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (transitionStart !== undefined) {
        const amount = Math.min(1, Math.max(0, (now - transitionStart) / BLEND_MS));
        ctx.save();
        ctx.globalAlpha = 1 - amount;
        ctx.drawImage(outgoing, 0, 0);
        // Add weighted premultiplied layers, preserving transparent fur edges.
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = amount;
        ctx.drawImage(v, layout.left, layout.top, layout.width, layout.height);
        ctx.restore();
        if (amount >= 1) transitionStart = undefined;
      } else ctx.drawImage(v, layout.left, layout.top, layout.width, layout.height);
    };
    const startDrawing = () => {
      stopDrawing();
      const v = slots[current].video;
      if (!canPlay() || !started || v.paused) return;
      if (typeof v.requestVideoFrameCallback === 'function') {
        frameVideo = v;
        const next = (now: number) => {
          frameHandle = 0;
          if (!canPlay() || v !== slots[current].video || v.paused) return;
          draw(now); frameHandle = v.requestVideoFrameCallback(next);
        };
        frameHandle = v.requestVideoFrameCallback(next);
      }
      // Smooth only the 83 ms transition at display rate; fallback playback is 24 fps.
      const tick = (now: number) => {
        raf = 0;
        if (!canPlay() || v !== slots[current].video || v.paused) return;
        if (transitionStart !== undefined || typeof v.requestVideoFrameCallback !== 'function') {
          if (transitionStart !== undefined || now - lastDraw >= 1000 / 24) { draw(now); lastDraw = now; }
          raf = requestAnimationFrame(tick);
        }
      };
      if (transitionStart !== undefined || typeof v.requestVideoFrameCallback !== 'function') raf = requestAnimationFrame(tick);
    };
    const source = (id: Action) => {
      if (!sources.has(id)) {
        const promise = fetch(clips[id][format!]).then(response => {
          if (!response.ok) throw Error(`Cat video ${response.status}`);
          return response.blob();
        }).then(blob => {
          if (disposed) throw Error('Cat player disposed');
          return URL.createObjectURL(blob);
        });
        sources.set(id, promise);
        void promise.catch(() => { if (sources.get(id) === promise) sources.delete(id); });
      }
      return sources.get(id)!;
    };
    const waitFor = (slot: typeof slots[number], event: string, operation: () => void) => new Promise<void>((resolve, reject) => {
      let timeout = 0;
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        slot.video.removeEventListener(event, done); slot.video.removeEventListener('error', fail);
        slot.cancel = () => {};
        error ? reject(error) : resolve();
      };
      const done = () => finish();
      const fail = () => finish(Error('Cat video unavailable'));
      slot.cancel = () => finish(Error('Cat video request superseded'));
      slot.video.addEventListener(event, done, { once: true });
      slot.video.addEventListener('error', fail, { once: true });
      timeout = window.setTimeout(fail, 10000);
      try { operation(); } catch { fail(); }
    });
    const prepare = async (index: number, id: Action, request: number) => {
      const slot = slots[index];
      const url = await source(id);
      // A slow hover load must not replace the video used by a newer click.
      if (request !== token || !canPlay()) return;
      if (slot.action !== id) {
        slot.cancel(); slot.action = id;
        slot.ready = waitFor(slot, 'loadeddata', () => { slot.video.src = url; slot.video.load(); });
      }
      await slot.ready;
    };
    const warmActions = async () => {
      if (warming || !canPlay() || !started) return;
      warming = true;
      try {
        for (const id of ['tilt', 'yawn', 'lick'] as Action[]) {
          if (!canPlay()) break;
          await source(id);
        }
      } catch { /* Keep idle functional; user interaction may retry the missing action. */ }
      finally { warming = false; }
    };
    async function choose(id: Action, smooth = true) {
      if (!canPlay()) return;
      const request = ++token;
      pending = id; clearTimer();
      const target = started ? 1 - current : current;
      try {
        await prepare(target, id, request);
        if (request !== token || !canPlay()) return;
        const slot = slots[target], v = slot.video;
        if (v.currentTime > .001) await waitFor(slot, 'seeked', () => { v.currentTime = 0; });
        if (request !== token || !canPlay()) return;
        v.loop = id === 'idle';
        await v.play();
        if (request !== token || !canPlay()) { v.pause(); return; }
        stopDrawing();
        out.clearRect(0, 0, outgoing.width, outgoing.height); out.drawImage(canvas, 0, 0);
        if (started) slots[current].video.pause();
        transitionStart = smooth && started ? performance.now() : undefined;
        current = target; action = id; started = true; pending = undefined;
        figure.dataset.action = id;
        figure.setAttribute('data-ready', ''); button.disabled = false;
        draw(performance.now()); startDrawing(); scheduleLick();
        void warmActions();
      } catch {
        if (request === token) {
          slots[target].action = undefined;
          if (!started) { failed = true; figure.removeAttribute('data-ready'); button.disabled = true; }
        }
      } finally {
        if (request === token) {
          pending = undefined;
          if (canPlay() && slots[current].video.ended && action !== 'idle') void choose('idle');
          else scheduleLick();
        }
      }
    }
    const update = () => {
      button.disabled = !canPlay() || !started;
      if (!canPlay()) {
        ++token; pending = undefined; clearTimer(); stopDrawing();
        slots.forEach(slot => slot.video.pause());
        if (reduced.matches) figure.removeAttribute('data-ready');
        return;
      }
      if (!started) {
        if (!starting) {
          starting = true;
          void choose('idle', false).finally(() => { starting = false; if (canPlay() && !started && !failed) update(); });
        }
        return;
      }
      const v = slots[current].video;
      if (v.ended && action !== 'idle') { void choose('idle'); return; }
      if (v.paused) void v.play().then(() => {
        if (!canPlay()) { v.pause(); return; }
        figure.setAttribute('data-ready', ''); button.disabled = false;
        draw(performance.now()); startDrawing(); scheduleLick(); void warmActions();
      }).catch(() => { /* A blocked autoplay retains the current frame or poster. */ });
      else if (!timer) scheduleLick();
    };
    for (const slot of slots) slot.video.addEventListener('ended', () => {
      if (slot === slots[current] && canPlay() && action !== 'idle' && !pending) void choose('idle');
    });
    button.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && hover.matches && action === 'idle' && !pending) void choose('tilt');
    });
    button.addEventListener('click', () => {
      const now = performance.now();
      if (now - lastClick < CLICK_GAP_MS || !canPlay()) return;
      lastClick = now; void choose('yawn');
    });
    return {
      figure, update,
      setVisible(value: boolean) { visible = value; update(); },
      dispose() {
        disposed = true; ++token; clearTimer(); stopDrawing();
        slots.forEach(slot => { slot.cancel(); slot.video.pause(); slot.video.removeAttribute('src'); slot.video.load(); slot.video.remove(); });
        sources.forEach(promise => { void promise.then(url => URL.revokeObjectURL(url)).catch(() => {}); });
      },
    };
  });
  const refresh = () => controllers.forEach(controller => controller.update());
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) controllers.find(controller => controller.figure === entry.target)?.setVisible(entry.isIntersecting);
  }, { threshold: 0 });
  const observe = () => controllers.forEach(controller => observer.observe(controller.figure));
  const syncCovered = () => {
    const next = !!document.querySelector('dialog[open]') || document.body.classList.contains('nav-lock');
    if (next !== covered) { covered = next; refresh(); }
  };
  const overlayObserver = new MutationObserver(syncCovered);
  const observeOverlays = () => overlayObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open', 'class'] });
  document.addEventListener('visibilitychange', refresh);
  reduced.addEventListener('change', refresh);
  window.addEventListener('focus', () => { focused = true; refresh(); });
  window.addEventListener('blur', () => { focused = false; refresh(); });
  window.addEventListener('pagehide', event => {
    active = false; refresh(); observer.disconnect(); overlayObserver.disconnect();
    if (!event.persisted) controllers.forEach(controller => controller.dispose());
  });
  window.addEventListener('pageshow', () => {
    active = true; focused = document.hasFocus(); observe(); observeOverlays(); syncCovered(); refresh();
  });
  observe(); observeOverlays(); syncCovered();
}
