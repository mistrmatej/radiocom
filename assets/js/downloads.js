(function () {
  'use strict';

  var data = window.RADIOCOM_DOWNLOADS;
  var list = document.querySelector('[data-release-list]');
  if (!data || !list) return;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1).replace('.', ',') + ' kB';
  }

  function createRow(file) {
    var row = document.createElement('tr');
    row.innerHTML = '<td><strong></strong><small class="file-description"></small></td><td><span class="file-type"></span></td><td></td><td><a class="download-link" download>Stáhnout</a></td>';
    row.querySelector('strong').textContent = file.name;
    row.querySelector('.file-description').textContent = file.description || '';
    row.querySelector('.file-type').textContent = file.extension;
    row.querySelector('td:nth-child(3)').textContent = formatSize(file.size);
    var link = row.querySelector('a');
    link.href = file.path;
    link.title = 'Stáhnout ' + file.name;
    return row;
  }

  list.querySelectorAll('[data-radio-id]').forEach(function (card) {
    var radio = data.find(function (item) { return item.id === card.dataset.radioId; });
    if (!radio) return;
    card.querySelector('[data-release-count]').textContent = radio.files.length + (radio.files.length === 1 ? ' soubor' : ' souborů');
    var note = card.querySelector('[data-release-note]');
    if (note) {
      note.textContent = radio.notes || '';
    }
    var body = card.querySelector('[data-release-files]');
    body.innerHTML = '';
    if (!radio.files.length) {
      var empty = document.createElement('tr');
      empty.innerHTML = '<td colspan="4" class="release-empty">Zatím nejsou k dispozici žádné soubory.</td>';
      body.appendChild(empty);
      return;
    }
    radio.files.forEach(function (file) {
      body.appendChild(createRow(file));
    });
  });
})();
