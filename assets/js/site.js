/* Generování tabulek a drobné UI */
(function () {
  'use strict';

  function fmtMHz(v) {
    var s = v.toFixed(6);
    s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }

  function tabulkaPmr() {
    var tbody = document.querySelector('#pmr-channel-table tbody');
    if (!tbody) return;
    var html = '';
    for (var i = 0; i < 8; i++) {
      var druhy = i + 8;
      html += '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + fmtMHz(446.00625 + i * 0.0125) + '</td>' +
        '<td>' + (druhy + 1) + '</td>' +
        '<td>' + fmtMHz(446.00625 + druhy * 0.0125) + '</td></tr>';
    }
    tbody.innerHTML = html;
  }

  var tymoveKanaly = {
    uhf: [
      ['UHF1', '448,490000', '5 W'],
      ['UHF2', '448,570000', '5 W'],
      ['UHF3', '448,610000', '5 W'],
      ['UHF4', '449,770000', '1 W'],
      ['UHF5', '449,810000', '1 W'],
      ['UHF6', '442,200000', '5 W'],
      ['UHF7', '442,225000', '5 W'],
      ['UHF8', '442,250000', '5 W'],
      ['UHF9', '442,275000', '5 W']
    ],
    vhf: [
      ['VHF1', '172,650000', '5 W'],
      ['VHF2', '172,725000', '1 W'],
      ['VHF3', '172,950000', '5 W'],
      ['VHF4', '172,975000', '5 W'],
      ['VHF5', '173,050000', '1 W']
    ]
  };

  function tabulkyTymu() {
    Object.keys(tymoveKanaly).forEach(function (pasmo) {
      var tbody = document.querySelector('#' + pasmo + '-panel tbody');
      if (!tbody) return;
      tbody.innerHTML = tymoveKanaly[pasmo].map(function (kanal) {
        return '<tr><td>' + kanal[0] + '</td><td>' + kanal[1] +
          ' MHz</td><td>' + kanal[2] + '</td></tr>';
      }).join('');
    });
  }

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
    document.addEventListener('DOMContentLoaded', function () { tabulkaPmr(); tabulkyTymu(); prepinaniPasem(); vysvetleniPasem(); menu(); otevrene(); aktivniSekce(); });
  } else {
    tabulkaPmr(); tabulkyTymu(); prepinaniPasem(); vysvetleniPasem(); menu(); otevrene(); aktivniSekce();
  }
})();