/* H2O–8 — on-device water log. No accounts, no network, no analytics. */
(function () {
  'use strict';

  var KEY = 'h2o8.v1';
  var DEF = {
    goal: 8, cupMl: 250, dayStart: 4, sound: false, smart: true,
    log: {},                       // { 'YYYY-MM-DD': ['06:40', ...] }
    reminders: [
      { t: '07:00', label: 'on waking', on: true },
      { t: '10:00', label: 'mid-morning', on: true },
      { t: '12:30', label: 'with lunch', on: true },
      { t: '15:00', label: 'afternoon', on: true },
      { t: '18:00', label: 'evening', on: false }
    ]
  };

  var S = load();
  var view = { tab: 'today', weekStart: mondayOf(logicalDate(new Date())), sheet: null, toast: null, editing: null, editingRem: null };
  var toastTimer = null, holdTimer = null, held = false;

  // ── storage ──
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEF));
      var s = JSON.parse(raw);
      for (var k in DEF) if (!(k in s)) s[k] = DEF[k];
      return s;
    } catch (e) { return JSON.parse(JSON.stringify(DEF)); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  // ── dates ──
  function pad(n) { return String(n).padStart(2, '0'); }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function logicalDate(now) {            // a cup before dayStart belongs to yesterday
    var d = new Date(now.getTime());
    if (d.getHours() < S.dayStart) d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  function mondayOf(d) {
    var x = new Date(d.getTime());
    var wd = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - wd); x.setHours(12, 0, 0, 0);
    return x;
  }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  var MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  var DAYL = ['M','T','W','T','F','S','S'];
  var DAYN = ['MON','TUE','WED','THU','FRI','SAT','SUN'];
  function nowHM() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function minutes(t) { return parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3), 10); }

  // ── model ──
  function cupsOn(d) { return (S.log[key(d)] || []).length; }
  function litres(n) { return ((n * S.cupMl) / 1000).toFixed(2); }
  function today() { return logicalDate(new Date()); }
  function isToday(d) { return key(d) === key(today()); }
  function isFuture(d) { return d.getTime() > today().getTime(); }
  function firstLoggedDate() {
    var ks = Object.keys(S.log).filter(function (k) { return S.log[k].length; }).sort();
    return ks.length ? new Date(ks[0] + 'T12:00:00') : today();
  }

  function addCup() {
    if (held) { held = false; return; }
    var k = key(today());
    S.log[k] = (S.log[k] || []).concat([nowHM()]);
    save();
    var n = S.log[k].length;
    if (n === S.goal) toast('GOAL · ' + litres(n) + ' L · nice one');
    else if (n > S.goal) toast('CUP ' + pad(n) + ' · BONUS');
    else toast('CUP ' + pad(n) + ' LOGGED');
    if (S.sound) beep();
    render();
  }
  function undo() {
    var k = key(today());
    if (!S.log[k] || !S.log[k].length) return;
    S.log[k] = S.log[k].slice(0, -1);
    save(); toast('LAST CUP REMOVED'); render();
  }
  function setCupTime(k, i, t) {
    if (!S.log[k] || !t) return;
    S.log[k][i] = t;
    S.log[k].sort(function (a, b) { return minutes(a) - minutes(b); });
    var at = S.log[k].indexOf(t);
    if (view.editing && view.editing.k === k) view.editing.i = at < 0 ? i : at;
    save(); render();
  }
  function deleteCup(k, i) {
    if (!S.log[k]) return;
    var t = S.log[k][i];
    S.log[k] = S.log[k].slice(0, i).concat(S.log[k].slice(i + 1));
    view.editing = null;
    save(); toast('CUP AT ' + t + ' REMOVED'); render();
  }

  // ── time stepper, built from the system's own parts (no native picker) ──
  function stepBtn(glyph, fn) {
    var b = el('button', { style: 'width:30px;height:32px;flex:none;background:none;border:1px solid var(--line-2);' +
      'border-radius:2px;font:400 15px/1 var(--mono);color:var(--ink-1)' }, glyph);
    b.onclick = function (e) { e.stopPropagation(); fn(); };
    return b;
  }
  function timeStepper(t, onChange) {
    var h = parseInt(t.slice(0, 2), 10), m = parseInt(t.slice(3), 10);
    function emit(nh, nm) {
      var tot = (((nh * 60 + nm) % 1440) + 1440) % 1440;
      onChange(pad(Math.floor(tot / 60)) + ':' + pad(tot % 60));
    }
    var unit = function (val, dec, inc) {
      return el('div', { style: 'display:flex;align-items:center;gap:6px' }, [
        stepBtn('\u2013', dec),
        el('span', { style: 'font:500 19px/1 var(--mono);width:30px;text-align:center' }, pad(val)),
        stepBtn('+', inc)
      ]);
    };
    var now = el('button', { style: 'height:32px;padding:0 12px;background:none;border:1px solid var(--line-2);' +
      'border-radius:2px;font:500 10px/1 var(--mono);letter-spacing:.12em;color:var(--ink-2)' }, 'NOW');
    now.onclick = function (e) { e.stopPropagation(); onChange(nowHM()); };
    return el('div', { style: 'display:flex;align-items:center;gap:10px' }, [
      unit(h, function () { emit(h - 1, m); }, function () { emit(h + 1, m); }),
      el('span', { style: 'font:500 19px/1 var(--mono);color:var(--ink-4)' }, ':'),
      unit(m, function () { emit(h, m - 5); }, function () { emit(h, m + 5); }),
      el('div', { style: 'flex:1' }), now
    ]);
  }

  // inline edit strip shown under a tapped cup row
  function editStrip(k, i) {
    var t = S.log[k][i];
    var del = el('button', { style: 'height:36px;padding:0 16px;background:none;border:1px solid var(--accent);color:var(--accent);border-radius:2px;font:500 11px/1 var(--mono);letter-spacing:.12em' }, 'DELETE');
    del.onclick = function (e) { e.stopPropagation(); deleteCup(k, i); };
    var done = el('button', { style: 'height:36px;padding:0 16px;background:none;border:1px solid var(--line-2);color:var(--ink-2);border-radius:2px;font:500 11px/1 var(--mono);letter-spacing:.12em' }, 'DONE');
    done.onclick = function (e) { e.stopPropagation(); view.editing = null; render(); };
    var strip = el('div', { style: 'background:var(--paper-2);margin:0 -24px;padding:14px 24px 16px;display:flex;flex-direction:column;gap:14px' }, [
      timeStepper(t, function (nt) { setCupTime(k, i, nt); }),
      el('div', { style: 'display:flex;gap:8px;justify-content:flex-end' }, [del, done])
    ]);
    strip.onclick = function (e) { e.stopPropagation(); };
    return strip;
  }

  function cupRow(k, i, times, opts) {
    var editing = view.editing && view.editing.k === k && view.editing.i === i;
    var last = i === times.length - 1;
    var accentDot = opts.markLast ? last : (i + 1 > S.goal);
    var row = el('div.row', { style: editing ? 'background:var(--paper-2);margin:0 -24px;padding:12px 24px' : '' }, [
      el('span', { class: 't' }, times[i]),
      el('span', { class: 'dot', style: accentDot ? 'background:var(--accent)' : '' }),
      el('span', { class: 'note', style: opts.mono ? 'font-family:var(--mono);font-size:13px;color:var(--ink-4)' : '' },
        opts.mono ? 'cup ' + pad(i + 1) : (last ? 'just now' : '')),
      el('span', { class: 'run', style: (opts.markLast && last) ? 'color:var(--ink-1)' : (opts.mono ? 'color:var(--ink-2)' : '') }, litres(i + 1))
    ]);
    row.onclick = function () {
      view.editing = editing ? null : { k: k, i: i };
      render();
    };
    return editing ? el('div', {}, [row, editStrip(k, i)]) : row;
  }

  function toast(msg) {
    view.toast = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { view.toast = null; render(); }, 2200);
  }
  function beep() {
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      var ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 660; g.gain.value = 0.06; o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.07);
    } catch (e) {}
  }

  // ── tiny DOM helper ──
  function el(tag, attrs, kids) {
    var parts = tag.split('.');
    var n = document.createElement(parts[0] || 'div');
    if (parts.length > 1) n.className = parts.slice(1).join(' ');
    attrs = attrs || {};
    for (var a in attrs) {
      if (a === 'style') n.setAttribute('style', attrs[a]);
      else if (a.slice(0, 2) === 'on') n[a.toLowerCase()] = attrs[a];
      else if (attrs[a] === true) n.setAttribute(a, '');
      else if (attrs[a] !== false && attrs[a] != null) n.setAttribute(a, attrs[a]);
    }
    (kids == null ? [] : [].concat(kids)).forEach(function (k) {
      if (k == null || k === false) return;
      n.appendChild(typeof k === 'object' ? k : document.createTextNode(String(k)));
    });
    return n;
  }

  // ── screens ──
  function screenToday() {
    var d = today(), times = S.log[key(d)] || [], n = times.length;
    var wrap = el('div', { style: 'display:flex;flex-direction:column;height:100%;min-height:0' });

    wrap.appendChild(el('div.head', {}, [
      el('span.lbl', {}, 'TODAY · ' + DAYN[(d.getDay() + 6) % 7] + ' ' + pad(d.getDate()) + ' ' + MON[d.getMonth()]),
      el('span.lbl', {}, S.cupMl + ' ML / CUP')
    ]));

    wrap.appendChild(el('div', { style: 'display:flex;align-items:flex-end;gap:10px;margin-top:20px' }, [
      el('div.numeral', {}, pad(n)), el('div.of', {}, '/ ' + pad(S.goal))
    ]));
    wrap.appendChild(el('div.sub', {}, litres(n) + ' L logged · ' + (
      n >= S.goal ? (n > S.goal ? (n - S.goal) + ' cup' + (n - S.goal === 1 ? '' : 's') + ' past goal' : 'goal met')
                  : litres(S.goal - n) + ' L to go')));

    if (n >= S.goal) {
      wrap.appendChild(el('div.banner', {}, [
        el('span', {}, n > S.goal ? 'Past goal. Keep going.' : 'Goal met. ' + litres(S.goal) + ' L.'),
        el('span', { style: 'color:var(--accent)' }, '\u2726')
      ]));
    }

    var segs = el('div.segs');
    for (var i = 0; i < Math.max(S.goal, n); i++) {
      var filled = i < n, bonus = i >= S.goal;
      segs.appendChild(el('div.seg', { style: 'background:' + (filled ? (bonus ? 'var(--accent)' : 'var(--ink-1)') : 'transparent') +
        ';border:1px solid ' + (filled ? (bonus ? 'var(--accent)' : 'var(--ink-1)') : '#bfbcb5') }));
    }
    wrap.appendChild(segs);
    wrap.appendChild(el('div.rule'));
    wrap.appendChild(el('div', { style: 'display:flex;justify-content:space-between;padding:10px 0 4px' }, [
      el('span.lbl-xs', {}, 'LOG'), el('span.lbl-xs', {}, 'RUNNING')
    ]));

    var list = el('div.scroll');
    times.forEach(function (t, i) {
      list.appendChild(cupRow(key(d), i, times, { markLast: true }));
    });
    for (var g = n; g < S.goal; g++) {
      list.appendChild(el('div.row.ghost', {}, [
        el('span', { class: 't' }, pad(g + 1)), el('span', { class: 'dot' }),
        el('span', { class: 'note' }, g + 1 === S.goal ? 'goal' : 'to come'),
        el('span', { class: 'run' }, litres(g + 1))
      ]));
    }
    list.appendChild(el('div', { style: 'height:10px' }));
    wrap.appendChild(list);

    var btn = el('button.action', {}, [el('span', { style: 'font-size:22px;font-weight:400;line-height:1' }, '+'), 'ONE CUP']);
    btn.onclick = addCup;
    var down = function () { held = false; holdTimer = setTimeout(function () { held = true; undo(); }, 550); };
    var up = function () { clearTimeout(holdTimer); };
    btn.addEventListener('touchstart', down, { passive: true });
    btn.addEventListener('touchend', up);
    btn.addEventListener('mousedown', down);
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
    wrap.appendChild(el('div', { style: 'padding:14px 0 12px' }, [btn, el('div.hint', {}, 'HOLD TO UNDO LAST · TAP A CUP TO EDIT')]));
    return wrap;
  }

  function screenDays() {
    var wrap = el('div', { style: 'display:flex;flex-direction:column;height:100%;min-height:0' });
    var ws = view.weekStart, we = addDays(ws, 6);
    var thisWeek = key(ws) === key(mondayOf(today()));
    var label = ws.getMonth() === we.getMonth()
      ? pad(ws.getDate()) + ' – ' + pad(we.getDate()) + ' ' + MON[we.getMonth()]
      : pad(ws.getDate()) + ' ' + MON[ws.getMonth()] + ' – ' + pad(we.getDate()) + ' ' + MON[we.getMonth()];

    // streak
    var streak = 0, cur = today();
    if (cupsOn(cur) < S.goal) cur = addDays(cur, -1);
    while (cupsOn(cur) >= S.goal) { streak++; cur = addDays(cur, -1); }

    wrap.appendChild(el('span.lbl', {}, 'HISTORY'));
    wrap.appendChild(el('div', { style: 'display:flex;align-items:flex-end;gap:10px;margin-top:18px' }, [
      el('div.numeral-sm', {}, pad(streak)), el('div.of', { style: 'padding-bottom:5px;font-size:20px' }, 'day streak')
    ]));

    var back = el('button.sq', {}, '\u2039'); back.onclick = function () { view.weekStart = addDays(ws, -7); render(); };
    var fwd = el('button.sq', { disabled: thisWeek }, '\u203a'); fwd.onclick = function () { view.weekStart = addDays(ws, 7); render(); };
    var oldest = mondayOf(firstLoggedDate());
    back.disabled = ws.getTime() <= oldest.getTime();
    wrap.appendChild(el('div.pager', {}, [back, el('div', { class: 'mid' }, [
      el('div', { class: 'lab' }, label),
      el('div.lbl-xs', { style: 'margin-top:6px' }, thisWeek ? 'THIS WEEK · ' + ws.getFullYear() : String(ws.getFullYear()))
    ]), fwd]));

    var counts = [], maxc = S.goal + 2;
    for (var i = 0; i < 7; i++) { var d = addDays(ws, i); counts.push(isFuture(d) ? null : cupsOn(d)); if (counts[i] > maxc) maxc = counts[i]; }

    var wk = el('div.week');
    counts.forEach(function (c, i) {
      var d = addDays(ws, i), fut = c === null;
      var h = fut ? 2 : Math.max(Math.round(Math.min(c / maxc, 1) * 118), 3);
      var col = el('button.daycol', { disabled: fut }, [
        el('div', { class: 'bars' }, [
          el('span', { class: 'cnt', style: (!fut && c >= S.goal) ? 'color:var(--ink-1)' : '' }, fut ? '\u2013' : String(c)),
          el('div', { class: 'bar', style: 'height:' + h + 'px;background:' + (fut ? 'var(--line-2)' : (c >= S.goal ? 'var(--ink-1)' : 'var(--ink-5)')) })
        ]),
        el('div', { class: 'foot' }, [
          el('div', { class: 'dl' }, DAYL[i]),
          el('div', { class: 'dn', style: isToday(d) ? 'color:var(--accent)' : '' }, pad(d.getDate()))
        ])
      ]);
      if (!fut) col.onclick = function () { view.sheet = key(d); render(); };
      wk.appendChild(col);
    });
    wrap.appendChild(wk);
    wrap.appendChild(el('div', { style: 'font:400 9.5px/1 var(--mono);letter-spacing:.14em;color:var(--ink-4);margin-top:12px;text-align:center' }, 'TAP A DAY FOR ITS 24 HOURS'));

    var logged = counts.filter(function (c) { return c !== null; });
    var total = logged.reduce(function (a, b) { return a + b; }, 0);
    var atGoal = logged.filter(function (c) { return c >= S.goal; }).length;
    var body = el('div.scroll', { style: 'margin-top:22px' });
    body.appendChild(el('div', { style: 'display:flex;justify-content:space-between;padding-bottom:8px' }, [
      el('span.lbl-xs', {}, 'WEEK OF ' + label), el('span.lbl-xs', {}, 'CUPS')
    ]));
    [['Days at goal', atGoal + ' / ' + logged.length],
     ['Total', total + ' · ' + litres(total) + ' L'],
     ['Daily average', logged.length ? (total / logged.length).toFixed(1) : '0.0']]
      .forEach(function (r) {
        body.appendChild(el('div.srow', { style: 'padding:13px 0' }, [
          el('span', { class: 'main' }, r[0]),
          el('span', { class: 'val', style: 'white-space:nowrap;color:var(--ink-1)' }, r[1])
        ]));
      });
    body.appendChild(el('div', { style: 'height:16px' }));
    wrap.appendChild(body);
    return wrap;
  }

  function screenAlerts() {
    var wrap = el('div.scroll', { style: 'height:100%' });
    wrap.appendChild(el('span.lbl', {}, 'REMINDERS'));
    var on = S.reminders.filter(function (r) { return r.on; }).length;
    wrap.appendChild(el('div', { style: 'font:400 22px/1.35 var(--sans);margin-top:18px;max-width:290px' }, on + ' nudge' + (on === 1 ? '' : 's') + ' a day.'));

    var perm = (window.Notification && Notification.permission) || 'unsupported';
    if (perm === 'default') {
      var b = el('button.ghostbtn', { style: 'border-style:solid;border-color:var(--ink-1);color:var(--ink-1)' }, 'ALLOW NOTIFICATIONS');
      b.onclick = function () { Notification.requestPermission().then(function () { schedule(); render(); }); };
      wrap.appendChild(b);
    } else if (perm !== 'granted') {
      wrap.appendChild(el('div', { style: 'margin-top:18px;padding:14px;border:1px solid var(--line-2);font:500 11px/1.6 var(--mono);letter-spacing:.1em;color:var(--ink-3);text-align:center' },
        perm === 'unsupported' ? 'NOTIFICATIONS UNAVAILABLE\nON THIS BROWSER' : 'NOTIFICATIONS BLOCKED\nENABLE IN iOS SETTINGS'));
      wrap.lastChild.style.whiteSpace = 'pre-line';
    }

    S.reminders.forEach(function (r, i) {
      var sw = el('button', { class: 'sw' + (r.on ? ' on' : '') }, [el('span')]);
      sw.onclick = function (e) { e.stopPropagation(); r.on = !r.on; save(); schedule(); render(); };
      // system stepper, expanded on tap — no native picker
      var open = view.editingRem === i;
      var label = el('div', { style: 'width:68px;flex:none;font:500 16px/1 var(--mono);color:' + (open ? 'var(--ink-1)' : 'var(--ink-1)') }, r.t);
      var row = el('div.srow', { style: open ? 'background:var(--paper-2);margin:0 -24px;padding:15px 24px' : '' },
        [label, el('span', { class: 'main', style: 'color:var(--ink-2)' }, r.label), sw]);
      row.onclick = function () { view.editingRem = open ? null : i; render(); };
      if (!open) { wrap.appendChild(row); return; }
      var doneR = el('button', { style: 'height:36px;padding:0 16px;background:none;border:1px solid var(--line-2);color:var(--ink-2);border-radius:2px;font:500 11px/1 var(--mono);letter-spacing:.12em' }, 'DONE');
      doneR.onclick = function (e) { e.stopPropagation(); view.editingRem = null; render(); };
      var strip = el('div', { style: 'background:var(--paper-2);margin:0 -24px;padding:0 24px 16px;display:flex;flex-direction:column;gap:14px' }, [
        timeStepper(r.t, function (nt) { r.t = nt; save(); schedule(); render(); }),
        el('div', { style: 'display:flex;justify-content:flex-end' }, [doneR])
      ]);
      strip.onclick = function (e) { e.stopPropagation(); };
      wrap.appendChild(el('div', {}, [row, strip]));
    });

    wrap.appendChild(el('div.lbl-xs', { style: 'margin-top:26px' }, 'BEHAVIOUR'));
    var smart = el('button', { class: 'sw' + (S.smart ? ' on' : '') }, [el('span')]);
    smart.onclick = function () { S.smart = !S.smart; save(); render(); };
    wrap.appendChild(el('div.srow', {}, [
      el('div', { class: 'main' }, [document.createTextNode('Skip if I\u2019ve just logged'), el('div', { class: 'desc' }, 'No nudge within an hour of a cup')]), smart
    ]));
    var snd = el('button', { class: 'sw' + (S.sound ? ' on' : '') }, [el('span')]);
    snd.onclick = function () { S.sound = !S.sound; save(); render(); };
    wrap.appendChild(el('div.srow', {}, [
      el('div', { class: 'main' }, [document.createTextNode('Sound on log'), el('div', { class: 'desc' }, 'A short tick when a cup is added')]), snd
    ]));

    wrap.appendChild(el('div', { style: 'font:400 12px/1.6 var(--sans);color:var(--ink-4);margin:22px 0 20px' },
      'Reminders fire while iOS keeps the app installed on your Home Screen. If it has been closed for a long time, iOS may skip a nudge — the log is never affected.'));
    return wrap;
  }

  function screenSetup() {
    var wrap = el('div.scroll', { style: 'height:100%' });
    wrap.appendChild(el('span.lbl', {}, 'SETUP'));

    var minus = el('button.sq', {}, '\u2013'); minus.onclick = function () { if (S.goal > 1) { S.goal--; save(); render(); } };
    var plus = el('button.sq', {}, '+'); plus.onclick = function () { if (S.goal < 20) { S.goal++; save(); render(); } };
    wrap.appendChild(el('div.panel', {}, [
      el('div.lbl-xs', {}, 'DAILY GOAL'),
      el('div', { style: 'display:flex;align-items:flex-end;gap:10px;margin-top:12px' }, [
        el('div.numeral-sm', {}, pad(S.goal)),
        el('div', { style: 'font:500 15px/1 var(--mono);color:var(--ink-2);padding-bottom:6px' }, 'cups · ' + litres(S.goal) + ' L'),
        el('div', { style: 'flex:1' }), minus, plus
      ]),
      el('div', { style: 'font:400 12px/1.5 var(--sans);color:var(--ink-2);margin-top:12px' }, 'A minimum, not a ceiling. Extra cups are counted.')
    ]));

    function stepRow(label, value, dec, inc) {
      var m = el('button.sq', {}, '\u2013'), p = el('button.sq', {}, '+');
      m.onclick = function () { dec(); save(); render(); }; p.onclick = function () { inc(); save(); render(); };
      return el('div.srow', {}, [el('span', { class: 'main' }, label), el('span', { class: 'val' }, value), m, p]);
    }
    wrap.appendChild(stepRow('Cup size', S.cupMl + ' ml',
      function () { if (S.cupMl > 100) S.cupMl -= 50; }, function () { if (S.cupMl < 750) S.cupMl += 50; }));
    wrap.appendChild(stepRow('Day starts at', pad(S.dayStart) + ':00',
      function () { S.dayStart = (S.dayStart + 23) % 24; }, function () { S.dayStart = (S.dayStart + 1) % 24; }));

    var exp = el('button.ghostbtn', {}, 'EXPORT CSV');
    exp.onclick = exportCsv;
    wrap.appendChild(exp);

    var wipe = el('button.ghostbtn', { style: 'border-color:var(--accent);color:var(--accent)' }, 'ERASE ALL DATA');
    wipe.onclick = function () {
      if (confirm('Erase every logged cup on this device? This cannot be undone.')) {
        S.log = {}; save(); toast('ALL DATA ERASED'); render();
      }
    };
    wrap.appendChild(wipe);

    var days = Object.keys(S.log).filter(function (k) { return S.log[k].length; }).length;
    wrap.appendChild(el('div', { style: 'font:400 10px/1.7 var(--mono);letter-spacing:.1em;color:var(--ink-4);margin:26px 0 20px' },
      'H2O\u20138 · VERSION 1.0\nNO ACCOUNT. NO ADS. NO NETWORK.\n' + days + ' DAYS STORED ON THIS DEVICE.'));
    wrap.lastChild.style.whiteSpace = 'pre-line';
    return wrap;
  }

  function sheetDay(k) {
    var d = new Date(k + 'T12:00:00'), times = (S.log[k] || []).slice(), n = times.length;
    var live = isToday(d);
    var wrap = el('div.sheet');

    var close = el('button.sq', {}, '\u2715'); close.onclick = function () { view.sheet = null; view.editing = null; render(); };
    wrap.appendChild(el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
      el('span.lbl', {}, live ? 'TODAY · IN PROGRESS' : 'CLOSED'), close
    ]));

    var prev = el('button.sq', {}, '\u2039'), next = el('button.sq', {}, '\u203a');
    var oldest = firstLoggedDate();
    prev.disabled = d.getTime() <= oldest.getTime();
    next.disabled = isToday(d);
    prev.onclick = function () { var p = addDays(d, -1); view.sheet = key(p); view.editing = null; view.weekStart = mondayOf(p); render(); };
    next.onclick = function () { var p = addDays(d, 1); view.sheet = key(p); view.editing = null; view.weekStart = mondayOf(p); render(); };
    wrap.appendChild(el('div', { style: 'display:flex;align-items:center;gap:12px;margin-top:18px' }, [prev,
      el('div', { style: 'flex:1;display:flex;align-items:baseline;gap:12px;justify-content:center' }, [
        el('div', { style: 'font:600 34px/1 var(--sans);letter-spacing:-.03em' }, pad(d.getDate()) + ' ' + MON[d.getMonth()]),
        el('span.lbl', {}, DAYN[(d.getDay() + 6) % 7])
      ]), next]));

    wrap.appendChild(el('div', { style: 'display:flex;align-items:flex-end;gap:10px;margin-top:16px' }, [
      el('div.numeral-sm', {}, pad(n)),
      el('div.of', { style: 'font-size:18px;padding-bottom:5px' }, '/ ' + pad(S.goal)),
      el('div', { style: 'flex:1' }),
      el('div', { style: 'text-align:right;font:500 12px/1.6 var(--mono);color:' + (n >= S.goal ? 'var(--ink-1)' : 'var(--ink-4)') },
        litres(n) + ' L\n' + (n >= S.goal ? (n > S.goal ? (n - S.goal) + ' past goal' : 'goal met') : (S.goal - n) + ' short'))
    ]));
    wrap.lastChild.lastChild.style.whiteSpace = 'pre-line';

    wrap.appendChild(el('div.lbl-xs', { style: 'margin-top:24px' }, '24 HOURS'));
    var strip = el('div.strip');
    for (var h = 0; h < 24; h++) {
      var inH = times.filter(function (t) { return parseInt(t.slice(0, 2), 10) === h; }).length;
      strip.appendChild(el('div', { style: 'height:' + (inH ? Math.min(inH, 3) * 22 + 14 : 6) + 'px' +
        (inH ? ';background:' + (live ? 'var(--accent)' : 'var(--ink-1)') : '') }));
    }
    wrap.appendChild(strip);
    wrap.appendChild(el('div', { style: 'display:flex;justify-content:space-between;font:400 9px/1 var(--mono);color:var(--ink-3);margin-top:7px' },
      ['00', '06', '12', '18', '23'].map(function (t) { return el('span', {}, t); })));

    var gap = '\u2013';
    for (var i = 1, g = 0; i < times.length; i++) {
      var diff = minutes(times[i]) - minutes(times[i - 1]);
      if (diff > g) { g = diff; gap = Math.floor(g / 60) + 'h ' + (g % 60) + 'm'; }
    }
    wrap.appendChild(el('div.stats', {}, [
      el('div', {}, [el('div.lbl-xs', {}, 'FIRST'), el('div', { style: 'font:500 16px/1 var(--mono);margin-top:8px' }, times[0] || '\u2013')]),
      el('div', {}, [el('div.lbl-xs', {}, 'LAST'), el('div', { style: 'font:500 16px/1 var(--mono);margin-top:8px' }, times[n - 1] || '\u2013')]),
      el('div', {}, [el('div.lbl-xs', {}, 'LONGEST GAP'), el('div', { style: 'font:500 16px/1 var(--mono);margin-top:8px' }, gap)])
    ]));

    wrap.appendChild(el('div', { style: 'display:flex;justify-content:space-between;margin-top:22px;border-top:1px solid var(--line-1);padding:10px 0 4px' }, [
      el('span.lbl-xs', {}, 'EVERY CUP · TAP TO EDIT'), el('span.lbl-xs', {}, 'RUNNING')
    ]));
    var list = el('div.scroll');
    times.forEach(function (t, i) {
      list.appendChild(cupRow(k, i, times, { mono: true }));
    });
    if (!n) list.appendChild(el('div', { style: 'font:400 14px/1.6 var(--sans);color:var(--ink-4);padding:16px 0' }, 'Nothing logged this day.'));
    list.appendChild(el('div', { style: 'height:16px' }));
    wrap.appendChild(list);
    return wrap;
  }

  function exportCsv() {
    var rows = ['date,time,cup,ml'];
    Object.keys(S.log).sort().forEach(function (k) {
      S.log[k].forEach(function (t, i) { rows.push(k + ',' + t + ',' + (i + 1) + ',' + S.cupMl); });
    });
    var blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'h2o8-' + key(today()) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ── reminders (fire while the app is alive) ──
  var timers = [];
  function schedule() {
    timers.forEach(clearTimeout); timers = [];
    if (!window.Notification || Notification.permission !== 'granted') return;
    var now = new Date();
    S.reminders.filter(function (r) { return r.on; }).forEach(function (r) {
      var when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +r.t.slice(0, 2), +r.t.slice(3));
      if (when <= now) when = new Date(when.getTime() + 864e5);
      timers.push(setTimeout(function () {
        var times = S.log[key(today())] || [];
        var recent = times.length && (minutes(nowHM()) - minutes(times[times.length - 1])) < 60;
        if (!(S.smart && recent)) {
          var left = Math.max(S.goal - times.length, 0);
          try {
            new Notification('H2O\u20138', { body: left ? left + ' cup' + (left === 1 ? '' : 's') + ' to go today.' : 'Goal met. Extra cups still count.', tag: 'h2o8' });
          } catch (e) {}
        }
        schedule();
      }, when - now));
    });
  }

  // ── render ──
  function render() {
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(view.tab === 'today' ? screenToday()
      : view.tab === 'days' ? screenDays()
      : view.tab === 'alerts' ? screenAlerts() : screenSetup());
    if (view.tab === 'days' && view.sheet) app.appendChild(sheetDay(view.sheet));
    if (view.toast) app.appendChild(el('div.toast', {}, [el('span', {}, view.toast), el('span', { style: 'color:var(--accent)' }, '\u25cf')]));

    var tabs = document.getElementById('tabs');
    tabs.innerHTML = '';
    [['today', 'TODAY'], ['days', 'DAYS'], ['alerts', 'ALERTS'], ['setup', 'SETUP']].forEach(function (t) {
      var b = el('button', { class: view.tab === t[0] ? 'on' : '' }, t[1]);
      b.onclick = function () { view.tab = t[0]; view.sheet = null; view.editing = null; if (t[0] === 'days') view.weekStart = mondayOf(today()); render(); };
      tabs.appendChild(b);
    });
  }

  // add-to-home-screen hint (Safari, not yet installed)
  function a2hs() {
    var standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (standalone || !ios || localStorage.getItem('h2o8.a2hs') === 'off') return;
    var bar = el('div.a2hs', {}, [
      el('p', {}, 'Add to Home Screen for full-screen use and reminders: Share \u2191 \u2192 Add to Home Screen.'),
      el('button', {}, 'OK')
    ]);
    bar.lastChild.onclick = function () { localStorage.setItem('h2o8.a2hs', 'off'); bar.remove(); };
    document.body.appendChild(bar);
  }

  render();
  a2hs();
  schedule();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
