/* Generování tabulek a drobné UI */
(function () {
  'use strict';

  function prepinaniPasem() {
    function vybratPasmo(pasmo) {
      var cilovaZalozka = document.querySelector('.channel-tab[data-band="' + pasmo + '"]');
      if (!cilovaZalozka) {
        document.querySelectorAll('.band-nav-link').forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('data-band') === pasmo);
        });
        return;
      }

      document.querySelectorAll('.channel-tab').forEach(function (tab) {
        var aktivni = tab === cilovaZalozka;
        tab.classList.toggle('is-active', aktivni);
        tab.setAttribute('aria-selected', aktivni ? 'true' : 'false');
      });
      document.querySelectorAll('[data-band-panel]').forEach(function (panel) {
        panel.classList.toggle('is-hidden', panel.getAttribute('data-band-panel') !== pasmo);
      });
      document.querySelectorAll('.band-nav-link').forEach(function (link) {
        link.classList.toggle('is-active', link.getAttribute('data-band') === pasmo);
      });
    }

    document.querySelectorAll('.channel-tab, .band-nav-link').forEach(function (button) {
      button.addEventListener('click', function (event) {
        var pasmo = button.getAttribute('data-band');
        if (button.classList.contains('band-nav-link')) {
          event.preventDefault();
          var cil = document.getElementById(pasmo === 'pmr' ? 'pmr446' : pasmo);
          if (cil) cil.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        vybratPasmo(pasmo);
      });
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
    document.addEventListener('DOMContentLoaded', function () { prepinaniPasem(); vysvetleniPasem(); menu(); otevrene(); aktivniSekce(); });
  } else {
    prepinaniPasem(); vysvetleniPasem(); menu(); otevrene(); aktivniSekce();
  }
})();