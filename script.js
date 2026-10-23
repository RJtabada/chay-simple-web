(() => {
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage'), pig = $('#pig'), mud = $('#mud'), sayEl = $('#say');
  const clamp = (v) => Math.max(0, Math.min(100, v));

  // ---- state (saved in the browser) ----
  let st = { food: 70, clean: 70, fun: 70 };
  try { Object.assign(st, JSON.parse(localStorage.getItem('talking-pig') || '{}')); } catch (e) {}

  function render() {
    for (const k of ['food', 'clean', 'fun']) {
      const bar = $('#b-' + k);
      bar.style.width = st[k] + '%';
      bar.classList.toggle('low', st[k] < 30);
    }
    mud.style.opacity = (100 - st.clean) / 100;
    pig.classList.toggle('sad', Math.min(st.food, st.clean, st.fun) < 30);
    try { localStorage.setItem('talking-pig', JSON.stringify(st)); } catch (e) {}
  }
  setInterval(() => {
    st.food = clamp(st.food - 2); st.clean = clamp(st.clean - 1.5); st.fun = clamp(st.fun - 2);
    render();
  }, 3000);

  // ---- sound: a little synthesized oink ----
  let ac;
  function oink() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((delay) => {
        const t = ac.currentTime + delay;
        const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
        o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 900;
        o.frequency.setValueAtTime(340, t);
        o.frequency.exponentialRampToValueAtTime(150, t + 0.14);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        o.connect(f); f.connect(g); g.connect(ac.destination);
        o.start(t); o.stop(t + 0.16);
      });
    } catch (e) {}
  }

  // ---- helpers ----
  let sayTimer;
  function say(text, ms = 1600) {
    sayEl.textContent = text; sayEl.hidden = false;
    clearTimeout(sayTimer); sayTimer = setTimeout(() => (sayEl.hidden = true), ms);
  }
  function flag(cls, ms) {
    pig.classList.add(cls); setTimeout(() => pig.classList.remove(cls), ms);
  }
  const rel = (r) => { const s = stage.getBoundingClientRect(); return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height }; };
  const iconOf = (tool) => $(`.tool[data-tool="${tool}"] svg`).cloneNode(true);
  function overPig(x, y) {
    const r = pig.getBoundingClientRect();
    return x > r.left + r.width * 0.1 && x < r.right - r.width * 0.1 && y > r.top && y < r.bottom;
  }

  // ---- actions ----
  function bubble() {
    const p = rel(pig.getBoundingClientRect());
    const b = document.createElement('div'); b.className = 'bubble';
    const s = 14 + Math.random() * 26;
    b.style.cssText = `width:${s}px;height:${s}px;left:${p.x + p.w * (0.15 + Math.random() * 0.7)}px;top:${p.y + p.h * (0.2 + Math.random() * 0.6)}px`;
    stage.appendChild(b); setTimeout(() => b.remove(), 1400);
  }
  let washTimer;
  function scrub(amount) {
    st.clean = clamp(st.clean + amount); render();
    pig.classList.add('shake'); clearTimeout(washTimer);
    washTimer = setTimeout(() => { pig.classList.remove('shake'); if (st.clean >= 95) say('So clean!'); }, 250);
  }
  function autoWash() {
    let n = 0;
    const id = setInterval(() => { bubble(); bubble(); scrub(6); if (++n >= 9) clearInterval(id); }, 200);
  }

  function eat() {
    if (st.food >= 98) { say("I'm full!"); return; }
    const p = rel(pig.getBoundingClientRect());
    const c = document.createElement('div'); c.className = 'cake-on';
    c.appendChild(iconOf('cake'));
    c.style.left = p.x + p.w / 2 - 42 + 'px'; c.style.top = p.y + p.h * 0.45 + 'px';
    stage.appendChild(c); setTimeout(() => c.remove(), 1250);
    flag('chew', 1250); say('Yum yum!');
    setTimeout(() => { st.food = clamp(st.food + 28); render(); oink(); }, 1200);
  }

  function play() {
    const p = rel(pig.getBoundingClientRect());
    const b = document.createElement('div'); b.className = 'ball-on';
    b.appendChild(iconOf('ball'));
    const baseY = p.y + p.h - 70, left = p.x - 30, right = p.x + p.w - 30, mid = p.x + p.w / 2 - 32;
    b.style.left = '0'; b.style.top = '0';
    stage.appendChild(b);
    const kf = [[mid, baseY - 120, 0], [right, baseY - 10, .2], [(mid + right) / 2, baseY - 90, .35], [mid, baseY - 10, .5],
                [(left + mid) / 2, baseY - 90, .65], [left, baseY - 10, .8], [mid, baseY - 70, .92], [mid, baseY, 1]]
      .map(([x, y, o]) => ({ transform: `translate(${x}px,${y}px) rotate(${o * 720}deg)`, offset: o }));
    b.animate(kf, { duration: 2200, easing: 'ease-in-out' }).onfinish = () => b.remove();
    flag('jump', 1100); say('Wheee!'); oink();
    st.fun = clamp(st.fun + 25); render();
  }

  // ---- tap the pig ----
  const talk = ['Oink!', 'Oink oink!', 'Hello!', 'Snort!', 'Hehe!'];
  pig.addEventListener('click', () => { oink(); flag('oink', 350); say(talk[Math.floor(Math.random() * talk.length)]); });

  // ---- drag tools onto the pig (tapping a tool also works) ----
  document.querySelectorAll('.tool').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const tool = btn.dataset.tool, sx = e.clientX, sy = e.clientY;
      let moved = false, last = null, tick = 0;
      const ghost = document.createElement('div'); ghost.className = 'ghost';
      ghost.appendChild(iconOf(tool)); ghost.style.display = 'none';
      document.body.appendChild(ghost);

      const move = (ev) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) { moved = true; ghost.style.display = 'block'; }
        if (!moved) return;
        ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px';
        if (tool === 'soap' && overPig(ev.clientX, ev.clientY)) {
          if (last) { const d = Math.hypot(ev.clientX - last.x, ev.clientY - last.y); scrub(d * 0.05); if (++tick % 4 === 0) bubble(); }
          last = { x: ev.clientX, y: ev.clientY };
        } else last = null;
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        ghost.remove();
        const drop = moved ? overPig(ev.clientX, ev.clientY) : true;
        if (!drop) return;
        if (tool === 'cake') eat();
        else if (tool === 'ball') play();
        else if (!moved) autoWash();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  });

  render();
  setTimeout(() => say('Oink! Hi!'), 400);
})();
