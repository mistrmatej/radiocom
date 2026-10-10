/* Mapový režim kalkulačky dosahu.
   Stanoviš se zadá kliknutím do mapy. Z výškové databáze se načte terénní
   profil podél N paprsků (azimutů) a pro každý paprsek se vypočte, kam až
   signál dosáhne. Výsledkem je obrys zóny dosahu, kde prohlubně jsou stíny
   za kopci a jinými překážkami.

   Model šíření na paprsku:
     P(d) = EIRP + G_rx - [ L_volny(d) + L_prostredi(d) + L_difrakce(d) + L_extra ]
   Difrakce se počítá jako součet ostří nože (knife-edge) pro všechny body
   profilu, které vystupují nad spojnici antén, s korekcí na zakřivení Země
   (efektivní poloměr 4/3). Ztráty v prostředí používají stejný empirický
   exponentní model jako původní kalkulačka, aby oba režimy dávaly
   slučitelné výsledky.
*/
(function () {
  'use strict';

  /* ------------------------------------------------------------- konstanty --- */

  var D2BD = 2.15;          // 0 dBd v dBi
  var R_EFF = 8495;         // km, Zeme s efektivním poloměrem 4/3
  var R_ZEME = 6371;        // km, pro převod na plochu mapy
  var D_MIN = 0.05;         // km, nejmenší uvažovaná vzdálenost
  var D_MAX = 150;          // km, tvrdý strop dosahu

  var AZ_STUPEN = 5;        // 72 paprsků
  var RAY_MAX = 90;         // km, na jak daleko se v jednom směru hledá

  // Vzdálenosti, na kterých se v každém paprsku odečítá terén. Blízko stanoviště
  // hustě (difrakce je citlivá na první kilometry), do dálky řídce.
  var VZDALENOSTI = (function () {
    var v = [], d = 0.05;
    while (d < 1) { v.push(d); d += 0.05; }              // 50 m kroky do 1 km
    for (d = 1; d < 5; d += 0.25) v.push(d);
    for (d = 5; d <= 20; d += 1) v.push(d);
    for (d = 22; d <= 50; d += 4) v.push(d);
    for (d = 60; d <= RAY_MAX; d += 10) v.push(d);
    return v;
  })();

  var TEREN = (window.__radarCalc && window.__radarCalc.TEREN) || [];
  var ANTENY = (window.__radarCalc && window.__radarCalc.ANTENY) || [];
  var LIMITY = (window.__radarCalc && window.__radarCalc.LIMITY) || [];

  /* ------------------------------------------------------------------ data --- */

  // Výška terénu. Primárně Open-Meteo (SRTM/GLO, bez klíče, 100 bodů na dotaz),
  // záloha OpenTopoData (SRTM 30 m). Výsledky se cacheují v localStorage, aby se
  // stejná oblast nestahovala znovu.
  var CACHE_KEY = 'radiocom.teren.v1';
  var cache = {};

  try {
    var raw = localStorage.getItem(CACHE_KEY);
    if (raw) cache = JSON.parse(raw) || {};
  } catch (e) { cache = {}; }

  var cacheDirty = false;
  var cacheTimer = null;

  function ulozCache() {
    if (cacheDirty || cacheTimer) return;
    cacheTimer = setTimeout(function () {
      cacheDirty = false;
      cacheTimer = null;
      try {
        var klice = Object.keys(cache);
        if (klice.length > 40000) {
          // necháme jen posledních 20 tisíc bodů, aby localBoard nececal
          var nove = {};
          klice.slice(-20000).forEach(function (k) { nove[k] = cache[k]; });
          cache = nove;
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (e) { /* kvóta překročena – cache přeskočíme */ }
    }, 800);
  }

  function cacheKlice(lat, lon) {
    return lat.toFixed(4) + ',' + lon.toFixed(4);
  }

  function dostatZCache(lat, lon) {
    var v = cache[cacheKlice(lat, lon)];
    return typeof v === 'number' ? v : null;
  }

  function datDoCache(lat, lon, v) {
    cache[cacheKlice(lat, lon)] = v;
    cacheDirty = true;
    ulozCache();
  }

  function rozdel(body, start) {
    return body.slice(start, start + 100);
  }

  function fetchChunk(body) {
    var url = 'https://api.open-meteo.com/v1/elevation?latitude=' +
      body.map(function (p) { return p.lat.toFixed(5); }).join(',') +
      '&longitude=' +
      body.map(function (p) { return p.lon.toFixed(5); }).join(',');

    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('open-meteo ' + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j || !j.elevation || j.elevation.length !== body.length) {
          throw new Error('open-meteo: neúplná odpověď');
        }
        return j.elevation;
      });
  }

  function fetchChunkZaloha(body) {
    var locs = body.map(function (p) { return p.lat.toFixed(5) + ',' + p.lon.toFixed(5); }).join('|');
    return fetch('https://api.opentopodata.org/v1/srtm30m?locations=' + encodeURIComponent(locs))
      .then(function (r) {
        if (!r.ok) throw new Error('opentopodata ' + r.status);
        return r.json();
      })
      .then(function (j) {
        return (j.results || []).map(function (x) {
          return x && typeof x.elevation === 'number' ? x.elevation : null;
        });
      });
  }

  // Výšky pro seznam bodů {lat, lon}; body, které jsou v cache, se netáhnou.
  // Posílá se po 100 bodech (limit API), fronty jedou postupně, aby se
  // nezahltila síť a šel hlásit postup.
  function vyskyPro(body, progres) {
    var potrebne = [], vysledek = new Array(body.length);

    body.forEach(function (p, i) {
      var c = dostatZCache(p.lat, p.lon);
      if (c === null) potrebne.push({ i: i, lat: p.lat, lon: p.lon });
      else vysledek[i] = c;
    });

    if (!potrebne.length) {
      if (progres) progres(1);
      return Promise.resolve(vysledek);
    }

    var fronty = [];
    for (var s = 0; s < potrebne.length; s += 100) fronty.push(rozdel(potrebne, s));

    var hotovo = 0, celkem = potrebne.length, index = 0;

    return new Promise(function (resolve) {
      if (progres) progres(0.02);

      function dalsi() {
        if (index >= fronty.length) { resolve(vysledek); return; }
        var fronta = fronty[index++];

        fetchChunk(fronta)
          .catch(function () { return fetchChunkZaloha(fronta); })
          .then(function (vysky) {
            fronta.forEach(function (p, k) {
              var h = vysky[k];
              if (typeof h !== 'number' || !isFinite(h)) return;
              vysledek[p.i] = h;
              datDoCache(p.lat, p.lon, h);
            });
          })
          .catch(function () { /* fronta selhala – body zůstanou null */ })
          .then(function () {
            hotovo += fronta.length;
            if (progres) progres(hotovo / celkem);
            dalsi();
          });
      }

      dalsi();
    });
  }

  /* --------------------------------------------------------------- geometrie --- */

  function posun(lat, lon, azStupne, dKm) {
    var phi1 = lat * Math.PI / 180, lam1 = lon * Math.PI / 180;
    var az = azStupne * Math.PI / 180;
    var dr = dKm / R_ZEME;
    var sinPhi2 = Math.sin(phi1) * Math.cos(dr) +
                  Math.cos(phi1) * Math.sin(dr) * Math.cos(az);
    var phi2 = Math.asin(Math.min(1, Math.max(-1, sinPhi2)));
    var lam2 = lam1 + Math.atan2(
      Math.sin(az) * Math.sin(dr) * Math.cos(phi1),
      Math.cos(dr) - Math.sin(phi1) * sinPhi2);
    return { lat: phi2 * 180 / Math.PI, lon: lam2 * 180 / Math.PI };
  }

  function vzdalenost(a, b) {
    var dLat = (b.lat - a.lat) * Math.PI / 180;
    var dLon = (b.lon - a.lon) * Math.PI / 180;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R_ZEME * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  /* -------------------------------------------------------------- ztrátový model --- */

  function volnyProstor(dKm, fMHz) {
    return 32.44 + 20 * Math.log10(fMHz) + 20 * Math.log10(dKm);
  }

  function vyskovyZisk(h1, h2) {
    var h = Math.max(h1, h2);
    return 25 * Math.log10((h + 3) / 4.5);
  }

  function terenniZtraty(ter, dKm, gh) {
    return ter.c + (10 * ter.n - 20) * Math.log10(dKm) - gh;
  }

  // Difrakce přes jednu ostrou překážku (metoda knife-edge, ITU-R P.526).
  // hObs v metrech nad spojnicí, v1 a v2 vzdálenosti překážky od obou antén.
  function nuzKnifeEdge(hObs, v1Km, v2Km, lambda) {
    if (hObs <= 0) return 0;
    var v = Math.SQRT2 * hObs / Math.sqrt(lambda * (v1Km * 1000) * (v2Km * 1000));
    if (v <= 0) return 0;
    var L = v < 0.78
      ? 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) * (v - 0.1) + 1) + v - 0.1)
      : 20 * Math.log10(2 * v);
    return L > 0 ? L : 0;
  }

  /* ------------------------------------------------------------ výpočet paprsku --- */

  // profil: [{d: km, h: m n. m.}], uspořádané od stanoviště.
  // Vrací ztrátu difrakcí pro cílovou vzdálenost dKm, kde cílová anténa stojí
  // ve výšce h2 nad terénem.
  function difrakceProfilu(profil, dKm, fMHz, hTx, h2) {
    var lambda = 300 / fMHz;
    var hPoc = profil[0].h + hTx;                 // výška vysílací antény n. m.
    if (dKm <= D_MIN) return 0;

    var hCil = 0;
    for (var i = 0; i < profil.length; i++) {
      if (profil[i].d >= dKm - 1e-9) { hCil = profil[i].h; break; }
    }

    var hCilAnt = hCil + h2;                      // výška přijímací antény n. m.
    var celk = 0;

    for (var j = 1; j < profil.length; j++) {
      var p = profil[j];
      if (p.d >= dKm - 1e-9) break;

      // výška přímé spojnice v dané vzdálenosti
      var t = p.d / dKm;
      var hLos = hPoc + (hCilAnt - hPoc) * t;

      // ohyb Země – terén se nám jeví níže
      var ohyb = (p.d * (dKm - p.d)) / (2 * R_EFF) * 1000; // m

      var hObs = (p.h - ohyb) - hLos;
      if (hObs <= 0) continue;

      celk += nuzKnifeEdge(hObs, p.d, dKm - p.d, lambda);
      if (celk > 80) return 80;                   // hluboký stín, další už není potřeba
    }

    return celk;
  }

  // Přijatý výkon na vzdálenosti dKm v jednom paprsku.
  function prijemVpaprsku(cfg, profil, dKm) {
    var eirp = 10 * Math.log10(cfg.p * 1000) + cfg.bd + D2BD;
    var gRx = cfg.bdRx + D2BD;
    var gh = vyskovyZisk(cfg.hTx, cfg.hRx);
    var L = volnyProstor(dKm, cfg.f) +
            terenniZtraty(cfg.ter, dKm, gh) +
            difrakceProfilu(profil, dKm, cfg.f, cfg.hTx, cfg.hRx) +
            cfg.extra;
    return eirp + gRx - L;
  }

  // Najvětší vzdálenost v paprsku, kde ještě platí P >= citlivost.
  function dohledPaprsku(cfg, profil) {
    var hran = cfg.cit;
    if (prijemVpaprsku(cfg, profil, D_MIN) < hran) return 0;

    var predchozi = D_MIN;
    for (var i = 0; i < profil.length; i++) {
      var d = profil[i].d;
      if (d <= D_MIN) continue;
      if (prijemVpaprsku(cfg, profil, d) >= hran) { predchozi = d; continue; }

      // zlom mezi dvěma vzorky terénu – půlení
      var lo = predchozi, hi = d;
      for (var k = 0; k < 22; k++) {
        var mid = (lo + hi) / 2;
        if (prijemVpaprsku(cfg, profil, mid) >= hran) lo = mid; else hi = mid;
      }
      return lo;
    }
    return predchozi;
  }

  /* ------------------------------------------------------------ načtení terénu --- */

  function sestavPaprsky(lat, lon) {
    var body = [];
    for (var a = 0; a < 360; a += AZ_STUPEN) {
      for (var i = 0; i < VZDALENOSTI.length; i++) {
        var p = posun(lat, lon, a, VZDALENOSTI[i]);
        body.push({ lat: p.lat, lon: p.lon });
      }
    }
    return body;
  }

  // Vrátí profily pro všechny paprsky: [{az: 0..359, body: [{d, h}]}]
  function nactiProfily(lat, lon, progres) {
    var body = sestavPaprsky(lat, lon);

    return vyskyPro(body, progres).then(function (vysledky) {
      var profily = [];
      var index = 0;
      for (var a = 0; a < 360; a += AZ_STUPEN) {
        var profil = [];
        for (var i = 0; i < VZDALENOSTI.length; i++) {
          var h = vysky[index++];
          profil.push({ d: VZDALENOSTI[i], h: typeof h === 'number' ? h : null });
        }
        profily.push({ az: a, body: profil });
      }
      return profily;
    });
  }

  // Výška stanoviště – nadzvednutá nad nejbližším známým bodem, protože první
  // vzorek leží přímo pod stanicí a bývá z DEM zatížený chybou.
  function vyskaStanoviste(profily) {
    var p = profily[0];
    var p1 = p.body[0].h;
    var p2 = p.body[3] ? p.body[3].h : p1;
    if (p1 == null && p2 == null) return null;
    if (p1 == null) return p2;
    if (p2 == null) return p1;
    return Math.max(p1, p2);
  }

  /* ---------------------------------------------------------------- vyhodnocení --- */

  // margin v dB navíc nad citlivost – 0 = mez slyšení, 10 = spolehlivý hovor
  function vyhodnot(cfg, profily, margin) {
    var c2 = { f: cfg.f, p: cfg.p, bd: cfg.bd, bdRx: cfg.bdRx,
               hTx: cfg.hTx, hRx: cfg.hRx, ter: cfg.ter, extra: cfg.extra,
               cit: cfg.cit + (margin || 0) };

    var vysledky = [];
    profily.forEach(function (p) {
      var d = dohledPaprsku(c2, doplnPrazdna(p.body));
      vysledky.push({ az: p.az, d: Math.min(d, D_MAX) });
    });
    return vysledky;
  }

  // Chybějící výšku terénu doplníme z nejbližšího známého vzorku. Když neznáme
  // nic, vezmeme 0 m – raděj příliš nízký terén než fiktivní hora.
  function doplnPrazdna(body) {
    var profil = body.map(function (b) { return { d: b.d, h: b.h }; });
    var posledni = null;
    for (var i = 0; i < profil.length; i++) {
      if (profil[i].h !== null) { posledni = profil[i].h; continue; }
      var dalsi = null;
      for (var j = i + 1; j < profil.length; j++) {
        if (profil[j].h !== null) { dalsi = profil[j].h; break; }
      }
      profil[i].h = posledni !== null ? posledni : (dalsi !== null ? dalsi : 0);
    }
    return profil;
  }

  /* -------------------------------------------------------------- vykreslení --- */

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
    return f.toFixed(5).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
  }

  /* ------------------------------------------------------------------- aplikace --- */

  var el = {};
  var mapa = null;
  var vrstvaZony = null;
  var vrstvaObrys = null;
  var marker = null;
  var stav = { lat: null, lon: null, profily: null, vysledky: null, cfg: null };
  var busy = false;

  function $(id) { return document.getElementById(id); }

  function teren(id) {
    return TEREN.filter(function (x) { return x.id === id; })[0] || TEREN[2] || TEREN[0];
  }

  function bd(id) {
    var a = ANTENY.filter(function (x) { return x.id === id; })[0];
    return a ? a.bd : 0;
  }

  function nactiCfg() {
    var f = el.banda.value === 'custom'
      ? parseFloat(el.fcustom.value)
      : parseFloat(el.banda.value);
    if (!isFinite(f) || f <= 0) f = 446.1;

    return {
      f: f,
      p: parseFloat(el.vykon.value),
      bd: bd(el.antena.value),
      bdRx: bd(el.antenaRx.value),
      hTx: parseFloat(el.vyska.value),
      hRx: parseFloat(el.vyskaRx.value),
      cit: parseFloat(el.citlivost.value),
      ter: teren(el.teren.value),
      extra: parseFloat(el.extra.value)
    };
  }

  // Prstenec v polárních souřadnicích – body po obvodu a zpět do středu.
  function prstenec(vysledky, lat, lon) {
    var body = [L.latLng(lat, lon)];
    vysledky.forEach(function (v) {
      var p = posun(lat, lon, v.az, Math.max(v.d, D_MIN));
      body.push(L.latLng(p.lat, p.lon));
    });
    body.push(L.latLng(lat, lon));
    return body;
  }

  function vykresliZony(vysledky, spolehlive, lat, lon) {
    if (!mapa || !vrstvaZony) return;
    vrstvaZony.clearLayers();

    if (!vysledky.length) return;

    // zóna dosažitelného signálu
    L.polygon(prstenec(vysledky, lat, lon), {
      className: 'zone-signal',
      stroke: true,
      color: '#ffb03b',
      weight: 2,
      opacity: 0.95,
      fillColor: '#ffb03b',
      fillOpacity: 0.14,
      interactive: false
    }).addTo(vrstvaZony);

    // zóna spolehlivého hovoru (+10 dB rezerva)
    var maSpolehlive = spolehlive.some(function (v) { return v.d > D_MIN; });
    if (maSpolehlive) {
      L.polygon(prstenec(spolehlive, lat, lon), {
        className: 'zone-solid',
        stroke: true,
        color: '#4ade80',
        weight: 1.5,
        opacity: 0.9,
        fillColor: '#4ade80',
        fillOpacity: 0.16,
        interactive: false
      }).addTo(vrstvaZony);
    }

    // stínové zóny – směry, kde signál nedosáhne ani na blízkou vzdálenost
    var stin = vysledky.filter(function (v) { return v.d <= D_MIN; }).map(function (v) {
      var p = posun(lat, lon, v.az, RAY_MAX * 0.06);
      return [p.lat, p.lon];
    });
    if (stin.length > 1) {
      L.polyline(stin.concat([stin[0]]), {
        className: 'zone-shadow',
        color: '#f87171',
        weight: 3,
        opacity: 0.85,
        dashArray: '5 5',
        fill: false,
        interactive: false
      }).addTo(vrstvaZony);
    }

    // poloměr nejdelšího dosaženého směru – pro porovnání s ideální kružnicí
    var maxD = vysledky.reduce(function (a, v) { return Math.max(a, v.d); }, 0);
    if (maxD > D_MIN) {
      L.circle([lat, lon], {
        radius: maxD * 1000,
        color: '#35c2d8',
        weight: 1,
        opacity: 0.5,
        dashArray: '6 6',
        fill: false,
        interactive: false
      }).addTo(vrstvaObrys);
    }

    // konec každého paprsku
    vysledky.forEach(function (v) {
      if (v.d <= D_MIN) return;
      var p = posun(lat, lon, v.az, v.d);
      L.circleMarker([p.lat, p.lon], {
        className: 'ray-end',
        radius: 2,
        color: '#ffb03b',
        weight: 1,
        opacity: 0.6,
        fill: false,
        interactive: false
      }).addTo(vrstvaObrys);
    });
  }

  function nastavBusy(ano, text) {
    busy = ano;
    var st = $('mapa-stav');
    if (!st) return;
    st.textContent = text || (ano ? 'Načítám terén…' : '');
    st.classList.toggle('is-busy', ano);
    var btn = $('mapa-znovu');
    if (btn) btn.disabled = ano;
  }

  function prekresli() {
    if (!stav.profily || !mapa) return;
    var cfg = nactiCfg();
    stav.cfg = cfg;

    var vysledky = vyhodnot(cfg, stav.profily, 0);
    var spolehlive = vyhodnot(cfg, stav.profily, 10);
    stav.vysledky = vysledky;
    stav.spolehlive = spolehlive;

    vrstvaObrys.clearLayers();
    vykresliZony(vysledky, spolehlive, stav.lat, stav.lon);
    vypisVysledky(cfg, vysledky, spolehlive);
  }

  function vypisVysledky(cfg, vysledky, spolehlive) {
    var dohledy = vysledky.map(function (v) { return v.d; });
    var maxD = Math.max.apply(null, dohledy);
    var minD = Math.min.apply(null, dohledy);
    var prumD = dohledy.reduce(function (a, b) { return a + b; }, 0) / dohledy.length;

    var smerMax = vysledky[dohledy.indexOf(maxD)];
    var smerMin = vysledky[dohledy.indexOf(minD)];

    var funguje = dohledy.filter(function (d) { return d > D_MIN; }).length;
    var solid = spolehlive.map(function (v) { return v.d; })
                          .filter(function (d) { return d > D_MIN; });
    var prumSolid = solid.reduce(function (a, b) { return a + b; }, 0) / (solid.length || 1);

    $('m-drah-max').textContent = maxD > 0 ? fmtDist(maxD).v + ' ' + fmtDist(maxD).u : 'nulový';
    $('m-drah-max-sub').textContent = smerMax
      ? 'nejlepší směr ' + compass(smerMax.az) + ' (' + smerMax.az + '°), ' + fmtFreq(cfg.f) + ' MHz'
      : 'Uprav parametry – spojení nevznikne ani v těsné blízkosti.';

    $('m-drah-min').textContent = minD > 0 ? fmtDist(minD).v + ' ' + fmtDist(minD).u : '–';
    $('m-drah-min-sub').textContent = smerMin
      ? 'nejhorší směr ' + compass(smerMin.az) + ' (' + smerMin.az + '°)'
      : '–';

    $('m-drah-prum').textContent = fmtDist(prumD).v + ' ' + fmtDist(prumD).u;
    $('m-drah-solid').textContent = solid.length
      ? fmtDist(prumSolid).v + ' ' + fmtDist(prumSolid).u : '–';
    $('m-veter').textContent = fmt(funguje / vysledky.length * 100, 0) + ' %';
    $('m-veter-sub').textContent = fmt(funguje) + ' z ' + fmt(vysledky.length, 0) + ' směrů';

    var vyska = vyskaStanoviste(stav.profily);
    $('m-vyska').textContent = vyska !== null ? fmt(vyska, 0) + ' m n. m.' : '–';
    $('m-vyska-sub').textContent = 'nadmořská výška terénu pod stanovištěm';

    $('m-antena-abs').textContent = vyska !== null
      ? fmt(vyska + cfg.hTx, 0) + ' m n. m.' : '–';
    $('m-antena-abs-sub').textContent = 'vrchol antény ' + fmt(cfg.hTx, 1) + ' m nad terénem';

    $('m-eirp').textContent = fmt(Math.pow(10, (10 * Math.log10(cfg.p * 1000) + cfg.bd - 30) / 10), 3) + ' W';

    vypisProfilPaprsku(cfg, vysledky);
    vypisLegality(cfg);
  }

  var ZPRAVY_SVETA = ['S', 'SSV', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
                       'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE'];

  function compass(az) {
    return ZPRAVY_SVETA[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
  }

  // Řez terénu v jednom směru: hřeben, přímá spojnice a dosažený dohled.
  function vypisProfilPaprsku(cfg, vysledky) {
    var az = parseInt($('m-profil-smer').value, 10);
    if (!isFinite(az)) az = 0;

    var v = null;
    vysledky.forEach(function (x) {
      if (Math.abs(((x.az - az + 540) % 360) - 180) < AZ_STUPEN / 2 + 0.01) v = x;
    });
    if (!v) v = vysledky[0];

    var zdroj = stav.profily.filter(function (p) { return p.az === v.az; })[0];
    if (!zdroj) return;

    $('m-profil-smer-val').textContent = compass(az) + ' · ' + az + '°';
    $('m-profil-drah').textContent = v.d > D_MIN
      ? fmtDist(v.d).v + ' ' + fmtDist(v.d).u : 'bez spojení';

    var dMaxVykres = Math.max(2, Math.min(v.d > D_MIN ? v.d * 1.2 : 5, 60));
    var body = doplnPrazdna(zdroj.body).filter(function (b) { return b.d <= dMaxVykres; });

    if (body.length < 2) {
      $('m-profil').innerHTML = '<text x="320" y="150" text-anchor="middle" class="axis-text">Profil nedostupný</text>';
      return;
    }

    // rozsah svislé osy
    var hMin = 0, hMax = 0;
    body.forEach(function (b) { if (b.h < hMin) hMin = b.h; if (b.h > hMax) hMax = b.h; });
    hMin -= 20; hMax += 40;
    if (hMax - hMin < 60) { var st = (60 - (hMax - hMin)) / 2; hMin -= st; hMax += st; }

    var W = 640, H = 240, padL = 46, padR = 12, padT = 14, padB = 34;
    function X(d) { return padL + (d / dMaxVykres) * (W - padL - padR); }
    function Y(h) { return padT + (hMax - h) / (hMax - hMin) * (H - padT - padB); }

    var s = '';

    // osy
    for (var k = 0; k <= 4; k++) {
      var hh = hMin + (hMax - hMin) * k / 4;
      var y = Y(hh);
      s += '<line class="grid-line" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '"/>';
      s += '<text class="axis-text" x="' + (padL - 6) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + fmt(hh, 0) + '</text>';
    }
    for (var q = 1; q <= 4; q++) {
      var dd = dMaxVykres * q / 4;
      s += '<text class="axis-text" x="' + X(dd).toFixed(1) + '" y="' + (H - padB + 15) + '" text-anchor="middle">' + fmtDist(dd).v + fmtDist(dd).u + '</text>';
    }
    s += '<text class="axis-text" x="' + padL + '" y="' + (H - 6) + '">vzdálenost od stanoviště (km)</text>';
    s += '<text class="axis-text" x="' + (padL - 6) + '" y="' + (padT - 4) + '" text-anchor="end">m n. m.</text>';

    // přímá spojnice antén
    var hTxAbs = body[0].h + cfg.hTx;
    var hRxAbs = body[body.length - 1].h + cfg.hRx;
    var x1 = X(0), y1 = Y(hTxAbs), x2 = X(dMaxVykres), y2 = Y(hRxAbs);
    s += '<line class="los-line" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
         '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';

    // stínované plochy pod terénem
    var ter = 'M' + x1.toFixed(1) + ' ' + (H - padB);
    body.forEach(function (b) { ter += ' L' + X(b.d).toFixed(1) + ' ' + Y(b.h).toFixed(1); });
    ter += ' L' + X(dMaxVykres).toFixed(1) + ' ' + (H - padB) + ' Z';
    s += '<path class="terrain-fill" d="' + ter + '"/>';

    // hřeben terénu
    var ridge = body.map(function (b, i) {
      return (i ? 'L' : 'M') + X(b.d).toFixed(1) + ' ' + Y(b.h).toFixed(1);
    }).join(' ');
    s += '<path class="terrain-line" d="' + ridge + '"/>';

    // hraně dohledu v tomto směru
    if (v.d > 0 && v.d <= dMaxVykres) {
      s += '<line class="limit-line" x1="' + X(v.d).toFixed(1) + '" y1="' + padT + '" x2="' + X(v.d).toFixed(1) + '" y2="' + (H - padB) + '"/>';
      var dl = fmtDist(v.d);
      s += '<text class="limit-text" x="' + (X(v.d) + 5).toFixed(1) + '" y="' + (padT + 10) + '">dohled ' + dl.v + ' ' + dl.u + '</text>';
    }

    // výšky stanoviště a cíle
    s += '<circle class="pt-tx" cx="' + x1.toFixed(1) + '" cy="' + y1.toFixed(1) + '" r="4"/>';
    s += '<circle class="pt-rx" cx="' + X(body[body.length - 1].d).toFixed(1) + '" cy="' + Y(hRxAbs).toFixed(1) + '" r="4"/>';

    $('m-profil').innerHTML = s;
  }

  function vypisLegality(cfg) {
    var box = $('m-legal');
    var lim = window.__radarCalc ? window.__radarCalc.limitPro(cfg.f) : null;
    var amatr = window.__radarCalc ? window.__radarCalc.jeAmatr(cfg.f) : false;
    var erpW = Math.pow(10, (10 * Math.log10(cfg.p * 1000) + cfg.bd - 30) / 10);
    var cls, text;

    if (lim) {
      if (lim.integralni && cfg.bd > 0.6) {
        cls = 'legal-warn';
        text = '<b>Nepovolená anténa.</b> Na PMR446 smí být pouze anténa <b>integrovaná</b> – ' +
          'snížit nebo vyměnit vysílačku, nepřidávat externí anténu. (' + lim.detail + ')';
      } else if (erpW > lim.w * 1.02) {
        cls = 'legal-warn';
        text = '<b>Překročen limit.</b> ' + lim.label + ' dovoluje ' + fmt(lim.w, lim.w < 1 ? 1 : 0) +
          ' W e.r.p., tvůj vyzářený výkon je ' + fmt(erpW, 3) + ' W. Sníž výkon nebo použij anténu ' +
          's menším ziskem. (' + lim.detail + ')';
      } else {
        cls = 'legal-ok';
        text = '<b>V mezích předpisů.</b> ' + lim.label + ' · ' + lim.detail + '.';
      }
    } else if (amatr) {
      cls = 'legal-info';
      text = '<b>Radioamatérské pásmo.</b> Pro vysílání je potřeba platná zkouška operátora a ' +
        'vysílání vlastní značky. Výkonový limit se počítá jinak než u sdílených kmitočtů.';
    } else {
      cls = 'legal-info';
      text = '<b>Nejde o volnou kmitočtu.</b> Na této frekvenci potřebuješ individuální oprávnění ' +
        'od ČTÚ, případně provoz v rámci cizí sítě.';
    }

    box.className = 'legal ' + cls;
    box.innerHTML = text;
  }

  /* ------------------------------------------------------------- načtení terénu pro bod --- */

  // Kliknutí do mapy = nové stanoviště. Každé kliknutí znovu načte terén,
  // proto se kalkulač čeká na předchozí požadavek (poslední klik vyhrává).
  var cekajici = null;

  function nastavStanoviste(lat, lon) {
    stav.lat = lat;
    stav.lon = lon;
    stav.profily = null;
    stav.vysledky = null;
    stav.spolehlive = null;

    if (marker) marker.setLatLng([lat, lon]);
    if (mapa) mapa.setView([lat, lon], Math.max(mapa.getZoom(), 10), { animate: true });

    $('m-bod').textContent = fmtDeg(lat) + ', ' + fmtDeg(lon);
    if (cekajici) cekajici.cancel = true;

    var pozadavek = { cancel: false };
    cekajici = pozadavek;

    if (!vyskaStanovisteCache(lat, lon)) {
      nastavBusy(true, 'Načítám terén…');
    } else {
      nastavBusy(true, 'Načítám terén… (z paměti)');
    }

    nactiProfily(lat, lon, function (p) {
      if (pozadavek.cancel) return;
      nastavBusy(true, 'Načítám terén… ' + Math.round(p * 100) + ' %');
    }).then(function (profily) {
      cekajici = null;
      if (pozadavek.cancel) return;
      nastavBusy(false, '');
      stav.profily = profily;
      prekresli();
      var vyska = vyskaStanoviste(profily);
      $('m-stav-texto').textContent = vyska !== null
        ? 'Stanoviště nastaveno · terén ' + fmt(vyska, 0) + ' m n. m. · ' +
          fmt(profily[0].body.length * profily.length, 0) + ' bodů terénu'
        : 'Stanoviště nastaveno, výška terénu se nepodařilo zjistit';
    }).catch(function (err) {
      cekajici = null;
      if (pozadavek.cancel) return;
      nastavBusy(false, '');
      $('m-stav-texto').textContent = 'Terén se nepodařilo načíst: ' +
        (err && err.message ? err.message : 'chyba sítě');
    });
  }

  function fmtDeg(v) {
    return v.toFixed(5).replace('.', ',');
  }

  function vyskaStanovisteCache(lat, lon) {
    return dostatZCache(lat, lon) !== null;
  }

  /* -------------------------------------------------------------------- Leaflet --- */

  function initMapa() {
    if (!window.L) return null;
    mapa = L.map('mapa', {
      center: [49.82, 15.47],
      zoom: 11,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: false
    });

    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      minZoom: 3,
      attribution:
        'Mapová data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> přispěvatelé, ' +
        'SRTM | API &copy; <a href="https://open-meteo.com/">Open-Meteo</a>'
    }).addTo(mapa);

    vrstvaObrys = L.layerGroup().addTo(mapa);
    vrstvaZony = L.layerGroup().addTo(mapa);

    marker = L.marker([49.82, 15.47], {
      draggable: true,
      autoPan: false,
      title: 'Stanoviště – přetáhni nebo klikni jinam'
    }).addTo(mapa);

    marker.on('dragend', function () {
      var p = marker.getLatLng();
      nastavStanoviste(p.lat, p.lng);
    });

    mapa.on('click', function (e) {
      // Shift klik řeší druhý posluchač, ten řídí řez terénu
      if (e.originalEvent && e.originalEvent.shiftKey) return;
      nastavStanoviste(e.latlng.lat, e.latlng.lng);
    });

    return mapa;
  }

  /* ---------------------------------------------------------------------- UI --- */

  function naplnSelecty() {
    var moznostiVykonu = [0.125, 0.25, 0.5, 1, 2, 2.5, 5, 7, 25];
    moznostiVykonu.forEach(function (w) {
      var o = document.createElement('option');
      o.value = w;
      o.textContent = fmt(w, w < 1 ? 3 : 2) + ' W';
      el.vykon.appendChild(o);
    });

    var cit = [-100, -105, -110, -112, -115, -120, -125];
    cit.forEach(function (s) {
      var o = document.createElement('option');
      o.value = s;
      o.textContent = s + ' dBm';
      el.citlivost.appendChild(o);
    });

    ANTENY.forEach(function (a) {
      var o = document.createElement('option');
      o.value = a.id;
      o.textContent = a.label;
      el.antena.appendChild(o);
      el.antenaRx.appendChild(o.cloneNode(true));
    });

    TEREN.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.label;
      el.teren.appendChild(o);
    });
  }

  function init() {
    el.banda = $('m-banda');
    el.fcustom = $('m-f-custom');
    el.vykon = $('m-vykon');
    el.antena = $('m-antena');
    el.antenaRx = $('m-antena-rx');
    el.vyska = $('m-vyska');
    el.vyskaRx = $('m-vyska-rx');
    el.citlivost = $('m-citlivost');
    el.teren = $('m-teren');
    el.extra = $('m-extra');
    el.profilSmer = $('m-profil-smer');

    if (!el.banda) return;

    naplnSelecty();
    el.vykon.value = '0.5';
    el.antena.value = 'duck';
    el.antenaRx.value = 'duck';
    el.citlivost.value = '-115';
    el.teren.value = 'predmesti';

    if (!initMapa()) {
      $('m-stav-texto').textContent = 'Mapová knihovna se nenačetla – mapa nebude fungovat.';
      return;
    }

    el.banda.addEventListener('change', function () {
      $('m-f-custom-wrap').hidden = el.banda.value !== 'custom';
      prekresli();
    });
    el.fcustom.addEventListener('input', prekresli);
    [el.vykon, el.antena, el.antenaRx, el.vyska, el.vyskaRx, el.citlivost, el.extra]
      .forEach(function (i) { i.addEventListener('input', prekresli); });
    el.teren.addEventListener('change', function () {
      $('m-teren-note').textContent = teren(el.teren.value).note;
      prekresli();
    });

    el.profilSmer.addEventListener('change', function () {
      if (stav.vysledky) vypisProfilPaprsku(nactiCfg(), stav.vysledky);
    });

    // Shift + klik = jen posunout řez terénu, stanoviště zůstává
    mapa.on('click', function (e) {
      if (!e.originalEvent || !e.originalEvent.shiftKey) return;
      if (stav.lat === null) return;
      var phi = stav.lat * Math.PI / 180;
      var dx = (e.latlng.lng - stav.lon) * Math.cos(phi);
      var dy = e.latlng.lat - stav.lat;
      var az = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
      el.profilSmer.value = String(Math.round(az / AZ_STUPEN) * AZ_STUPEN % 360);
      if (stav.vysledky) vypisProfilPaprsku(nactiCfg(), stav.vysledky);
    });

    document.querySelectorAll('[data-map-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        nastavStanoviste(parseFloat(btn.dataset.lat), parseFloat(btn.dataset.lon));
        document.querySelectorAll('[data-map-preset]').forEach(function (c) { c.classList.remove('is-active'); });
        btn.classList.add('is-active');
      });
    });

    $('mapa-znovu').addEventListener('click', function () {
      if (stav.lat !== null) nastavStanoviste(stav.lat, stav.lon);
    });

    $('mapa-nastavit').addEventListener('click', function () {
      if (navigator.geolocation) {
        nastavBusy(true, 'Hledám pozici…');
        navigator.geolocation.getCurrentPosition(function (p) {
          nastavBusy(false, '');
          mapa.setView([p.coords.latitude, p.coords.longitude], 12);
          nastavStanoviste(p.coords.latitude, p.coords.longitude);
        }, function (err) {
          nastavBusy(false, '');
          $('m-stav-texto').textContent = 'Pozici nepodařilo zjistit: ' + err.message;
        }, { enableHighAccuracy: true, timeout: 10000 });
      } else {
        $('m-stav-texto').textContent = 'Tvoje prohlížeč nepodporuje určení pozice.';
      }
    });

    // výškové posuvníky
    function vazatVysku(input, hodnota) {
      if (!input || !hodnota) return;
      var f = function () { hodnota.textContent = fmt(parseFloat(input.value), 1) + ' m'; };
      input.addEventListener('input', f);
      f();
    }
    vazatVysku(el.vyska, $('m-vyska-val'));
    vazatVysku(el.vyskaRx, $('m-vyska-rx-val'));
    function vazatExtra() { $('m-extra-val').textContent = el.extra.value + ' dB'; }
    el.extra.addEventListener('input', vazatExtra);

    $('m-teren-note').textContent = teren(el.teren.value).note;
    vazatExtra();

    window.addEventListener('resize', function () {
      if (mapa) mapa.invalidateSize();
    });
  }

  /* --------------------------------------------------------------- veřejné API --- */

  window.radiocomMapa = {
    nactiProfily: nactiProfily,
    vyhodnot: vyhodnot,
    nactiCfg: nactiCfg,
    stav: function () { return stav; },
    vyskyPro: vyskyPro,
    difrakceProfilu: difrakceProfilu,
    nuzKnifeEdge: nuzKnifeEdge,
    VZDALENOSTI: VZDALENOSTI,
    AZ_STUPEN: AZ_STUPEN,
    posun: posun
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();