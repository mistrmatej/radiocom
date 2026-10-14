(function () {
  'use strict';

  var slider = document.getElementById('channel-tuning');
  var value = document.getElementById('channel-value');
  var message = document.getElementById('radio-message');
  var displayNoise = document.querySelector('.radio-display-noise');
  var pttButton = document.getElementById('ptt-button');
  var pttResponse = document.getElementById('ptt-response');
  var connection = document.getElementById('connection');
  var target = 612;
  var messages = [
    'Jste mimo dosah. Signál se tváří, že nikdy neexistoval.',
    'Vybitá baterie na druhé straně. Technik tvrdí, že to není jeho vina.',
    'Zapomněli jsme squelch. Slyšíme jen šum a velmi sebevědomé praskání.',
    'Stránka asi vypnula rádio a šla na oběd.',
    'Volaná stránka právě projíždí tunelem. Zkuste to po výjezdu.'
  ];
  var replies = [
    'Nikdo neodpovídá. Pravděpodobně drží vysílačku opačně.',
    'Příjem slabý. Zkuste mluvit blíž k internetu.',
    'Ozvalo se jen šumění. Zní to jako velmi malá bouřka.',
    'Ticho na kanálu. Buď je prázdný, nebo všichni poslouchají.'
  ];

  if (!slider || !value || !message || !displayNoise || !connection || !pttButton || !pttResponse) return;

  message.textContent = messages[Math.floor(Math.random() * messages.length)];
  connection.hidden = false;

  function tune() {
    var current = Number(slider.value);
    var distance = Math.abs(current - target);
    var noise = Math.min(0.68, distance / 500);
    value.textContent = current + ' / 800';
    displayNoise.style.opacity = String(noise);
    if (distance <= 8) {
      connection.dataset.connected = 'true';
      message.textContent = 'Spojení navázáno. Zázrak potvrzen, kanál odpovídá.';
    } else {
      connection.dataset.connected = 'false';
    }
  }

  slider.addEventListener('input', tune);
  pttButton.addEventListener('click', function () {
    pttResponse.textContent = replies[Math.floor(Math.random() * replies.length)];
  });
  tune();
})();
