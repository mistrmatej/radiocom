(function () {
  'use strict';

  var lock = document.querySelector('[data-team-lock]');
  if (lock) {
    var form = lock.querySelector('form');
    var input = lock.querySelector('input');
    var error = lock.querySelector('.lock-error');
    var content = document.querySelector('[data-team-content]');
    if (sessionStorage.getItem('radiocom-team-unlocked') === 'true') {
      lock.hidden = true;
      content.hidden = false;
    }
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (input.value === '2468') {
        sessionStorage.setItem('radiocom-team-unlocked', 'true');
        lock.hidden = true;
        content.hidden = false;
      } else {
        error.textContent = 'Nesprávný PIN.';
        input.select();
      }
    });
  }

  var training = document.querySelector('[data-training]');
  if (!training) return;
  var lessons = {
    quick: {
      name: 'Rychlokurz',
      scenarios: [
        {
          type: 'Volání',
          question: 'Co řeknete jako první, když chcete někoho zavolat?',
          options: ['„Haló, slyšíme se?“', '„Příjem pro [jméno], tady [vaše jméno].“', 'Začnete rovnou dlouhým vysvětlením.'],
          answer: 1,
          feedback: 'Nejdřív řekněte, koho voláte, a potom kdo volá.'
        },
        {
          type: 'Potvrzení',
          question: 'Jak nejlépe potvrdíte, že jste zprávu slyšeli?',
          options: ['„Rozumím.“ a zopakujete důležitou část.', 'Nic neřeknete.', '„Jo, asi.“'],
          answer: 0,
          feedback: 'Krátké potvrzení a zopakování místa nebo času zabrání nedorozumění.'
        },
        {
          type: 'Předání zprávy',
          question: 'Co patří do stručného předání zprávy?',
          options: ['Kdo, kde, co se stalo a co je potřeba.', 'Pouze vaše jméno.', 'Dlouhý příběh bez místa a času.'],
          answer: 0,
          feedback: 'Držte se pořadí: kdo, kde, co se stalo a jaká pomoc je potřeba.'
        },
        {
          type: 'SOS',
          question: 'Co uděláte při ohrožení života nebo zdraví?',
          options: ['Použijete jen rádio.', 'Voláte 112 a současně informujete skupinu.', 'Počkáte, až se někdo ozve.'],
          answer: 1,
          feedback: 'Rádio informuje skupinu. Záchranné složky volejte na 112, pokud je to možné.'
        },
        {
          type: 'Kanál',
          question: 'Co uděláte, když na domluveném kanálu někdo mluví?',
          options: ['Začnete mluvit přes něj.', 'Počkáte, až domluví, nebo použijete domluvený záložní kanál.', 'Přeladíte všechna rádia bez domluvy.'],
          answer: 1,
          feedback: 'Nejdřív poslouchejte. Záložní kanál použijte jen podle předchozí domluvy.'
        },
        {
          type: 'Dosah',
          question: 'Co zkusíte, když vás druhý neslyší?',
          options: ['Zvýšíte hlas na maximum.', 'Zkontrolujete kanál, ustoupíte od překážky a zkusíte spojení znovu.', 'Mluvíte rychleji.'],
          answer: 1,
          feedback: 'Nejprve ověřte nastavení a polohu. Hlasitější mluvení špatný signál nevyřeší.'
        },
        {
          type: 'Stručnost',
          question: 'Jak má vypadat běžná zpráva přes rádio?',
          options: ['Krátce, klidně a s nejdůležitějšími údaji.', 'Co nejdelší, aby nic nechybělo.', 'Jen jedním slovem bez kontextu.'],
          answer: 0,
          feedback: 'Krátká a srozumitelná zpráva nechává kanál volný pro ostatní.'
        }
      ]
    },
    calling: {
      name: 'Základy volání',
      scenarios: [
        {
          type: 'Začátek hovoru',
          question: 'Jak začnete volání?',
          options: ['„Příjem pro [jméno], tady [vaše jméno].“', '„Haló?“', 'Začnete mluvit bez oslovení.'],
          answer: 0,
          feedback: 'Nejdřív oslovte konkrétní osobu a představte se.'
        },
        {
          type: 'Ukončení',
          question: 'Co řeknete na konci běžného hovoru?',
          options: ['Nic, prostě přestanete vysílat.', '„Rozumím, končím.“', 'Zopakujete celou konverzaci.'],
          answer: 1,
          feedback: 'Jasné ukončení dá ostatním vědět, že je kanál volný.'
        },
        {
          type: 'Čekání',
          question: 'Co uděláte, když volaný hned neodpoví?',
          options: ['Volání několikrát zopakujete bez pauzy.', 'Počkáte několik sekund a volání zopakujete.', 'Přestanete poslouchat.'],
          answer: 1,
          feedback: 'Nechte druhému čas zareagovat. Opakované vysílání bez pauzy zbytečně blokuje kanál.'
        },
        {
          type: 'Přepnutí',
          question: 'Jak navrhnete přejít na jiný kanál?',
          options: ['„Přejdeme na kanál [číslo], potvrď.“', 'Přeladíte se bez oznámení.', 'Řeknete jen „jinam“.'],
          answer: 0,
          feedback: 'Uveďte přesný kanál a počkejte na potvrzení, aby se všichni správně přeladili.'
        },
        {
          type: 'Rádiová kázeň',
          question: 'Kdy je vhodné vysílat?',
          options: ['Kdykoli vás něco napadne.', 'Až když je kanál volný a máte připravenou stručnou zprávu.', 'Jen když někdo jiný mluví.'],
          answer: 1,
          feedback: 'Před vysíláním chvíli poslouchejte a promyslete si, co potřebujete říct.'
        }
      ]
    },
    message: {
      name: 'Předávání zpráv',
      scenarios: [
        {
          type: 'Obsah zprávy',
          question: 'Co by měla obsahovat důležitá zpráva?',
          options: ['Kdo, kde, co se stalo a co je potřeba.', 'Jen dlouhý popis situace.', 'Pouze své jméno.'],
          answer: 0,
          feedback: 'Držte se pořadí: kdo, kde, co se stalo a jaká pomoc je potřeba.'
        },
        {
          type: 'Potvrzení',
          question: 'Jak ověříte, že druhý zprávu správně pochopil?',
          options: ['Zeptáte se „Slyšel jsi mě?“ a pokračujete.', 'Požádáte o zopakování důležitého místa nebo času.', 'Necháte to bez potvrzení.'],
          answer: 1,
          feedback: 'Zopakování klíčových údajů odhalí chybu dříve, než způsobí problém.'
        },
        {
          type: 'Pořadí',
          question: 'V jakém pořadí je nejlepší předat informace?',
          options: ['Místo, situace, osoba a potřebná pomoc.', 'Nejdřív podrobnosti a až nakonec místo.', 'Náhodně podle toho, co vás napadne.'],
          answer: 0,
          feedback: 'Začněte místem, potom popište situaci, koho se týká a co je potřeba.'
        },
        {
          type: 'Čísla',
          question: 'Jak předáte důležité číslo nebo čas?',
          options: ['Řeknete ho rychle jednou.', 'Řeknete ho pomalu a necháte ho zopakovat.', 'Nahradíte ho přibližným údajem.'],
          answer: 1,
          feedback: 'Čísla, časy a kanály vždy vyslovte pomalu a nechte druhého potvrdit jejich správnost.'
        },
        {
          type: 'Oprava',
          question: 'Co řeknete, když se při předávání spletete?',
          options: ['„Oprava“ a zopakujete správný údaj.', 'Budete pokračovat, aby si toho nikdo nevšiml.', 'Ukončíte rádio bez vysvětlení.'],
          answer: 0,
          feedback: 'Slovo „oprava“ jasně upozorní ostatní, že předchozí údaj už neplatí.'
        }
      ]
    },
    sos: {
      name: 'Nouzová komunikace',
      scenarios: [
        {
          type: 'První krok',
          question: 'Co uděláte při ohrožení života nebo zdraví?',
          options: ['Použijete jen rádio.', 'Voláte 112 a současně informujete skupinu.', 'Počkáte, až se někdo ozve.'],
          answer: 1,
          feedback: 'Rádio informuje skupinu. Záchranné složky volejte na 112, pokud je to možné.'
        },
        {
          type: 'Hlášení',
          question: 'Co je při nouzovém hlášení nejdůležitější?',
          options: ['Mluvit co nejdéle.', 'Říct klidně místo, co se stalo a jaká pomoc je potřeba.', 'Použít co nejvíce odborných slov.'],
          answer: 1,
          feedback: 'Stručné a přesné údaje pomohou skupině i záchranným složkám jednat.'
        },
        {
          type: 'Priorita',
          question: 'Jak začnete naléhavé vysílání přes rádio?',
          options: ['„Nouze, nouze, nouze“ a potom stručně popíšete situaci.', 'Začnete běžným pozdravem.', 'Počkáte, až se někdo zeptá.'],
          answer: 0,
          feedback: 'Jasné označení naléhavosti upozorní ostatní, aby přestali s běžným provozem.'
        },
        {
          type: 'Místo',
          question: 'Jak popíšete místo události?',
          options: ['„Někde tady u lesa.“', 'Uvedete přesné místo, orientační bod nebo souřadnice, pokud je znáte.', 'Místo popíšete až po příjezdu pomoci.'],
          answer: 1,
          feedback: 'Přesné místo je pro pomoc klíčové. Použijte název místa, bod v terénu nebo souřadnice.'
        },
        {
          type: 'Bezpečí',
          question: 'Co uděláte po nouzovém hlášení?',
          options: ['Necháte rádio zapnuté a čekáte na další pokyny.', 'Vypnete rádio a odejdete bez informování ostatních.', 'Začnete vysílat běžné zprávy.'],
          answer: 0,
          feedback: 'Zůstaňte dostupní pro další pokyny a uvolněte kanál pro další nouzové informace.'
        }
      ]
    }
  };
  var lessonList = document.querySelector('[data-lesson-list]');
  var scenarios;
  var activeLesson;
  var index = 0;
  var score = 0;
  var lessonName = training.querySelector('[data-training-lesson-name]');
  var title = training.querySelector('[data-training-title]');
  var messages = training.querySelector('[data-training-messages]');
  var options = training.querySelector('[data-training-options]');
  var feedback = training.querySelector('[data-training-feedback]');
  var count = training.querySelector('[data-training-count]');
  var progress = training.querySelector('[data-training-progress]');
  var next = training.querySelector('[data-training-next]');
  var back = training.querySelector('[data-training-back]');

  function render() {
    var current = scenarios[index];
    title.textContent = current.type;
    count.textContent = (index + 1) + ' / ' + scenarios.length;
    progress.style.transform = 'scaleX(' + ((index + 1) / scenarios.length) + ')';
    feedback.textContent = '';
    next.hidden = true;
    messages.innerHTML = '';
    var incoming = document.createElement('div');
    incoming.className = 'chat-message chat-message-incoming';
    incoming.innerHTML = '<span class="chat-author">Radiokom</span><p></p>';
    incoming.querySelector('p').textContent = current.question;
    messages.appendChild(incoming);
    options.innerHTML = '';
    current.options.forEach(function (text, optionIndex) {
      var button = document.createElement('button');
      button.className = 'training-option';
      button.type = 'button';
      button.textContent = text;
      button.addEventListener('click', function () {
        options.querySelectorAll('button').forEach(function (item) { item.disabled = true; });
        button.classList.add(optionIndex === current.answer ? 'is-correct' : 'is-wrong');
        var outgoing = document.createElement('div');
        outgoing.className = 'chat-message chat-message-outgoing';
        outgoing.innerHTML = '<span class="chat-author">Vy</span><p></p>';
        outgoing.querySelector('p').textContent = text;
        messages.appendChild(outgoing);
        if (optionIndex === current.answer) score++;
        feedback.textContent = optionIndex === current.answer ? 'Správně. ' + current.feedback : 'Zkuste to znovu v dalším scénáři. ' + current.feedback;
        var response = document.createElement('div');
        response.className = 'chat-message chat-message-response ' + (optionIndex === current.answer ? 'is-correct' : 'is-wrong');
        response.innerHTML = '<span class="chat-author">Trenér</span><p></p>';
        response.querySelector('p').textContent = optionIndex === current.answer ? 'Správně. ' + current.feedback : 'Ještě ne. ' + current.feedback;
        messages.appendChild(response);
        next.hidden = false;
      });
      options.appendChild(button);
    });
  }
  function showLesson(key) {
    activeLesson = lessons[key];
    scenarios = activeLesson.scenarios;
    index = 0;
    score = 0;
    lessonName.textContent = activeLesson.name;
    lessonList.hidden = true;
    training.hidden = false;
    render();
  }
  lessonList.querySelectorAll('[data-lesson]').forEach(function (button) {
    button.addEventListener('click', function () {
      showLesson(button.dataset.lesson);
    });
  });
  back.addEventListener('click', function () {
    training.hidden = true;
    lessonList.hidden = false;
  });
  next.addEventListener('click', function () {
    if (index < scenarios.length - 1) {
      index++;
      render();
    } else {
      title.textContent = 'Hotovo';
      messages.innerHTML = '';
      var result = document.createElement('div');
      result.className = 'chat-message chat-message-response is-correct';
      result.innerHTML = '<span class="chat-author">Trenér</span><p></p>';
      result.querySelector('p').textContent = 'Lekce dokončena. Výsledek: ' + score + ' / ' + scenarios.length + '.';
      messages.appendChild(result);
      options.innerHTML = '';
      feedback.textContent = score === scenarios.length ? 'Všechny odpovědi správně.' : 'Projít si scénáře znovu může pomoct před akcí.';
      next.hidden = true;
      progress.style.transform = 'scaleX(1)';
    }
  });
})();
