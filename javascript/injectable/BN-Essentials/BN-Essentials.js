(function () {
  'use strict';

  /** ------------------------------
   *  POLYFILLS + FAILSAFES
   * ------------------------------ */
  window.requestIdleCallback = window.requestIdleCallback || function (cb) {
    return setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1);
  };

  const noop = () => {};
  const consoleMethods = ['log', 'warn', 'error', 'info', 'debug'];
  consoleMethods.forEach(m => window.console[m] = window.console[m] || noop);

  /** ------------------------------
   *  DOM READY HELPER
   * ------------------------------ */
  function onReady(cb) {
    if (document.readyState !== 'loading') cb();
    else document.addEventListener('DOMContentLoaded', cb);
  }

  /** ------------------------------
   *  PERFORMANCE & UX BOOSTERS
   * ------------------------------ */

  // Debounce function
  function debounce(fn, delay = 150) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // Lazy-load images with data-src
  function lazyLoadImages() {
    const imgs = document.querySelectorAll('img[data-src]');
    imgs.forEach(img => {
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
    });
  }

  // Auto pause media when tab hidden
  function autoPauseMedia() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        document.querySelectorAll('video, audio').forEach(el => el.pause());
      }
    });
  }

  // Scroll optimization
  function optimizeScroll() {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /** ------------------------------
   *  INIT ON DOM READY
   * ------------------------------ */
  onReady(() => {
    debounce(optimizeScroll(), 100);
    requestIdleCallback(() => {
      lazyLoadImages();
      autoPauseMedia();
    });
  });

  /** ------------------------------
   *  EXPOSE API
   * ------------------------------ */
  window.JSEssentials = {
    debounce,
    lazyLoadImages,
    optimizeScroll
  };
})();
