(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* toast */
  let toastTimer;
  function showToast(title, msg) {
    $('#toastTitle').textContent = title;
    $('#toastMsg').textContent = msg;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4000);
  }

  $('.announce-close').addEventListener('click', () => $('#announce').classList.add('hide'));
  $('#year').textContent = new Date().getFullYear();

  /* navbar + scrollspy */
  const nav = $('#nav');
  const links = $$('.nav-menu a[href^="#"]:not(.btn)');
  const sections = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  function onScroll() {
    nav.classList.toggle('scrolled', scrollY > 10);
    const y = scrollY + 140;
    let current = null;
    sections.forEach(s => { if (s.offsetTop <= y) current = s.id; });
    links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current));
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('#burger'), menu = $('#navMenu');
  function setMenu(open) {
    menu.classList.toggle('open', open);
    burger.classList.toggle('active', open);
    burger.setAttribute('aria-expanded', open);
  }
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));

  /* ---------- booking flow ---------- */
  const form = $('#bookingForm');
  const f = form.elements;
  const TIMES = {
    morning: 'Morning (9:00-12:00)',
    afternoon: 'Afternoon (13:30-16:30)',
    full: 'Full day (9:00-16:30)',
    flex: 'Private - flexible time (see special requirements)'
  };
  let step = 1;
  const total = 4;

  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  f.date.min = todayStr;

  const level = () => ($('input[name="level"]:checked') || {}).value || '';

  function fillTimes() {
    const type = f.lesson_type.value;
    const opts = type === 'Mountain Kids Program' ? ['full']
      : type === 'Private lesson' ? ['morning', 'afternoon', 'full', 'flex']
      : ['morning', 'afternoon', 'full'];
    const prev = f.time.value;
    f.time.innerHTML = opts.map(k => `<option>${TIMES[k]}</option>`).join('');
    if (opts.some(k => TIMES[k] === prev)) f.time.value = prev;
  }

  function hint1() {
    const t = f.lesson_type.value;
    $('#step1Hint').textContent =
      t === 'Group lesson' ? 'Groups are organised by ability, with a maximum of 6 guests.' :
      t === 'Private lesson' ? 'Private lessons start at 1 hour, with flexible scheduling. Good for families with mixed abilities.' :
      t === 'Mountain Kids Program' ? 'For ages 5 to 12. Full day with lunch supervision included.' : '';
  }

  function buildParticipants() {
    const n = +f.guests.value;
    const box = $('#participants');
    const old = $$('.person-row', box).map(r => $$('input', r).map(i => i.value));
    box.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const row = document.createElement('div');
      row.className = 'person-row';
      row.innerHTML = `<input type="text" placeholder="Guest ${i + 1} full name" aria-label="Guest ${i + 1} full name" required>
        <input type="number" min="3" max="99" placeholder="Age" aria-label="Guest ${i + 1} age">`;
      if (old[i]) { const [a, b] = $$('input', row); a.value = old[i][0]; b.value = old[i][1]; }
      box.appendChild(row);
    }
  }

  f.lesson_type.addEventListener('change', () => { fillTimes(); hint1(); });
  f.guests.addEventListener('change', buildParticipants);
  fillTimes(); buildParticipants();

  // lesson rows preselect the type
  $$('[data-pick]').forEach(b => b.addEventListener('click', () => {
    f.lesson_type.value = b.dataset.pick; fillTimes(); hint1();
  }));

  // trail map runs preselect the level
  $$('.run-link').forEach(a => a.addEventListener('click', () => {
    const r = $(`input[name="level"][value="${a.dataset.level}"]`);
    if (r) { r.checked = true; $('#levelPick').closest('.field').classList.remove('invalid-group'); }
    go(1);
  }));

  function participants() {
    return $$('.person-row').map(r => {
      const [n, a] = $$('input', r);
      const name = n.value.trim(), age = a.value.trim();
      return { name, age, label: name && age && +age <= 12 ? `${name} (${age})` : name };
    });
  }

  function estimate(type, time, ppl) {
    if (type === 'Group lesson') {
      const sessions = time.startsWith('Full') ? 2 : 1;
      const sum = ppl.reduce((t, p) => t + (p.age && +p.age <= 12 ? 60 : 65), 0) * sessions;
      return `Estimated lesson cost: $${sum} for ${sessions === 2 ? 'two half-day sessions' : 'one half-day session'}. Ski passes are extra.`;
    }
    if (type === 'Mountain Kids Program') return `Estimated cost: $${99 * ppl.length} at $99 per child per day. Ski passes are extra.`;
    const n = ppl.length;
    const rate = n <= 2 ? 140 : n <= 4 ? 175 : 210;
    return `Private rate for ${n} guest${n > 1 ? 's' : ''}: $${rate} per hour, 1 hour minimum. Ski passes are extra.`;
  }

  function record() {
    const ppl = participants();
    const cells = Array.from({ length: 6 }, (_, i) => (ppl[i] ? ppl[i].label : ''));
    const special = [f.special.value.trim(), f.instructor.value ? `Instructor preference: ${f.instructor.value}` : ''].filter(Boolean).join(' | ') || 'None';
    return {
      ppl,
      row: [f.lesson_type.value, f.activity.value, level(), f.time.value, f.date.value, String(ppl.length), ...cells, f.email.value.trim(), special]
    };
  }

  function validate(s) {
    const bad = el => { el.classList.add('invalid'); return false; };
    const pane = $(`.step[data-step="${s}"]`);
    $$('.invalid', pane).forEach(x => x.classList.remove('invalid'));
    $$('.invalid-group', pane).forEach(x => x.classList.remove('invalid-group'));
    let ok = true, msg = 'Fill in the highlighted fields to continue.';
    if (s === 1) {
      if (!f.lesson_type.value) ok = bad(f.lesson_type);
      if (!level()) { ok = false; $('#levelPick').closest('.field').classList.add('invalid-group'); msg = 'Choose a lesson type and a level to continue.'; }
    }
    if (s === 2 && (!f.date.value || f.date.value < todayStr)) { ok = bad(f.date); msg = 'Choose a date from today onward.'; }
    if (s === 3) {
      const isKids = f.lesson_type.value === 'Mountain Kids Program';
      $$('.person-row').forEach(r => {
        const [n, a] = $$('input', r);
        if (!n.value.trim()) ok = bad(n);
        if (isKids && !(+a.value >= 5 && +a.value <= 12)) { ok = bad(a); msg = 'The Mountain Kids Program is for ages 5 to 12. Add each child\'s age.'; }
        if (f.lesson_type.value === 'Group lesson' && a.value && +a.value < 5) { ok = bad(a); msg = 'Group lessons are for ages 5 and up.'; }
      });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) ok = bad(f.email);
    }
    $('#formError').textContent = ok ? '' : msg;
    return ok;
  }

  function renderReview() {
    const r = record();
    const rows = [
      ['Lesson', r.row[0]], ['Activity', r.row[1]], ['Level', r.row[2]], ['Time', r.row[3]],
      ['Date', r.row[4]], ['Guests', r.ppl.map(p => p.label).join(', ')], ['Email', r.row[12]], ['Notes', r.row[13]]
    ];
    const dl = $('#review');
    dl.innerHTML = '';
    rows.forEach(([k, v]) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = k; dd.textContent = v;
      dl.append(dt, dd);
    });
    $('#estimate').textContent = estimate(r.row[0], r.row[3], r.ppl);
    $('#record').textContent = JSON.stringify(r.row, null, 1);
  }

  function go(n) {
    step = n;
    $$('.step').forEach(s => s.classList.toggle('show', +s.dataset.step === n));
    $$('#steps li').forEach((li, i) => li.classList.toggle('on', i < n));
    $('#prevBtn').style.visibility = n === 1 ? 'hidden' : 'visible';
    $('#nextBtn').textContent = n === total ? 'Send request' : 'Continue';
    $('#formError').textContent = '';
    if (n === total) renderReview();
  }

  $('#prevBtn').addEventListener('click', () => step > 1 && go(step - 1));
  $('#nextBtn').addEventListener('click', () => {
    if (!validate(step)) return;
    if (step < total) return go(step + 1);
    const r = record();
    try {
      const all = JSON.parse(localStorage.getItem('torti_requests') || '[]');
      all.push(r.row);
      localStorage.setItem('torti_requests', JSON.stringify(all));
    } catch (e) { /* storage unavailable */ }
    console.log('Reservation record', r.row);
    $('#succName').textContent = r.ppl[0].name.split(' ')[0];
    form.hidden = true;
    $('#success').hidden = false;
    showToast('Request sent', 'Check your email within 2 hours for confirmation.');
  });
  $('#againBtn').addEventListener('click', () => {
    form.reset(); fillTimes(); buildParticipants(); hint1();
    $('#success').hidden = true; form.hidden = false; go(1);
  });
  go(1);

  /* newsletter */
  $('#newsForm').addEventListener('submit', e => {
    e.preventDefault();
    const i = $('input', e.target);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.value.trim())) { i.classList.add('invalid'); return showToast('Check your email', 'Enter an address like you@example.com.'); }
    i.classList.remove('invalid');
    showToast('Subscribed', 'You\'ll get resort news by email.');
    e.target.reset();
  });
})();
