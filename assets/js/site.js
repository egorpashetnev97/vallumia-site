/* Vallumia — движение лэндинга (DESIGN §6). Без этого файла страница стоит в виде макета.
   Здесь только то, чего не умеет CSS: закреплённая шапка, запуск разовых сцен по входу в
   окно и ход лент там, где браузер не привязывает анимацию к прокрутке.
   Наружу страница не обращается: ни счётчиков, ни аналитики. */
(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp01 = v => Math.min(1, Math.max(0, v));

  // «Скачать» в шапке ведёт в App Store; на Android — туда, куда назначила сборка
  // (data-android: адрес Google Play, а пока его нет — кнопки финала)
  if (/Android/i.test(navigator.userAgent)) {
    $$('a[data-android]').forEach(a => { a.href = a.dataset.android; });
  }

  /* ---------- картинка, оборвавшаяся в сети, пробует загрузиться ещё раз ----------
     Снимки грузятся лениво и по одному запросу; обрыв соединения оставил бы пустой корпус
     телефона до перезагрузки страницы. Попыток три, с растущей паузой (1,2 / 2,4 / 4,8 с):
     на живом хостинге подряд рвались и запрос, и первый повтор. */
  const RETRIES = 3;
  const retry = img => {
    const n = +(img.dataset.retries || 0);
    if (n >= RETRIES) return;
    img.dataset.retries = n + 1;
    setTimeout(() => {
      const { src, srcset } = img;
      img.removeAttribute('srcset');
      img.removeAttribute('src');
      if (srcset) img.srcset = srcset;
      img.src = src;
    }, 1200 * 2 ** n);
  };
  for (const img of document.images) {
    img.addEventListener('error', () => retry(img));
    if (img.complete && !img.naturalWidth && img.currentSrc) retry(img);
  }

  /* ---------- закреплённая шапка: видна между кнопками первого экрана и кнопками финала ---------- */
  const topbar = $('#topbar');
  const ctaTop = $('#cta-top');
  const ctaBottom = $('#cta-bottom');
  const syncTopbar = vh => {
    if (!topbar || !ctaTop || !ctaBottom) return;
    const on = ctaTop.getBoundingClientRect().bottom < 0 && ctaBottom.getBoundingClientRect().top > vh;
    if (on === topbar.classList.contains('is-on')) return;
    topbar.classList.toggle('is-on', on);
    topbar.inert = !on;
  };

  /* ---------- разовые сцены: конверт (сцена 3) и кадр 01 (сцена 4) ----------
     Сцена следит за своей меткой [data-reveal-target], а без неё — за собой. У кадра 01
     метка — окно отпечатка: оно входит в любое окно, а корпус телефона целиком в низкое
     окно (телефон боком) не входит, и порог от корпуса там не сработал бы никогда. */
  const THRESHOLD = { envelope: 0.35, develop: 0.6 };
  if ('IntersectionObserver' in window) {
    for (const el of $$('[data-reveal]')) {
      new IntersectionObserver((entries, self) => {
        if (!entries.some(e => e.isIntersecting)) return;
        el.classList.add('is-in');
        self.disconnect();
      }, { threshold: THRESHOLD[el.dataset.reveal] ?? 0.3 }).observe($('[data-reveal-target]', el) ?? el);
    }
    // Класс js прячет сцены до их входа в окно (site.css). Он ставится здесь и последним:
    // если файл не загрузился или упал выше, страница остаётся в виде макета, а не с
    // невидимым конвертом и мутным кадром.
    root.classList.add('js');
  }

  /* ---------- лента первого экрана на iPhone и iPad стоит ----------
     Safari на iOS обновляет привязанную к прокрутке анимацию на 60 Гц при прокрутке на 120,
     и крупная лента первого экрана дёргалась; ленты за телефонами едут и там (решение
     пользователя 2026-11-15, сравнение трёх вариантов на iPhone). iPad называет себя Mac —
     его выдаёт сенсорный экран. */
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) root.classList.add('hero-still');

  const stages = $$('.stage');
  const heroFilm = $('.hero__film');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // сцена рядом с окном: её плёнка получает свой слой
  if ('IntersectionObserver' in window) {
    const near = new IntersectionObserver(entries => {
      for (const e of entries) e.target.classList.toggle('is-live', e.isIntersecting);
    }, { rootMargin: '25% 0px' });
    [heroFilm, ...stages].forEach(el => el && near.observe(el));
  }

  /* ---------- прокрутка: шапка и ход лент там, где браузер не привязывает его сам ---------- */
  const nativeTimeline = CSS.supports('animation-timeline: view()');
  if (!nativeTimeline) root.classList.add('no-sda');

  let queued = false;
  const frame = () => {
    queued = false;
    const vh = innerHeight;
    syncTopbar(vh);
    if (nativeTimeline || reduced.matches) return;
    if (!ios) heroFilm?.style.setProperty('--p', clamp01(scrollY / (vh * 1.3)).toFixed(4));
    for (const stage of stages) {
      const r = stage.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      stage.style.setProperty('--p', clamp01((vh - r.top) / (vh + r.height)).toFixed(4));
    }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  frame();
})();
