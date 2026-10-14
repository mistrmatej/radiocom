/* Generování tabulek a drobné UI */
(function () {
  'use strict';

  function kopirovaniFrekvenci() {
    function fallbackCopy(text) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var success = document.execCommand('copy');
      area.remove();
      return success;
    }

    function copy(button) {
      var text = button.getAttribute('data-copy-frequency');
      var result = navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(text)
        : Promise.resolve(fallbackCopy(text));
      result.then(function (success) {
        if (success === false) throw new Error('copy failed');
        var original = button.textContent;
        button.textContent = 'Zkopírováno';
        button.classList.add('is-copied');
        window.setTimeout(function () {
          button.textContent = original;
          button.classList.remove('is-copied');
        }, 1400);
      }).catch(function () {
        button.textContent = 'Kopírování selhalo';
        window.setTimeout(function () { button.textContent = 'Kopírovat'; }, 1800);
      });
    }

    document.querySelectorAll('[data-copy-frequency]').forEach(function (button) {
      button.addEventListener('click', function () { copy(button); });
    });
  }

  function vysvetleniPasem() {
    document.querySelectorAll('.band-choice').forEach(function (button) {
      button.addEventListener('click', function () {
        var pasmo = button.getAttribute('data-explain');
        document.querySelectorAll('.band-choice').forEach(function (choice) {
          var aktivni = choice === button;
          choice.classList.toggle('is-active', aktivni);
          choice.setAttribute('aria-selected', aktivni ? 'true' : 'false');
        });
        document.querySelectorAll('[data-explanation]').forEach(function (panel) {
          panel.classList.toggle('is-hidden', panel.getAttribute('data-explanation') !== pasmo);
        });
      });
    });
  }

  function menu() {
    var btn = document.querySelector('.nav-toggle');
    var nav = document.getElementById('nav');
    if (!btn || !nav) return;

    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

  }

  function otevrene() {
    document.querySelectorAll('details.faq').forEach(function (d) {
      d.addEventListener('toggle', function () { /* rezervováno pro budoucí obsah */ });
    });
  }

  // Zvýraznění právě prohlížené sekce v hlavní navigaci
  function aktivniSekce() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var viditelne = new Map();
    var observer = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) { viditelne.set(z.target.id, z.isIntersecting ? z.intersectionRatio : 0); });
      var nejlepsi = null, nej = 0;
      viditelne.forEach(function (hodnota, id) {
        if (hodnota > nej) { nej = hodnota; nejlepsi = id; }
      });
      if (!nejlepsi) return;
      links.forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('href') === '#' + nejlepsi);
      });
    }, { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.15, 0.4, 0.8] });

    links.forEach(function (a) {
      var cil = document.getElementById(a.getAttribute('href').slice(1));
      if (cil) observer.observe(cil);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { vysvetleniPasem(); menu(); otevrene(); aktivniSekce(); kopirovaniFrekvenci(); });
  } else {
    vysvetleniPasem(); menu(); otevrene(); aktivniSekce(); kopirovaniFrekvenci();
  }
})();