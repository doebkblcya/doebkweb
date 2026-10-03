export function initAboutCats() {
  const figures = [...document.querySelectorAll<HTMLElement>('[data-about-cat]')];
  if (!figures.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const probe = document.createElement('video');
  const ua = navigator.userAgent;
  const apple = /iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    || (/Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua));
  // Safari may decode WebM without its transparent layer.
  const format = apple
    ? (probe.canPlayType('video/mp4; codecs="hvc1"') ? 'hevc' : undefined)
    : (probe.canPlayType('video/webm; codecs="vp9"') ? 'webm' : undefined);
  let active = true;
  let focused = document.hasFocus();
  let covered = false;
  const controllers = figures.map(figure => {
    const video = figure.querySelector<HTMLVideoElement>('video')!;
    let visible = false, failed = false;
    video.muted = true;
    const canPlay = () => active && focused && visible && !document.hidden && !covered && !reduced.matches && !failed && !!format;
    const update = () => {
      if (!canPlay()) {
        video.pause();
        if (reduced.matches) figure.removeAttribute('data-ready');
        return;
      }
      if (!video.hasAttribute('src')) {
        video.src = video.dataset[format!]!;
        video.load();
      }
      void video.play().then(() => {
        if (!canPlay()) { video.pause(); return; }
        figure.setAttribute('data-ready', '');
      }).catch(() => { /* Retain the poster if autoplay is unavailable. */ });
    };
    video.addEventListener('error', () => {
      failed = true;
      video.pause();
      figure.removeAttribute('data-ready');
      video.removeAttribute('src');
      video.load();
    });
    return { figure, update, setVisible(value: boolean) { visible = value; update(); } };
  });
  const refresh = () => controllers.forEach(controller => controller.update());
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) controllers.find(controller => controller.figure === entry.target)?.setVisible(entry.isIntersecting);
  }, { threshold: 0 });
  const observe = () => controllers.forEach(controller => observer.observe(controller.figure));
  const syncCovered = () => {
    covered = !!document.querySelector('dialog[open]') || document.body.classList.contains('nav-lock');
    refresh();
  };
  const overlayObserver = new MutationObserver(syncCovered);
  const observeOverlays = () => overlayObserver.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open', 'class'] });
  document.addEventListener('visibilitychange', refresh);
  reduced.addEventListener('change', refresh);
  window.addEventListener('focus', () => { focused = true; refresh(); });
  window.addEventListener('blur', () => { focused = false; refresh(); });
  window.addEventListener('pagehide', () => {
    active = false;
    refresh();
    observer.disconnect();
    overlayObserver.disconnect();
  });
  window.addEventListener('pageshow', () => {
    active = true;
    focused = document.hasFocus();
    observe();
    observeOverlays();
    syncCovered();
  });
  observe();
  observeOverlays();
  syncCovered();
}
