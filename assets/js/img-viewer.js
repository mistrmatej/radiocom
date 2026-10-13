(function () {
  'use strict';

  var input = document.querySelector('[data-img-input]');
  var dropzone = document.querySelector('[data-img-dropzone]');
  var status = document.querySelector('[data-img-status]');
  var result = document.querySelector('[data-img-result]');
  var title = document.querySelector('[data-img-title]');
  var meta = document.querySelector('[data-img-meta]');
  var body = document.querySelector('[data-img-rows]');
  if (!input || !dropzone || !result) return;

  function formatFrequency(value) {
    return (value / 1000000).toFixed(6).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',') + ' MHz';
  }

  function readFrequency(view, offset) {
    var value = view.getUint32(offset, true);
    return value >= 130000000 && value <= 500000000 ? value : null;
  }

  function decode(buffer) {
    var view = new DataView(buffer);
    var frequencies = [];
    for (var offset = 0; offset + 4 <= view.byteLength; offset += 4) {
      var value = readFrequency(view, offset);
      if (value && frequencies.indexOf(value) === -1) frequencies.push(value);
    }
    return frequencies;
  }

  function render(file) {
    status.textContent = 'Načítám ' + file.name + '…';
    var reader = new FileReader();
    reader.addEventListener('load', function () {
      var frequencies = decode(reader.result);
      title.textContent = file.name;
      meta.textContent = file.size.toLocaleString('cs-CZ') + ' B · nalezeno ' + frequencies.length + ' frekvencí';
      body.innerHTML = '';
      if (!frequencies.length) {
        body.innerHTML = '<tr><td colspan="3">V tomto obrazu se nepodařilo najít známý formát frekvencí.</td></tr>';
      } else {
        frequencies.forEach(function (frequency, index) {
          var row = document.createElement('tr');
          row.innerHTML = '<td></td><td></td><td></td>';
          row.children[0].textContent = index + 1;
          row.children[1].textContent = formatFrequency(frequency);
          row.children[2].textContent = '0x' + frequency.toString(16).toUpperCase();
          body.appendChild(row);
        });
      }
      result.hidden = false;
      status.textContent = 'Hotovo. Zobrazené hodnoty jsou dekódované frekvence; ostatní parametry obrazu mohou být proprietární.';
    });
    reader.addEventListener('error', function () {
      status.textContent = 'Soubor se nepodařilo načíst.';
    });
    reader.readAsArrayBuffer(file);
  }

  function renderUrl(path) {
    var url = new URL(path, window.location.href);
    if (url.origin !== window.location.origin) {
      status.textContent = 'Soubor musí být načtený ze stejného webu.';
      return;
    }
    status.textContent = 'Načítám soubor ze serveru…';
    fetch(url).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.blob();
    }).then(function (blob) {
      render(new File([blob], url.pathname.split('/').pop() || 'obraz.img', { type: 'application/octet-stream' }));
    }).catch(function () {
      status.textContent = 'Soubor se nepodařilo načíst. Použijte výběr souboru z disku.';
    });
  }

  input.addEventListener('change', function () {
    if (input.files[0]) render(input.files[0]);
  });
  dropzone.addEventListener('dragover', function (event) {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragleave', function () {
    dropzone.classList.remove('is-dragover');
  });
  dropzone.addEventListener('drop', function (event) {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    if (event.dataTransfer.files[0]) render(event.dataTransfer.files[0]);
  });
  var fileUrl = new URLSearchParams(window.location.search).get('file');
  if (fileUrl) renderUrl(fileUrl);
})();
