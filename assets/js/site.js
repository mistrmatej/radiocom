/* Generování tabulek a drobné UI */
(function () {
  'use strict';

  function fmtMHz(v) {
    var s = v.toFixed(6);
    s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }

  function tabulkaPmr() {
    var tbody = document.querySelector('#pmr-channels tbody');
    if (!tbody) return;
    var html = '';
    for (var i = 0; i < 16; i++) {
      html += '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + fmtMHz(446.00625 + i * 0.0125) + '</td>' +
        '<td>' + fmtMHz(446.103125 + i * 0.00625) + '</td></tr>';
    }
    tbody.innerHTML = html;
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
    document.addEventListener('DOMContentLoaded', function () { tabulkaPmr(); menu(); otevrene(); aktivniSekce(); });
  } else {
    tabulkaPmr(); menu(); otevrene(); aktivniSekce();
  }
})();