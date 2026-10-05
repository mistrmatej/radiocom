/* Kalkulačka dosahu rádiového spojení.
   Základ modelu:
     L(d) = L_volny_prostor(d) + L_terennich_ztrat(d) + L_ohyb_Zeme(d) + L_uzivatele
   Dohled = nejvetsi vzdalenost, pri ktere prijaty signal jeste >= citlivost prijimace.
*/
(function () {
  'use strict';

  /* ---------------------------------------------------------------- data --- */

  // c = empirické ztráty v daném prostředí ve vzdálenosti 1 km nad volným prostorem
  //     (pohlcování, zástavba, rozptyl a obvyklá rezerva proti rušení a šumu)
  // n = exponent šíření cestou, 2 = volný prostor
  // Hodnoty jsou kalibrované na běžně pozorované dosahy ručních a automobilových
  // stanic v ČR; v prostředí bez výrazného reliéfu.
  var TEREN = [
    { id: 'mesto', label: 'Velké město – hustá zástavba', c: 64, n: 4.0, note: 'Paláce, paneláky, kovové konstrukce. V ulicích mezi budovami je i s 0,5 W spojení často jen na pár set metrů.' },
    { id: 'predmesti', label: 'Město / předměstí', c: 50, n: 3.5, note: 'Rodinné domy, ulice, volná prostranství mezi zástavbou. Typická situace pro chůzi po městě nebo jízdu autem.' },
    { id: 'vesnice', label: 'Vesnice, okraj obce', c: 38, n: 3.2, note: 'Rozptýlená zástavba, velká otevřená prostranství mezi domy. S rostoucí vzdáleností se začínají projevovat stromy a mírný reliéf.' },
    { id: 'krajina', label: 'Otevřená krajina', c: 29, n: 2.9, note: 'Převážně volná obloha, minimum zástavby. Tady se projeví výška antén a reliéf terénu nejvíc.' },
    { id: 'les', label: 'Les, lesnatá krajina', c: 40, n: 3.7, note: 'Stromy silně tlumí, hlavně na nižších kmitočtostech. Vlhká vegetace ztráty ještě zvětšuje.' },
    { id: 'voda', label: 'Hladina vody / moře', c: 19, n: 2.6, note: 'Nejlepší případ pro šíření. Pozor na „oceánský efekt“ – signál za vlastním horizontem se láme a ztrácí, takže dál než vidíš, spojení obvykle nezůstane.' },
    { id: 'hora', label: 'Vrchol / vyvýšené místo', c: 25, n: 3.0, note: 'Výška antény nad okolním terénem je zde započtena dvakrát – výškovým ziskem i menšími ztrátami v terénu pod stanicí.' }
  ];

  var ANTENY = [
    { id: 'duck', label: 'Gumová / integrovaná (≈ 0 dBd)', bd: 0.0 },
    { id: 'l4', label: 'λ/4 whip – 34 cm (≈ +1,5 dBd)', bd: 1.5 },
    { id: 'l4ext', label: 'λ/4 stacionární nebo na konektor (≈ +2 dBd)', bd: 2.0 },
    { id: 'l8', label: '5/8 vlnová – střecha, auto (≈ +3 dBd)', bd: 3.0 },
    { id: 'yagi', label: 'Směrová Yagi 3–5 prvků (≈ +8 dBd)', bd: 8.0 }
  ];

  var VYKONY = [0.125, 0.25, 0.5, 1, 2, 2.5, 5, 7, 25];
  var CITLIVOSTI = [-100, -105, -110, -112, -115, -120, -125];

  var BATERIE = [
    { id: 'plna', label: 'Plná – jmenovitý výkon', f: 1.0, note: 'Stanice pracuje běžně, maximální výkon po celou dobu.' },
    { id: 'stredni', label: 'Částečně vybitá', f: 0.75, note: 'Koncový stupeň výkonu začíná klesat, hlavně u baterií s vyšším vnitřním odporem.' },
    { id: 'vybita', label: 'Téměř vybitá', f: 0.45, note: 'Výkon výrazně klesne a dohled se zkrátí – to je nejčastější důvod „když to včera fungovalo“.' }
  ];

  // Max. vyzářený výkon (e.r.p.) dle všeobecných oprávnění ČTÚ
  var SDILENE = [
    { f: 172.650, w: 5, bw: '10 kHz' },
    { f: 172.725, w: 1, bw: '10 kHz' },
    { f: 172.950, w: 5, bw: '10 kHz' },
    { f: 172.975, w: 5, bw: '10 kHz' },
    { f: 173.050, w: 1, bw: '10 kHz' },
    { f: 442.200, w: 5, bw: '16 kHz' },
    { f: 442.225, w: 5, bw: '16 kHz' },
    { f: 442.250, w: 5, bw: '16 kHz' },
    { f: 442.275, w: 5, bw: '16 kHz' },
    { f: 448.490, w: 5, bw: '14 kHz' },
    { f: 448.570, w: 5, bw: '14 kHz' },
    { f: 448.610, w: 5, bw: '14 kHz' },
    { f: 449.770, w: 1, bw: '14 kHz' },
    { f: 449.810, w: 1, bw: '14 kHz' }
  ];

  var R_EFF = 8495;             // km, Zeme s efektivním poloměrem 4/3
  var D2BD = 2.15;              // 0 dBd v dBi
  var D_MIN = 0.02, D_MAX = 500;

  /* --------------------------------------------------------------- utils --- */

  function $(id) { return document.getElementById(id); }

  function dbm(w) { return 10 * Math.log10(w * 1000); }

  function fmt(n, d) {
    if (!isFinite(n)) return '–';
    return n.toLocaleString('cs-CZ', {
      minimumFractionDigits: d === undefined ? 1 : d,
      maximumFractionDigits: d === undefined ? 1 : d
    });
  }

  function fmtDist(km) {
    if (km < 1) return { v: fmt(km * 1000, 0), u: 'm' };
    return { v: fmt(km, km < 10 ? 2 : 1), u: 'km' };
  }

  function fmtFreq(f) {
    if (Math.abs(f - Math.round(f)) < 1e-6) return fmt(Math.round(f), 0);
    var s = f.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }

  function volnyProstor(dKm, fMHz) {
    return 32.44 + 20 * Math.log10(fMHz) + 20 * Math.log10(dKm);
  }

  // Výškový zisk: čím výše je anténa nad okolním terénem, tím lépe překonává
  // zástavbu a drobný reliéf. Empirický tvar s referenční výškou 1,5 m (ruční
  // stanice) a aditivní konstantou 3 m. Beru vyšší ze dvou antén – typické je,
  // že alespoň jedna strana je na výhodnějším místě.
  function vyskovyZisk(h1, h2) {
    var h = Math.max(h1, h2);
    return 25 * Math.log10((h + 3) / 4.5);
  }

  // Ztráty podle exponentu šíření v daném prostředí (nad volným prostorem)
  function terenniZtraty(ter, dKm, gh) {
    return ter.c + (10 * ter.n - 20) * Math.log10(dKm) - gh;
  }

  // Difrakční ztráta nad ohybem Země. Beru největší příspěvek podél trasy
  // (jedno ostré překážka) a jako pojistku i odhadowou složku za obzorem,
  // která roste rychleji, když je cesta výrazně za horizontem.
  function ohybZeme(dKm, fMHz, h1, h2) {
    var lambda = 300 / fMHz; // m
    var maxL = 0;
    for (var i = 1; i < 40; i++) {
      var t = i / 40;
      var x = t * dKm;                       // km od stanice A
      var hInterp = h1 + (h2 - h1) * t;       // m, výška antény v daném místě
      var ohyb = (x * (dKm - x)) / (2 * R_EFF) * 1000; // m
      var hObs = ohyb - hInterp;              // m, překážka nad spojnicí
      if (hObs <= 0) continue;                // cesta je volná
      var rF = Math.sqrt(lambda * (x * 1000) * ((dKm - x) * 1000) / (dKm * 1000));
      if (rF <= 0) continue;
      var v = Math.SQRT2 * hObs / rF;
      var L = v < 0.78
        ? 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) * (v - 0.1) + 1) + v - 0.1)
        : 20 * Math.log10(2 * v);
      if (L > maxL) maxL = L;
    }
    var dHorizon = 4.12 * (Math.sqrt(h1) + Math.sqrt(h2));
    if (dKm > dHorizon) {
      // Za obzorem už nejde o jednu ostrou překážku, ale o hluboký stín za
      // oblým povrchem Země. Pole tam klesá přibližně jako d^-4, tedy
      // 40 dB na dekádu vzdálenosti.
      var shadow = 40 * Math.log10(dKm / dHorizon);
      if (shadow > maxL) maxL = shadow;
    }
    return Math.max(0, maxL);
  }

  function rozpocet(cfg, dKm) {
    var gh = vyskovyZisk(cfg.h1, cfg.h2);
    return {
      gh: gh,
      fspl: volnyProstor(dKm, cfg.f),
      env: terenniZtraty(cfg.ter, dKm, gh),
      diff: ohybZeme(dKm, cfg.f, cfg.h1, cfg.h2),
      extra: cfg.extra
    };
  }

  function celkoveZtraty(cfg, dKm) {
    var c = rozpocet(cfg, dKm);
    return c.fspl + c.env + c.diff + c.extra;
  }

  function najdiDohled(cfg, rozpocetDbm) {
    if (celkoveZtraty(cfg, D_MIN) > rozpocetDbm) return 0;
    var lo = D_MIN, hi = D_MAX;
    for (var i = 0; i < 60; i++) {
      var mid = Math.sqrt(lo * hi); // geometrické půlení – dráha je logaritmická
      if (celkoveZtraty(cfg, mid) <= rozpocetDbm) lo = mid; else hi = mid;
    }
    return lo;
  }

  function limitPro(f) {
    if (f >= 446.0 && f <= 446.2) {
      return {
        w: 0.5,
        integralni: true,
        label: 'PMR 446 (VO-R/3/6.2016-9)',
        detail: 'max 500 mW e.r.p., ruční přenosná stanice, integrální anténa, simplex, jen hlas, TOT 180 s'
      };
    }
    for (var i = 0; i < SDILENE.length; i++) {
      if (Math.abs(SDILENE[i].f - f) < 0.006) {
        return {
          w: SDILENE[i].w,
          label: 'Sdílená kmitočtová (VO-R/16/05.2020-6)',
          detail: 'max ' + fmt(SDILENE[i].w, 0) + ' W e.r.p., šířka kanálu ' + SDILENE[i].bw + ', pouze přenosná stanice'
        };
      }
    }
    return null;
  }

  function jeAmatr(f) {
    return (f >= 28 && f <= 29.7) || (f >= 50 && f <= 54) ||
           (f >= 70 && f <= 71) || (f >= 144 && f <= 146) ||
           (f >= 220 && f <= 225) || (f >= 420 && f <= 450);
  }

  /* ----------------------------------------------------------------- ui --- */

  var el = {};
  var stav = {};

  function naplnSelecty() {
    VYKONY.forEach(function (w) {
      var o = document.createElement('option');
      o.value = w;
      o.textContent = fmt(w, w < 1 ? 3 : 2) + ' W';
      el.vykon.appendChild(o);
      el.vykonB.appendChild(o.cloneNode(true));
    });

    CITLIVOSTI.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s;
      o.textContent = s + ' dBm (' + popisCitlivosti(s) + ')';
      el.citlivost.appendChild(o);
    });

    BATERIE.forEach(function (b) {
      var o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.label;
      el.baterie.appendChild(o);
    });

    ANTENY.forEach(function (a) {
      var o = document.createElement('option');
      o.value = a.id;
      o.textContent = a.label;
      el.antena.appendChild(o);
      el.antenaB.appendChild(o.cloneNode(true));
    });

    TEREN.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.label;
      el.teren.appendChild(o);
    });
  }

  function popisCitlivosti(s) {
    if (s <= -120) return 'velmi citlivý přijímač';
    if (s <= -115) return 'kvalitní stanice';
    if (s <= -110) return 'běžná stanice';
    return 'levná / přetížený vstup';
  }

  function nacti() {
    var f = el.banda.value === 'custom'
      ? parseFloat(el.fcustom.value)
      : parseFloat(el.banda.value);
    if (!isFinite(f) || f <= 0) f = 446.1;

    var bat = BATERIE.filter(function (b) { return b.id === el.baterie.value; })[0] || BATERIE[0];

    var cfg = {
      f: f,
      pA: parseFloat(el.vykon.value) * bat.f,
      bdA: bd(el.antena.value),
      h1: parseFloat(el.vyska.value),
      extra: parseFloat(el.extra.value),
      cit: parseFloat(el.citlivost.value),
      ter: teren(el.teren.value)
    };

    if (el.zrcadlo.checked) {
      cfg.pB = cfg.pA;
      cfg.bdB = cfg.bdA;
      cfg.h2 = cfg.h1;
    } else {
      cfg.pB = parseFloat(el.vykonB.value) * bat.f;
      cfg.bdB = bd(el.antenaB.value);
      cfg.h2 = parseFloat(el.vyskaB.value);
    }
    return cfg;
  }

  function bd(id) {
    var a = ANTENY.filter(function (x) { return x.id === id; })[0];
    return a ? a.bd : 0;
  }

  function teren(id) {
    return TEREN.filter(function (x) { return x.id === id; })[0] || TEREN[0];
  }

  /* ------------------------------------------------------------ vypočet --- */

  // EIRP je výkon vyzářený ve směru maximálního zisku antény (v dBi).
  // e.r.p. se v předpisech počítá vůči dipólu, tedy o 2,15 dB méně než EIRP.
  function erpDbm(eirpDbm) { return eirpDbm - D2BD; }
  function erpW(eirpDbm) { return Math.pow(10, (erpDbm(eirpDbm) - 30) / 10); }

  function fmtW(w) { return fmt(w, w < 1 ? 3 : 2); }

  function spocitej(cfg) {
    var gA = cfg.bdA + D2BD, gB = cfg.bdB + D2BD;
    var eirpA = dbm(cfg.pA) + gA;
    var eirpB = dbm(cfg.pB) + gB;
    // dohled určuje slabší ze dvou směrů
    var rozpocetAB = eirpA + gB - cfg.cit;
    var rozpocetBA = eirpB + gA - cfg.cit;
    var rozpocetMin = Math.min(rozpocetAB, rozpocetBA);
    var smer = rozpocetAB <= rozpocetBA ? 'AB' : 'BA';

    var dohled = najdiDohled(cfg, rozpocetMin);
    var robust = najdiDohled(cfg, rozpocetMin - 10);
    var komp = dohled > 0 ? rozpocet(cfg, dohled) : null;

    return {
      cfg: cfg, gA: gA, gB: gB, eirpA: eirpA, eirpB: eirpB,
      erpA: erpDbm(eirpA), erpB: erpDbm(eirpB),
      rozpocetAB: rozpocetAB, rozpocetBA: rozpocetBA, rozpocetMin: rozpocetMin,
      smer: smer, dohled: dohled, robust: robust, komp: komp,
      gh: vyskovyZisk(cfg.h1, cfg.h2),
      horizon: 4.12 * (Math.sqrt(cfg.h1) + Math.sqrt(cfg.h2))
    };
  }

  /* ------------------------------------------------------------- vykres --- */

  function vykreslovani(w) {
    var d = w.dohled > 0 ? w.dohled : D_MAX;
    var gB = w.gB;
    var eirpVysilajici = w.smer === 'AB' ? w.eirpA : w.eirpB;
    var gPrijimajici = w.smer === 'AB' ? gB : w.gA;
    var maxD = Math.min(500, Math.max(20, d * 3));

    var x0 = 48, x1 = 626, y0 = 16, y1 = 262;
    var dMinD = D_MIN, dMaxD = maxD;
    var pMin = -150, pMax = 20;

    function X(dKm) {
      var t = Math.log10(dKm / dMinD) / Math.log10(dMaxD / dMinD);
      return x0 + t * (x1 - x0);
    }
    function Y(dbm) {
      return y1 - ((dbm - pMin) / (pMax - pMin)) * (y1 - y0);
    }

    var s = '<defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#ffb03b" stop-opacity="0.30"/>' +
      '<stop offset="100%" stop-color="#ffb03b" stop-opacity="0.02"/></linearGradient></defs>';

    // mřížka
    var ticks = [0, -20, -40, -60, -80, -100, -120, -140];
    ticks.forEach(function (t) {
      var y = Y(t);
      s += '<line class="grid-line" x1="' + x0 + '" y1="' + y.toFixed(1) + '" x2="' + x1 + '" y2="' + y.toFixed(1) + '"/>';
      s += '<text class="axis-text" x="' + (x0 - 7) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + t + '</text>';
    });

    var dTicks = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 400].filter(function (t) { return t <= dMaxD; });
    dTicks.forEach(function (t) {
      var x = X(t);
      s += '<line class="grid-line" x1="' + x.toFixed(1) + '" y1="' + y0 + '" x2="' + x.toFixed(1) + '" y2="' + y1 + '"/>';
      var lab = t < 1 ? (t * 1000) + 'm' : t + 'km';
      s += '<text class="axis-text" x="' + x.toFixed(1) + '" y="' + (y1 + 15) + '" text-anchor="middle">' + lab + '</text>';
    });

    s += '<text class="axis-text" x="' + x0 + '" y="' + (y1 + 30) + '">vzdálenost (log. stupnice)</text>';
    s += '<text class="axis-text" x="' + (x0 - 7) + '" y="' + (y0 - 4) + '" text-anchor="end">dBm</text>';

    // křivka signálu
    var pts = [], n = 140;
    for (var i = 0; i <= n; i++) {
      var dKm = dMinD * Math.pow(dMaxD / dMinD, i / n);
      var p = eirpVysilajici + gPrijimajici - celkoveZtraty(w.cfg, dKm);
      pts.push([X(dKm), Y(Math.max(pMin, Math.min(pMax, p)))]);
    }
    var line = pts.map(function (p, k) { return (k ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    s += '<path class="area" d="' + line + ' L' + x1 + ' ' + y1 + ' L' + x0 + ' ' + y1 + ' Z"/>';
    s += '<path class="curve" d="' + line + '"/>';

    // práh citlivosti
    var yThr = Y(w.cfg.cit);
    s += '<line class="thr-line" x1="' + x0 + '" y1="' + yThr.toFixed(1) + '" x2="' + x1 + '" y2="' + yThr.toFixed(1) + '"/>';
    s += '<text class="thr-text" x="' + (x0 + 6) + '" y="' + (yThr - 5).toFixed(1) + '">citlivost ' + w.cfg.cit + ' dBm</text>';

    // mez dohledu
    if (w.dohled > 0 && w.dohled <= dMaxD) {
      var xl = X(w.dohled);
      s += '<line class="limit-line" x1="' + xl.toFixed(1) + '" y1="' + y0 + '" x2="' + xl.toFixed(1) + '" y2="' + y1 + '"/>';
      var dd = fmtDist(w.dohled);
      s += '<text class="limit-text" x="' + Math.min(xl + 6, x1 - 4).toFixed(1) + '" y="' + (y0 + 12) + '">dohled ' + dd.v + ' ' + dd.u + '</text>';
    }

    el.chart.innerHTML = s;
  }

  /* ------------------------------------------------------------ vypis --- */

  function vypis(w) {
    var d = w.dohled;
    var dd = fmtDist(d);
    var rb = fmtDist(w.robust);

    $('r-drah').textContent = d > 0 ? dd.v + ' ' + dd.u : 'nulový';
    $('r-drah-sub').textContent = d <= 0
      ? 'Za těchto podmínek spojení nevznikne ani v bezprostřední blízkosti.'
      : 'Slabší směr spoje (' + w.smer + ') · ' + fmtFreq(w.cfg.f) + ' MHz';

    $('r-robust').textContent = d > 0 ? rb.v + ' ' + rb.u : '–';
    $('r-eirp').textContent = fmtW(erpW(w.eirpA)) + ' W';
    $('r-gh').textContent = (w.gh >= 0 ? '+' : '') + fmt(w.gh, 1) + ' dB';
    $('r-horizon').textContent = w.horizon < 1 ? fmt(w.horizon * 1000, 0) + ' m' : fmt(w.horizon, 1) + ' km';

    vypisLegality(w);
    vypisRozpocet(w);
    vykreslovani(w);

    $('vyska-a-val').textContent = fmt(w.cfg.h1, w.cfg.h1 < 10 ? 1 : 0) + ' m';
    $('vyska-b-val').textContent = fmt(w.cfg.h2, w.cfg.h2 < 10 ? 1 : 0) + ' m';
    $('extra-val').textContent = w.cfg.extra + ' dB';

    var bat = BATERIE.filter(function (b) { return b.id === el.baterie.value; })[0] || BATERIE[0];
    $('baterie-note').textContent = bat.note;
    $('vykon-hint').textContent = '= ' + fmtW(w.cfg.pA) + ' W';
    $('b-vykon-hint').textContent = '= ' + fmtW(w.cfg.pB) + ' W';
    $('teren-note').textContent = w.cfg.ter.note;

    var graf = w.dohled > 0 ? fmtDist(w.dohled).v + ' ' + fmtDist(w.dohled).u : 'nulový';
    $('chart-desc').textContent =
      'Křivka ukazuje přijatý výkon, který stanice ' + (w.smer === 'AB' ? 'B' : 'A') +
      ' přijímá od stanice ' + (w.smer === 'AB' ? 'A' : 'B') + '. ' +
      'Průsečík s čárou citlivosti odpovídá dohledu ' + graf + '.';
  }

function vypisLegality(w) {
    var lim = limitPro(w.cfg.f);
    var erp = erpW(w.eirpA); // vyzářený výkon vůči dipólu – to se porovnává s limitem
    var cls, text;

    if (lim) {
      // Na PMR446 nestačí dodržet výkon, anténa musí být součástí stanice
      if (lim.integralni && (w.cfg.bdA > 0.6 || w.cfg.bdB > 0.6)) {
        cls = 'legal-warn';
        text = '<b>Nepovolená anténa.</b> Na PMR446 smí být pouze anténa <b>integrovaná</b> – ' +
          'snížit, nebo vyměnit vysílačku, ne přidávat externí anténu. Externí anténa je nepřípustná ' +
          'i tehdy, když je výkon v mezích. (' + lim.detail + ')';
      } else if (erp > lim.w * 1.02) {
        cls = 'legal-warn';
        text = '<b>Překročen limit.</b> ' + lim.label + ' dovoluje ' + fmt(lim.w, lim.w < 1 ? 1 : 0) +
          ' W e.r.p., tvůj vyzářený výkon je ' + fmtW(erp) + ' W. Sníž výkon vysílačky nebo použij anténu ' +
          's menším ziskem. (' + lim.detail + ')';
      } else {
        cls = 'legal-ok';
        text = '<b>V mezích předpisů.</b> ' + lim.label + ' · ' + lim.detail +
          '. Anténa je součástí stanice a výkon nepřekračuje limit.';
      }
    } else if (jeAmatr(w.cfg.f)) {
      cls = 'legal-info';
      text = '<b>Radioamatérské pásmo.</b> Pro vysílání je potřeba platná zkouška operátora a vysílání ' +
        'vlastní značky. Výkonový limit se počítá jinak než u sdílených kmitočtů — počítej s hodnotou pro ' +
        'dané pásmo a třídu.';
    } else {
      cls = 'legal-info';
      text = '<b>Nejde o volnou kmitočtu.</b> Na této frekvenci potřebuješ individuální oprávnění k využívání ' +
        'rádiových kmitočtů od ČTÚ, případně provoz v rámci cizí sítě prostřednictvím držitele oprávnění.';
    }

    var box = $('r-legal');
    box.className = 'legal ' + cls;
    box.innerHTML = text;
  }

  function vypisRozpocet(w) {
    var c = w.komp || rozpocet(w.cfg, Math.max(D_MIN, 0.05));
    var r = [];
    function row(label, value, cls) {
      r.push('<tr><td>' + label + '</td><td style="text-align:right" class="' + (cls || '') + '">' + value + '</td></tr>');
    }

    row('Výkon stanice A', fmtW(w.cfg.pA) + ' W = ' + fmt(dbm(w.cfg.pA), 1) + ' dBm');
    row('Zisk antény A', '+' + fmt(w.cfg.bdA, 1) + ' dBd (' + fmt(w.cfg.gA, 1) + ' dBi)');
    row('EIRP stanice A', fmt(w.eirpA, 1) + ' dBm = ' + fmtW(Math.pow(10, (w.eirpA - 30) / 10)) + ' W');
    row('e.r.p. stanice A', fmt(w.erpA, 1) + ' dBm = ' + fmtW(erpW(w.eirpA)) + ' W', 'ok');
    row('Výkon stanice B', fmtW(w.cfg.pB) + ' W = ' + fmt(dbm(w.cfg.pB), 1) + ' dBm');
    row('Zisk antény B', '+' + fmt(w.cfg.bdB, 1) + ' dBd (' + fmt(w.cfg.gB, 1) + ' dBi)');
    row('EIRP stanice B', fmt(w.eirpB, 1) + ' dBm = ' + fmtW(Math.pow(10, (w.eirpB - 30) / 10)) + ' W');
    row('e.r.p. stanice B', fmt(w.erpB, 1) + ' dBm = ' + fmtW(erpW(w.eirpB)) + ' W', 'ok');
    row('Citlivost přijímače', w.cfg.cit + ' dBm');
    row('Ztrátový rozpočet (slabší směr)', fmt(w.rozpocetMin, 1) + ' dB');

    if (w.dohled > 0) {
      var dd = fmtDist(w.dohled);
      row('Výškový zisk antén', '+' + fmt(w.gh, 1) + ' dB');
      row('Ztráta volného prostoru na dohledu', fmt(c.fspl, 1) + ' dB');
      row('Ztráty v terénu (' + w.cfg.ter.label.toLowerCase() + ')', fmt(c.env, 1) + ' dB');
      row('Ztráty ohybem Země', fmt(c.diff, 1) + ' dB');
      row('Překážky v přímé spojnici', w.cfg.extra + ' dB');
      row('Ztráta celkem na dohledu', fmt(c.fspl + c.env + c.diff + c.extra, 1) + ' dB');
      row('Rezerva', fmt(w.rozpocetMin - (c.fspl + c.env + c.diff + c.extra), 1) + ' dB', 'ok');
      row('<strong>Dohled</strong>', '<strong>' + dd.v + ' ' + dd.u + '</strong>', 'ok');
    } else {
      row('Ztráty v terénu na 1 km', fmt(rozpocet(w.cfg, 1).env, 1) + ' dB');
    }

    $('r-table').innerHTML = r.join('');
  }

  /* ------------------------------------------------------------- udalosti --- */

  function prepniPruhlednostZrcadla() {
    var g = document.querySelector('[data-mirror]');
    if (!g) return;
    g.classList.toggle('is-mirrored', el.zrcadlo.checked);
    document.querySelectorAll('[data-mirror] select, [data-mirror] input').forEach(function (i) {
      i.tabIndex = el.zrcadlo.checked ? -1 : 0;
    });
  }

  function zrcadli() {
    if (!el.zrcadlo.checked) return;
    el.vykonB.value = el.vykon.value;
    el.antenaB.value = el.antena.value;
    el.vyskaB.value = el.vyska.value;
  }

  function prepniBandu() {
    var custom = el.banda.value === 'custom';
    $('f-custom-wrap').hidden = !custom;
  }

  function obnov() {
    var w = spocitej(nacti());
    vypis(w);
    stav = w;
  }

  /* -------------------------------------------------------------- presety --- */

  var PRESETY = {
    'pmr-mesto': { banda: '446.1', vykon: '0.5', baterie: 'plna', antena: 'duck', vyska: '1.5', teren: 'mesto', citlivost: '-112', extra: '3' },
    'pmr-krajina': { banda: '446.1', vykon: '0.5', baterie: 'plna', antena: 'duck', vyska: '1.5', teren: 'krajina', citlivost: '-115', extra: '0' },
    'sdil-uhf': { banda: '448.49', vykon: '2.5', baterie: 'plna', antena: 'l8', vyska: '1.5', teren: 'les', citlivost: '-115', extra: '10' },
    'sdil-vhf': { banda: '172.65', vykon: '2.5', baterie: 'plna', antena: 'l8', vyska: '1.5', teren: 'predmesti', citlivost: '-115', extra: '5' },
    'hora': { banda: '438.5', vykon: '25', baterie: 'plna', antena: 'l8', vyska: '30', teren: 'hora', citlivost: '-120', extra: '0' },
    'auto': { banda: '448.49', vykon: '2.5', baterie: 'plna', antena: 'l8', vyska: '2', teren: 'predmesti', citlivost: '-115', extra: '5' }
  };

  function aplikovatPreset(id, chip) {
    var p = PRESETY[id];
    if (!p) return;
    el.banda.value = p.banda;
    el.vykon.value = p.vykon;
    el.baterie.value = p.baterie;
    el.antena.value = p.antena;
    el.vyska.value = p.vyska;
    el.teren.value = p.teren;
    el.citlivost.value = p.citlivost;
    el.extra.value = p.extra;
    zrcadli();
    prepniBandu();
    document.querySelectorAll('[data-preset]').forEach(function (c) { c.classList.remove('is-active'); });
    if (chip) chip.classList.add('is-active');
    obnov();
  }

  /* ---------------------------------------------------------------- start --- */

  function init() {
    el.banda = $('f-banda');
    el.fcustom = $('f-custom');
    el.vykon = $('f-vykon');
    el.vykonB = $('f-b-vykon');
    el.baterie = $('f-baterie');
    el.antena = $('f-antena');
    el.antenaB = $('f-b-antena');
    el.vyska = $('f-vyska');
    el.vyskaB = $('f-b-vyska');
    el.teren = $('f-teren');
    el.citlivost = $('f-citlivost');
    el.extra = $('f-extra');
    el.zrcadlo = $('f-zrcadlo');
    el.chart = $('chart');

    if (!el.banda) return;

    naplnSelecty();
    el.vykon.value = '0.5';
    el.vykonB.value = '0.5';
    el.citlivost.value = '-115';
    el.teren.value = 'predmesti';
    el.antena.value = 'duck';
    el.antenaB.value = 'duck';
    el.baterie.value = 'plna';
    el.vykon.addEventListener('change', zrcadli);

    el.banda.addEventListener('change', function () { prepniBandu(); obnov(); });
    el.fcustom.addEventListener('input', obnov);
    [el.vykon, el.baterie, el.antena, el.teren, el.citlivost, el.extra, el.vyska,
     el.vykonB, el.antenaB, el.vyskaB].forEach(function (i) {
      i.addEventListener('input', obnov);
    });
    el.zrcadlo.addEventListener('change', function () { zrcadli(); prepniPruhlednostZrcadla(); obnov(); });

    document.querySelectorAll('.quick-heights button').forEach(function (b) {
      b.addEventListener('click', function () {
        el.vyska.value = b.dataset.h;
        zrcadli();
        obnov();
      });
    });

    document.querySelectorAll('[data-preset]').forEach(function (c) {
      c.addEventListener('click', function () { aplikovatPreset(c.dataset.preset, c); });
    });

    prepniBandu();
    prepniPruhlednostZrcadla();
    aplikovatPreset('pmr-mesto', document.querySelector('[data-preset="pmr-mesto"]'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__radarCalc = {
    TEREN: TEREN, ANTENY: ANTENY, LIMITY: SDILENE,
    volnyProstor: volnyProstor, terenniZtraty: terenniZtraty,
    vyskovyZisk: vyskovyZisk, ohybZeme: ohybZeme, erpDbm: erpDbm, erpW: erpW,
    rozpocet: rozpocet, celkoveZtraty: celkoveZtraty,
    najdiDohled: najdiDohled, limitPro: limitPro, jeAmatr: jeAmatr,
    spocitej: spocitej, nacti: nacti, obnov: obnov, stav: function () { return stav; }
  };
})();