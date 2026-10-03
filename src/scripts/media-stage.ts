import "../styles/media-stage.css";

interface MediaStageOptions {
  storageKey: string;
  onActivate?: (item: HTMLElement) => void;
  onDeactivate?: (item: HTMLElement) => void;
}

type Direction = -1 | 1;
type GestureMode = "pending" | "read" | "navigate" | "ignored";
interface StageTouch {
  identifier: number;
  x: number;
  y: number;
  mode: GestureMode | "blocked" | "committed";
  readingArea?: HTMLElement;
  lastY: number;
  time: number;
  velocity: number;
}
interface StageDrag { item: HTMLElement; direction: Direction; offset: number; }

/** A fixed viewing area: gestures move works, while text keeps native reading scroll. */
export function createMediaStage(root: HTMLElement, options: MediaStageOptions) {
  const track = root.querySelector<HTMLElement>("[data-stage-track]");
  const items = [...(track?.children || [])].filter((item): item is HTMLElement =>
    item instanceof HTMLElement && item.matches("[data-stage-item][data-stage-id]"));
  if (!track || !items.length) return { restart() {}, suspend() {}, resume() {} };
  const viewport = track;
  const page = root.closest<HTMLElement>(".page") || root;
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let order: HTMLElement[] = [];
  let index = 0;
  let current: HTMLElement | undefined;
  let leaving: HTMLElement | undefined;
  let drag: StageDrag | undefined;
  let activated = false;
  let suspended = false;
  let transitioning = false;
  let transitionDirection: Direction | undefined;
  let animationReversed = false;
  let queuedDirection: Direction | undefined;
  let animations: Animation[] = [];
  let transitionVersion = 0;
  let activationFrame: number | undefined;
  let dragFrame: number | undefined;
  let lastOrder = "";
  let wheelMode: GestureMode = "pending";
  let wheelDirection: Direction | undefined;
  let wheelDistance = 0;
  let wheelTimer: number | undefined;
  let wheelLastTime = 0;
  let wheelPeak = 0;
  let wheelTail = Infinity;
  let wheelPulseDistance = 0;
  let wheelPulseCount = 0;
  let wheelPulseDirection: Direction | undefined;
  let wheelNavigationTime = 0;
  let touch: StageTouch | undefined;
  let keyboardKey = "";
  let keyboardMode: "read" | "navigate" | undefined;
  let suppressClickUntil = 0;
  try { lastOrder = sessionStorage.getItem(options.storageKey) || ""; } catch {}

  function isActive() {
    return !suspended && root.isConnected && !root.hidden && root.getClientRects().length > 0;
  }

  function ignoredTarget(target: EventTarget | null) {
    return !!document.querySelector("dialog[open], .sidebar.is-open")
      || window.getSelection()?.isCollapsed === false
      || (target instanceof Element && !!target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"));
  }

  function readingArea(target: EventTarget | null, fallback = false) {
    const area = target instanceof Element ? target.closest<HTMLElement>("[data-stage-scroll]") : null;
    if (area && current?.contains(area) && area.scrollHeight > area.clientHeight + 2) return area;
    return fallback ? [...(current?.querySelectorAll<HTMLElement>("[data-stage-scroll]") || [])]
      .find(area => area.scrollHeight > area.clientHeight + 2) : undefined;
  }

  function canRead(area: HTMLElement | undefined, direction: Direction) {
    return !!area && (direction > 0 ? area.scrollTop < area.scrollHeight - area.clientHeight - 2 : area.scrollTop > 2);
  }

  function resetWheel() {
    wheelMode = "pending";
    wheelDirection = undefined;
    wheelDistance = 0;
    wheelLastTime = 0;
    wheelPeak = 0;
    wheelTail = Infinity;
    wheelPulseDistance = 0;
    wheelPulseCount = 0;
    wheelPulseDirection = undefined;
    wheelNavigationTime = 0;
  }

  function clearGestures() {
    if (wheelTimer !== undefined) window.clearTimeout(wheelTimer);
    wheelTimer = undefined;
    resetWheel();
    touch = undefined;
    keyboardKey = "";
    keyboardMode = undefined;
  }

  function cancelActivation() {
    if (activationFrame !== undefined) cancelAnimationFrame(activationFrame);
    activationFrame = undefined;
  }

  function activate(item: HTMLElement) {
    cancelActivation();
    const reveal = () => {
      activationFrame = undefined;
      if (current !== item || !isActive()) return;
      options.onActivate?.(item);
      item.removeAttribute("data-stage-preview");
      activated = true;
    };
    if (motionPreference.matches) reveal();
    else activationFrame = requestAnimationFrame(() => {
      activationFrame = requestAnimationFrame(reveal);
    });
  }

  function hide(item: HTMLElement) {
    item.hidden = true;
    item.inert = true;
    item.style.removeProperty("transform");
    item.style.removeProperty("will-change");
    item.removeAttribute("data-stage-preview");
  }

  // Warm only the adjacent previews, so the next frame does not start with a blank image.
  function warmAdjacent() {
    if (order.length < 2) return;
    for (const direction of [-1, 1]) {
      const item = order[(index + direction + order.length) % order.length];
      item.querySelectorAll<HTMLImageElement>("img[src]").forEach(image => {
        image.loading = "eager";
        void image.decode().catch(() => {});
      });
    }
  }

  function finishTransition() {
    animations.forEach(animation => animation.cancel());
    animations = [];
    current?.style.removeProperty("transform");
    current?.style.removeProperty("will-change");
    if (leaving) {
      hide(leaving);
      options.onDeactivate?.(leaving);
      leaving = undefined;
    }
    transitioning = false;
    transitionDirection = undefined;
    animationReversed = false;
    const queued = queuedDirection;
    queuedDirection = undefined;
    if (queued && isActive()) move(queued);
  }

  function discardDrag() {
    if (dragFrame !== undefined) cancelAnimationFrame(dragFrame);
    dragFrame = undefined;
    if (drag) hide(drag.item);
    drag = undefined;
    current?.style.removeProperty("transform");
    current?.style.removeProperty("will-change");
  }

  function stopMotion() {
    transitionVersion++;
    queuedDirection = undefined;
    cancelActivation();
    discardDrag();
    finishTransition();
  }

  function resize() {
    if (!isActive()) return;
    root.style.setProperty("--media-stage-height", `${viewport.clientHeight}px`);
  }

  function animatePair(previous: HTMLElement, next: HTMLElement, direction: Direction, offset: number) {
    animationReversed = false;
    const height = viewport.clientHeight;
    const version = ++transitionVersion;
    const timing: KeyframeAnimationOptions = { duration: 520, easing: "cubic-bezier(.22,.68,.2,1)", fill: "both" };
    previous.style.willChange = next.style.willChange = "transform";
    animations = [
      previous.animate([{ transform: `translateY(${-direction * offset}px)` }, { transform: `translateY(${-direction * height}px)` }], timing),
      next.animate([{ transform: `translateY(${direction * (height - offset)}px)` }, { transform: "translateY(0)" }], timing),
    ];
    void Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => {
      if (version === transitionVersion) finishTransition();
    });
  }

  function move(direction: Direction) {
    if (!isActive() || order.length < 2 || !current) return;
    if (transitioning) {
      // Reverse the existing motion from its current position instead of waiting.
      if (transitionDirection && direction !== transitionDirection && leaving) {
        const previous = current;
        current = leaving;
        leaving = previous;
        index = (index + direction + order.length) % order.length;
        current.inert = false;
        leaving.inert = true;
        if (leaving.contains(document.activeElement)) root.focus({ preventScroll: true });
        queuedDirection = undefined;
        transitionDirection = direction;
        activated = false;
        activate(current);
        warmAdjacent();
        animationReversed = !animationReversed;
        animations.forEach(animation => animation.updatePlaybackRate(animationReversed ? -1 : 1));
      } else {
        queuedDirection = direction;
      }
      return;
    }
    const previous = current;
    if (drag && drag.direction !== direction) discardDrag();
    const offset = drag?.direction === direction ? drag.offset : 0;
    if (dragFrame !== undefined) cancelAnimationFrame(dragFrame);
    dragFrame = undefined;
    cancelActivation();
    index = (index + direction + order.length) % order.length;
    current = order[index];
    drag = undefined;
    activated = false;
    current.hidden = false;
    current.inert = false;
    previous.inert = true;
    if (previous.contains(document.activeElement)) root.focus({ preventScroll: true });
    activate(current);
    warmAdjacent();

    if (motionPreference.matches || !current.animate) {
      hide(previous);
      current.style.removeProperty("transform");
      options.onDeactivate?.(previous);
      return;
    }
    leaving = previous;
    transitioning = true;
    transitionDirection = direction;
    animatePair(previous, current, direction, offset);
  }

  function renderDrag(y: number) {
    if (!current || transitioning || order.length < 2 || motionPreference.matches) return;
    const direction: Direction = y >= 0 ? 1 : -1;
    if (drag?.direction !== direction) {
      discardDrag();
      const item = order[(index + direction + order.length) % order.length];
      item.hidden = false;
      item.inert = true;
      item.setAttribute("data-stage-preview", "");
      item.style.willChange = current.style.willChange = "transform";
      drag = { item, direction, offset: 0 };
    }
    const preview = drag!;
    const height = viewport.clientHeight;
    preview.offset = Math.min(Math.abs(y), height * .9);
    current.style.transform = `translateY(${-direction * preview.offset}px)`;
    preview.item.style.transform = `translateY(${direction * (height - preview.offset)}px)`;
  }

  function returnDrag() {
    if (!drag || !current) return;
    const preview = drag;
    drag = undefined;
    if (dragFrame !== undefined) cancelAnimationFrame(dragFrame);
    dragFrame = undefined;
    leaving = preview.item;
    transitioning = true;
    transitionDirection = undefined;
    animationReversed = false;
    const height = viewport.clientHeight;
    const version = ++transitionVersion;
    const timing: KeyframeAnimationOptions = { duration: 260, easing: "cubic-bezier(.22,.68,.2,1)", fill: "both" };
    animations = [
      current.animate([{ transform: `translateY(${-preview.direction * preview.offset}px)` }, { transform: "translateY(0)" }], timing),
      preview.item.animate([{ transform: `translateY(${preview.direction * (height - preview.offset)}px)` }, { transform: `translateY(${preview.direction * height}px)` }], timing),
    ];
    void Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => {
      if (version === transitionVersion) finishTransition();
    });
  }

  function restart() {
    stopMotion();
    clearGestures();
    if (current) options.onDeactivate?.(current);
    const shuffled = [...items];
    for (let position = shuffled.length - 1; position > 0; position--) {
      const other = Math.floor(Math.random() * (position + 1));
      [shuffled[position], shuffled[other]] = [shuffled[other], shuffled[position]];
    }
    const signature = () => JSON.stringify(shuffled.map(item => item.dataset.stageId));
    if (shuffled.length > 1 && signature() === lastOrder) shuffled.push(shuffled.shift()!);
    lastOrder = signature();
    try { sessionStorage.setItem(options.storageKey, lastOrder); } catch {}
    order = shuffled;
    viewport.append(...shuffled);
    index = 0;
    items.forEach(hide);
    current = order[0];
    current.hidden = false;
    current.inert = false;
    activated = false;
    suspended = false;
    root.setAttribute("data-stage-ready", "");
    page.classList.add("media-stage-page");
    window.scrollTo({ top: 0, behavior: "instant" });
    resize();
    activate(current);
    warmAdjacent();
  }

  function suspend() {
    suspended = true;
    stopMotion();
    clearGestures();
    page.classList.remove("media-stage-page");
  }

  function resume() {
    if (root.hidden) return;
    suspended = false;
    page.classList.add("media-stage-page");
    resize();
    if (current && !activated) activate(current);
  }

  page.addEventListener("wheel", event => {
    if (!isActive() || event.ctrlKey || event.metaKey || ignoredTarget(event.target)
      || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    const delta = event.deltaY * scale;
    const magnitude = Math.abs(delta);
    const direction: Direction = delta > 0 ? 1 : -1;
    if (event.timeStamp - wheelLastTime > 180) resetWheel();

    // A decaying tail or one isolated rebound is not a new swipe. Require a
    // sustained, substantial new impulse before accepting another navigation.
    if (wheelMode === "navigate" || wheelMode === "read") {
      const reversed = wheelDirection !== undefined && direction !== wheelDirection;
      const strongImpulse = event.timeStamp - wheelNavigationTime > 180
        && magnitude >= Math.max(24, wheelPeak * .35, wheelTail * 4);
      if ((reversed && magnitude >= 8) || strongImpulse) {
        if (wheelPulseDirection !== direction) { wheelPulseDistance = 0; wheelPulseCount = 0; }
        wheelPulseDirection = direction;
        wheelPulseDistance += magnitude;
        wheelPulseCount++;
        if (wheelPulseCount >= 2 && wheelPulseDistance >= 80) {
          const carried = direction * wheelPulseDistance;
          resetWheel();
          wheelDistance = carried - delta;
        }
      } else {
        wheelPulseDistance = 0;
        wheelPulseCount = 0;
        wheelPulseDirection = undefined;
      }
    }
    wheelLastTime = event.timeStamp;
    wheelPeak = Math.max(wheelPeak, magnitude);
    if (magnitude < wheelPeak * .2) wheelTail = Math.min(wheelTail, magnitude);
    wheelDirection ??= direction;
    if (wheelTimer !== undefined) window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => {
      if (wheelMode === "pending" && drag) returnDrag();
      resetWheel();
      wheelTimer = undefined;
    }, 180);
    if (wheelMode === "navigate") { event.preventDefault(); return; }
    if (canRead(readingArea(event.target), direction)) { wheelMode = "read"; return; }
    event.preventDefault();
    if (wheelMode === "read" || order.length < 2) return;

    wheelDistance += delta;
    const threshold = event.deltaMode === 1 ? 36 : Math.min(110, Math.max(72, viewport.clientHeight * .16));
    const feedback = Math.sign(wheelDistance) * Math.min(Math.abs(wheelDistance), threshold);
    if (Math.abs(wheelDistance) >= threshold) {
      wheelMode = "navigate";
      wheelNavigationTime = event.timeStamp;
      wheelDirection = wheelDistance > 0 ? 1 : -1;
      move(wheelDirection);
    } else {
      if (dragFrame !== undefined) cancelAnimationFrame(dragFrame);
      dragFrame = requestAnimationFrame(() => { dragFrame = undefined; renderDrag(feedback); });
    }
  }, { passive: false });

  page.addEventListener("touchstart", event => {
    touch = undefined;
    if (!isActive() || event.touches.length !== 1 || ignoredTarget(event.target)) return;
    const point = event.touches[0];
    touch = { identifier: point.identifier, x: point.clientX, y: point.clientY, lastY: point.clientY,
      time: event.timeStamp, velocity: 0, mode: transitioning ? "blocked" : "pending", readingArea: readingArea(event.target) };
  }, { passive: true });
  page.addEventListener("touchmove", event => {
    if (!touch) return;
    if (event.touches.length !== 1 || !isActive() || ignoredTarget(event.target)) {
      touch = undefined;
      returnDrag();
      return;
    }
    const point = [...event.touches].find(point => point.identifier === touch?.identifier);
    if (!point) return;
    const x = point.clientX - touch.x;
    const y = touch.y - point.clientY;
    touch.velocity = (touch.lastY - point.clientY) / Math.max(1, event.timeStamp - touch.time);
    touch.lastY = point.clientY;
    touch.time = event.timeStamp;
    if (touch.mode === "ignored" || touch.mode === "read" || Math.max(Math.abs(x), Math.abs(y)) < 8) return;
    if (touch.mode === "blocked" && !transitioning) touch.mode = "pending";
    if ((touch.mode === "pending" || touch.mode === "blocked") && Math.abs(x) > Math.abs(y)) { touch.mode = "ignored"; return; }
    if (touch.mode === "pending") touch.mode = canRead(touch.readingArea, y > 0 ? 1 : -1) ? "read" : "navigate";
    if (touch.mode === "blocked" && canRead(touch.readingArea, y > 0 ? 1 : -1)) touch.mode = "read";
    if (touch.mode === "navigate" || touch.mode === "blocked" || touch.mode === "committed") {
      if (event.cancelable) event.preventDefault();
      if (touch.mode === "blocked" && Math.abs(y) >= Math.min(90, Math.max(60, viewport.clientHeight * .16))) {
        touch.mode = "committed";
        suppressClickUntil = performance.now() + 400;
        move(y > 0 ? 1 : -1);
      }
      if (touch.mode === "navigate") {
        if (dragFrame !== undefined) cancelAnimationFrame(dragFrame);
        dragFrame = requestAnimationFrame(() => { dragFrame = undefined; renderDrag(y); });
      }
    }
  }, { passive: false });
  page.addEventListener("touchend", event => {
    const gesture = touch;
    touch = undefined;
    if (gesture?.mode === "committed") {
      suppressClickUntil = performance.now() + 400;
      return;
    }
    if (!gesture || (gesture.mode !== "navigate" && gesture.mode !== "blocked") || ignoredTarget(event.target)) {
      returnDrag();
      return;
    }
    const point = [...event.changedTouches].find(point => point.identifier === gesture.identifier);
    if (!point) { returnDrag(); return; }
    const y = gesture.y - point.clientY;
    const velocity = event.timeStamp - gesture.time < 100 ? Math.abs(gesture.velocity) : 0;
    const threshold = Math.min(90, Math.max(44, viewport.clientHeight * .18));
    const vertical = Math.abs(y) > Math.abs(point.clientX - gesture.x) * 1.2;
    if (Math.abs(y) > 8) suppressClickUntil = performance.now() + 400;
    if (vertical && (Math.abs(y) >= threshold || (Math.abs(y) > 24 && velocity > .45))) {
      if (dragFrame !== undefined) cancelAnimationFrame(dragFrame);
      dragFrame = undefined;
      if (gesture.mode !== "blocked") renderDrag(y);
      move(y > 0 ? 1 : -1);
    } else returnDrag();
  }, { passive: true });
  page.addEventListener("touchcancel", () => { touch = undefined; returnDrag(); }, { passive: true });
  // Dialog focus restoration can match :focus-visible after pointer interaction.
  // Keep the stage ring tied to keyboard use rather than restored focus alone.
  page.addEventListener("pointerdown", () => root.removeAttribute("data-stage-keyboard"), { capture: true });
  page.addEventListener("wheel", () => root.removeAttribute("data-stage-keyboard"), { passive: true });
  page.addEventListener("keydown", event => {
    if (["Tab", "ArrowDown", "ArrowUp", "PageDown", "PageUp", " "].includes(event.key)) {
      root.setAttribute("data-stage-keyboard", "");
    }
  }, { capture: true });
  page.addEventListener("click", event => {
    if (performance.now() < suppressClickUntil && event.target instanceof Node && root.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true });

  page.addEventListener("keydown", event => {
    if (!isActive() || ignoredTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    let direction: Direction;
    if (event.key === "ArrowDown" || event.key === "PageDown") direction = 1;
    else if (event.key === "ArrowUp" || event.key === "PageUp") direction = -1;
    else if (event.key === " ") {
      if (event.target instanceof Element && event.target.closest("button, a[href], summary, [role='button']")) return;
      direction = event.shiftKey ? -1 : 1;
    } else return;
    if (event.repeat && keyboardKey !== event.key) return;
    if (!event.repeat) { keyboardKey = event.key; keyboardMode = undefined; }
    const area = readingArea(event.target, true);
    event.preventDefault();
    if (keyboardMode === "navigate") return;
    if (canRead(area, direction)) {
      keyboardMode = "read";
      const distance = event.key.startsWith("Page") || event.key === " " ? area!.clientHeight * .85 : 48;
      area!.scrollBy({ top: direction * distance, behavior: "auto" });
    } else if (keyboardMode !== "read" && !event.repeat) {
      keyboardMode = "navigate";
      move(direction);
    }
  });
  page.addEventListener("keyup", event => {
    if (event.key === keyboardKey) { keyboardKey = ""; keyboardMode = undefined; }
  });
  page.addEventListener("focusout", event => {
    if (!(event.relatedTarget instanceof Node) || !page.contains(event.relatedTarget)) { keyboardKey = ""; keyboardMode = undefined; }
  });
  window.addEventListener("pagehide", suspend);
  window.addEventListener("pageshow", event => { if (event.persisted) resume(); });
  window.addEventListener("resize", resize, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(viewport);
  motionPreference.addEventListener("change", () => {
    if (motionPreference.matches) { discardDrag(); finishTransition(); }
  });
  restart();
  return { restart, suspend, resume };
}
