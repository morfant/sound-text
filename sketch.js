(function () {
  // ============ CONFIG ============
  const AUDIO_URL    = 'https://locus.creacast.com:9443/seoul_gusan.mp3';
  const LOG_URL      = 'log.txt';
  const TARGET_CHARS = 280;
  const FADE_MS      = 1400;
  const GAP_MS       = 700;
  const HOLD_MS      = 12000;
  const FONT_SIZE    = 17;
  const LINE_H       = FONT_SIZE * 2.1;
  const LETTER_SP    = FONT_SIZE * 0.015;
  const MAX_W        = 480;
  const PAD          = 32;
  const FG           = [230, 227, 218];
  const BG           = [10, 10, 12];
  const GHOST_ALPHAS = [0.22, 0.12, 0.06, 0.03];
  // ================================

  function parseLog(raw) {
    const dateRe = /^\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\s*[월화수목금토일]요일$/;
    const timeRe = /\b\d{1,2}:\d{2}\b/g;
    const segs = [];
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    for (const line of lines) {
      if (dateRe.test(line)) { segs.push(['d', line]); continue; }
      let lastEnd = 0, m;
      timeRe.lastIndex = 0;
      while ((m = timeRe.exec(line)) !== null) {
        if (m.index > lastEnd) { const t = line.slice(lastEnd, m.index).trim(); if (t) segs.push(['o', t]); }
        segs.push(['t', m[0]]);
        lastEnd = m.index + m[0].length;
      }
      if (lastEnd < line.length) { const t = line.slice(lastEnd).trim(); if (t) segs.push(['o', t]); }
    }
    return segs;
  }

  function groupBlocks(segs) {
    const blocks = []; let cur = [];
    for (const s of segs) {
      if (s[0] === 'd') { if (cur.length) blocks.push(cur); blocks.push([s]); cur = []; }
      else if (s[0] === 't') { if (cur.length) blocks.push(cur); cur = [s]; }
      else { cur.push(s); }
    }
    if (cur.length) blocks.push(cur);
    return blocks;
  }

  function paginate(blocks, target) {
    const pages = [[]]; let len = 0;
    for (const block of blocks) {
      const bl = block.reduce((a, s) => a + s[1].length + 1, 0);
      if (bl > target) {
        for (const s of block) {
          const sl = s[1].length + 1;
          if (len + sl > target && pages[pages.length - 1].length) { pages.push([]); len = 0; }
          pages[pages.length - 1].push(s); len += sl;
        }
      } else {
        if (len + bl > target && pages[pages.length - 1].length) { pages.push([]); len = 0; }
        for (const s of block) pages[pages.length - 1].push(s);
        len += bl;
      }
    }
    return pages;
  }

  let appPages = [];

  const sketchInstance = new p5(function (p) {
    let currentIdx    = 0;
    let phase         = 'idle'; // idle | intro | markers | all | fadeout_obs | fadeout_all
    let phaseStart    = 0;
    let currentLayout = [];
    let ghosts        = [];

    function pageX() { return (p.width - Math.min(MAX_W, p.width - PAD * 2)) / 2; }
    function pageW() { return Math.min(MAX_W, p.width - PAD * 2); }

    function computeLayout(segments) {
      const x0 = pageX();
      const w  = pageW();
      let curX = 0, curY = 0;
      const items = [];

      for (let i = 0; i < segments.length; i++) {
        const type    = segments[i][0] === 'o' ? 'o' : 't';
        const content = (i > 0 ? ' ' : '') + segments[i][1];
        for (const ch of content) {
          const chW = p.textWidth(ch) + LETTER_SP;
          if (curX + chW > w && curX > 0) { curX = 0; curY += LINE_H; }
          items.push({ ch, type, rx: curX, ry: curY });
          curX += chW;
        }
      }

      const totalH = curY + LINE_H;
      const y0     = (p.height - totalH) / 2;
      return items.map(it => ({ ch: it.ch, type: it.type, x: x0 + it.rx, y: y0 + it.ry }));
    }

    function drawLayout(items, tA, oA) {
      for (const it of items) {
        const a = it.type === 't' ? tA : oA;
        if (a <= 0) continue;
        p.fill(FG[0], FG[1], FG[2], a);
        p.text(it.ch, it.x, it.y);
      }
    }

    function promoteToGhost() {
      const next = [];
      for (let i = 0; i < ghosts.length; i++) {
        if (i + 1 < GHOST_ALPHAS.length)
          next.push({ segments: ghosts[i].segments, layout: ghosts[i].layout, alpha: GHOST_ALPHAS[i + 1] });
      }
      next.unshift({ segments: appPages[currentIdx], layout: currentLayout, alpha: GHOST_ALPHAS[0] });
      ghosts = next;
    }

    function advancePage() {
      promoteToGhost();
      currentIdx    = (currentIdx + 1) % appPages.length;
      currentLayout = computeLayout(appPages[currentIdx]);
      phase         = 'markers';
      phaseStart    = p.millis();
    }

    p.setup = function () {
      const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
      cnv.style('position', 'fixed');
      cnv.style('top', '0');
      cnv.style('left', '0');
      cnv.style('z-index', '0');
      p.textFont('Noto Serif KR');
      p.textSize(FONT_SIZE);
      p.textAlign(p.LEFT, p.TOP);
      p.noStroke();
    };

    p.windowResized = function () {
      p.resizeCanvas(p.windowWidth, p.windowHeight);
      if (phase !== 'idle' && phase !== 'intro') {
        currentLayout = computeLayout(appPages[currentIdx]);
        ghosts = ghosts.map(g => ({
          segments: g.segments,
          layout: computeLayout(g.segments),
          alpha: g.alpha,
        }));
      }
    };

    p.startCycle = function () {
      currentIdx    = 0;
      currentLayout = [];
      ghosts        = [];
      phase         = 'intro';
      phaseStart    = p.millis();
    };

    p.draw = function () {
      p.background(BG[0], BG[1], BG[2]);
      if (phase === 'idle') return;

      if (phase === 'intro') {
        if (p.millis() - phaseStart >= 800) {
          currentLayout = computeLayout(appPages[0]);
          phase         = 'markers';
          phaseStart    = p.millis();
        }
        return;
      }

      for (const g of ghosts) {
        const a = Math.round(g.alpha * 255);
        drawLayout(g.layout, a, a);
      }

      const e = p.millis() - phaseStart;
      let tA = 0, oA = 0;

      if (phase === 'markers') {
        tA = p.constrain(p.map(e, 0, FADE_MS, 0, 255), 0, 255);
        if (e >= FADE_MS + GAP_MS) { phase = 'all'; phaseStart = p.millis(); }
      } else if (phase === 'all') {
        tA = 255;
        oA = p.constrain(p.map(e, 0, FADE_MS, 0, 255), 0, 255);
        if (e >= FADE_MS + HOLD_MS) { phase = 'fadeout_obs'; phaseStart = p.millis(); }
      } else if (phase === 'fadeout_obs') {
        tA = 255;
        oA = p.constrain(p.map(e, 0, FADE_MS, 255, 0), 0, 255);
        if (e >= FADE_MS + GAP_MS) { phase = 'fadeout_all'; phaseStart = p.millis(); }
      } else if (phase === 'fadeout_all') {
        tA = p.constrain(p.map(e, 0, FADE_MS, 255, 0), 0, 255);
        if (e >= FADE_MS) { advancePage(); return; }
      }

      drawLayout(currentLayout, tA, oA);
    };
  });

  // Audio
  const audio   = document.getElementById('audio');
  audio.src     = AUDIO_URL;
  const muteBtn = document.getElementById('mute');
  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    muteBtn.style.opacity = audio.muted ? '0.3' : '';
  });

  // Entry
  const overlay  = document.getElementById('overlay');
  const enterBtn = document.getElementById('enter');
  const hud      = document.getElementById('hud');
  const errEl    = document.getElementById('err');

  enterBtn.addEventListener('click', async () => {
    enterBtn.disabled = true;
    try { await audio.play(); }
    catch (e) { errEl.textContent = '오디오 재생 실패: ' + e.message; }
    try {
      const res = await fetch(LOG_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error('log.txt 로드 실패 (' + res.status + ')');
      const raw = await res.text();
      const segs = parseLog(raw);
      if (!segs.length) throw new Error('로그가 비어있습니다');
      appPages = paginate(groupBlocks(segs), TARGET_CHARS);
      await document.fonts.ready;
      overlay.classList.add('hidden');
      hud.classList.add('visible');
      sketchInstance.startCycle();
    } catch (e) {
      errEl.textContent = e.message;
      enterBtn.disabled = false;
    }
  });
})();
