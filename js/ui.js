/* =========================================================
 * PRIMORDIUM — UI 렌더링 / 차트
 * 원칙: 구조는 필요할 때만 재구축, 값은 제자리 갱신.
 * 텍스트 삽입은 항상 textContent (innerHTML 조립 금지).
 * ========================================================= */
'use strict';

const UI = (() => {

  /* ---------- 포맷 ---------- */

  function fmt(n) {
    if (!isFinite(n)) return '0';
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    if (a >= 100) return String(Math.floor(n));
    if (a >= 10) return (Math.floor(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return (Math.floor(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
  }

  function fmtRate(n) {
    if (!isFinite(n) || Math.abs(n) < 0.005) return '0/s';
    const s = n > 0 ? '+' : '−';
    return s + fmt(Math.abs(n)) + '/s';
  }

  function fmtClock(ts) {
    const d = new Date(ts);
    let h = d.getHours();
    const ap = h < 12 ? '오전' : '오후';
    h = h % 12 || 12;
    return `${ap} ${h}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function fmtDur(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분 ${sec % 60}초`;
    return `${sec}초`;
  }

  /* ---------- DOM 헬퍼 ---------- */

  const $ = (id) => document.getElementById(id);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  /* ---------- 색/카테고리 (검증된 팔레트 — 순서 고정) ---------- */

  const CAT = {
    civ: [
      { key: 'food', name: '식량', color: '#1BAF7A', of: (r) => r.food },
      { key: 'lumber', name: '목재', color: '#EB6834', of: (r) => r.lumber },
      { key: 'stone', name: '석재', color: '#4A3AA7', of: (r) => r.stone },
      { key: 'etc', name: '기타', color: '#5B91FF', of: (r) => r.copper + r.iron + r.know + r.coins },
    ],
    evolution: [
      { key: 'rna', name: 'RNA', color: '#5B91FF', of: (r) => r.rna },
      { key: 'dna', name: 'DNA', color: '#4A3AA7', of: (r) => r.dna },
    ],
  };

  const HEAT = ['#EFF0F3', '#D9E5FD', '#AFC9FA', '#84AAF3', '#5B91FF', '#2F63D6', '#1C3F9E'];

  /* ---------- 차트 상태 ---------- */

  // hist: [{t(ms), v:{metric: value}}] — main.js가 1초마다 push
  const hist = [];
  const heat = new Array(DATA.const.heatCells).fill(0); // 뒤가 최신
  let heatAcc = 0;

  const METRICS = {
    evolution: [
      { id: 'rna', name: 'RNA' },
      { id: 'dna', name: 'DNA' },
    ],
    civ: [
      { id: 'total', name: '총자원' },
      { id: 'food', name: '식량' },
      { id: 'lumber', name: '목재' },
      { id: 'stone', name: '석재' },
      { id: 'know', name: '지식' },
      { id: 'coins', name: '화폐', needsTech: 'currency' },
    ],
  };

  let chartMetric = 'rna';
  let chartRange = 600;

  function metricValue(st, id) {
    if (id === 'total') {
      let s = 0;
      for (const r in st.res) if (r !== 'rna' && r !== 'dna') s += st.res[r];
      return s;
    }
    return st.res[id] !== undefined ? st.res[id] : 0;
  }

  function pushHist(st) {
    const v = {};
    const list = METRICS[st.phase] || [];
    for (const m of list) v[m.id] = metricValue(st, m.id);
    hist.push({ t: Date.now(), v });
    if (hist.length > DATA.const.histMax) hist.shift();
  }

  function pushHeat(prodPerSec, dt) {
    heatAcc += prodPerSec * dt;
  }

  function rotateHeat() { // 10초마다 호출
    heat.push(heatAcc);
    heatAcc = 0;
    if (heat.length > DATA.const.heatCells) heat.shift();
  }

  function resetCharts() {
    hist.length = 0;
    heat.fill(0);
    heatAcc = 0;
  }

  /* ---------- 탭 ---------- */

  const TAB_TITLES = {
    dash: '대시보드', build: '건설', research: '연구',
    people: '인구', records: '기록', settings: '설정',
  };
  let activeTab = 'dash';

  function switchTab(tab, st) {
    activeTab = tab;
    document.querySelectorAll('.side-btn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.tab === tab));
    document.querySelectorAll('.panel').forEach((p) =>
      p.classList.toggle('is-active', p.id === 'panel-' + tab));
    $('tab-title').textContent =
      tab === 'build' && st.phase === 'evolution' ? '진화' : TAB_TITLES[tab];
    structureDirty = true;
    update(st, lastRates);
  }

  /* ---------- 구조 재구축 관리 ---------- */

  let structureDirty = true;
  let builtPhase = null;
  let builtSig = '';

  function markDirty() { structureDirty = true; }

  function structureSig(st) {
    const vis = [];
    for (const id in DATA.buildings) if (Engine.buildingVisible(st, id)) vis.push(id);
    for (const id in DATA.techs) if (st.techs[id]) vis.push('t:' + id);
    if (Engine.wonderVisible(st)) vis.push('w');
    return st.phase + '|' + st.evoChain + '|' + vis.join(',');
  }

  /* ================================================================
   * 대시보드
   * ================================================================ */

  const statRefs = [];   // {icon,label,value,unit,badge}
  let gatherRefs = [];   // {btn, sub, action}
  let allocRefs = [];    // {seg, dot, name, pct, amt}

  function buildDashboard(st) {
    // --- 스탯 카드 3장 ---
    const row = $('stat-row');
    row.textContent = '';
    statRefs.length = 0;
    for (let i = 0; i < 3; i++) {
      const card = el('div', 'card stat-card');
      const top = el('div', 'stat-top');
      const icon = el('div', 'stat-icon');
      const label = el('span');
      top.append(icon, label);
      const value = el('div', 'stat-value');
      const num = el('span', 'num');
      const unit = el('span', 'unit');
      const badge = el('span', 'badge badge-dark');
      value.append(num, unit, badge);
      card.append(top, value);
      row.append(card);
      statRefs.push({ icon, label, num, unit, badge });
    }

    // --- 채집 버튼 ---
    const g = $('gather-row');
    g.textContent = '';
    gatherRefs = [];
    const defs = st.phase === 'evolution'
      ? [
          { label: 'RNA 형성', sub: '+1', act: (s, e) => Engine.clickRNA(s) },
          { label: 'DNA 합성', sub: 'RNA 2 소모', act: (s, e) => Engine.clickDNA(s) },
        ]
      : [
          { label: '채집', sub: '+식량', act: (s) => Engine.gather(s, 'food') },
          { label: '벌목', sub: '+목재', act: (s) => Engine.gather(s, 'lumber') },
          { label: '채석', sub: '+석재', act: (s) => Engine.gather(s, 'stone') },
        ];
    for (const d of defs) {
      const btn = el('button', 'gather-btn');
      btn.type = 'button';
      const t = el('span', null, d.label);
      const sub = el('span', 'sub', d.sub);
      btn.append(t, sub);
      btn.addEventListener('click', () => { d.act(G.state); quickUpdate(); });
      g.append(btn);
      gatherRefs.push({ btn, sub, def: d });
    }

    // --- 자원 구성 ---
    const bar = $('alloc-bar');
    const list = $('alloc-list');
    bar.textContent = '';
    list.textContent = '';
    allocRefs = [];
    for (const c of CAT[st.phase]) {
      const seg = el('div', 'alloc-seg');
      seg.style.background = c.color;
      bar.append(seg);
      const item = el('div', 'alloc-item');
      const dot = el('span', 'alloc-dot');
      dot.style.background = c.color;
      const name = el('span', 'name', c.name);
      const pct = el('span', 'pct', '0%');
      name.append(pct);
      const amt = el('span', 'amt tnum', '0');
      item.append(dot, name, amt);
      list.append(item);
      allocRefs.push({ seg, pct, amt, def: c });
    }

    $('pf-title').textContent = st.phase === 'evolution' ? '원시 수프' : '내 문명';

    // --- 차트 지표 칩 ---
    const mrow = $('chart-metrics');
    mrow.textContent = '';
    const metrics = METRICS[st.phase].filter((m) => !m.needsTech || st.techs[m.needsTech]);
    if (!metrics.some((m) => m.id === chartMetric)) chartMetric = metrics[0].id;
    for (const m of metrics) {
      const chip = el('button', 'chip' + (m.id === chartMetric ? ' is-active' : ''), m.name);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        chartMetric = m.id;
        mrow.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
        renderChart(G.state);
      });
      mrow.append(chip);
    }
    $('chart-title').textContent = st.phase === 'evolution' ? '유전 물질 추이' : '자원 추이';

    // --- 히트맵 (셀은 한 번만 생성) ---
    const hm = $('heatmap');
    if (!hm.childElementCount) {
      for (let i = 0; i < DATA.const.heatCells; i++) hm.append(el('div', 'heat-cell'));
      const lg = $('heat-legend');
      lg.append(el('span', null, '낮음'));
      for (let i = 1; i <= 6; i++) {
        const k = el('span', 'cellkey');
        k.style.background = HEAT[i];
        lg.append(k);
      }
      lg.append(el('span', null, '높음'), el('span', null, '· 셀 = 10초 생산량'));
    }
  }

  function updateDashboard(st, rt) {
    const cap = Engine.caps(st);
    const { prod, cons } = rt;

    // 스탯 카드
    if (st.phase === 'evolution') {
      setStat(0, '🧬', 'RNA', fmt(st.res.rna), `/ ${fmt(cap.rna)}`, fmtRate(prod.rna));
      setStat(1, '⚡', 'RNA 생산', fmt(prod.rna), '/s', `소기관 ${st.evo.organelle}`);
      setStat(2, '🧫', 'DNA', fmt(st.res.dna), `/ ${fmt(cap.dna)}`, fmtRate(prod.dna));
    } else {
      const netFood = prod.food - cons.food;
      const growing = st.pop < cap.pop && st.res.food > 1;
      setStat(0, '👥', '인구', String(st.pop), `/ ${cap.pop}`, growing ? '성장 중' : '정체');
      setStat(1, '🌾', '식량 순생산', fmtRate(netFood).replace('/s', ''), '/s',
        netFood >= 0 ? '안정' : '⚠ 부족');
      setStat(2, '📜', '지식', fmt(st.res.know), `/ ${fmt(cap.know)}`, fmtRate(prod.know));
    }

    // 포트폴리오
    let total = 0, totalRate = 0;
    if (st.phase === 'evolution') {
      total = st.res.rna + st.res.dna;
      totalRate = prod.rna + prod.dna - cons.rna * 0.5;
    } else {
      for (const r in st.res) {
        if (r === 'rna' || r === 'dna') continue;
        total += st.res[r];
        totalRate += prod[r] - cons[r];
      }
    }
    $('pf-total').textContent = fmt(total);
    $('pf-rate').textContent = fmtRate(totalRate);
    $('pf-essence').textContent = `✦ ${st.essence} (+${Math.round(st.essence * 5)}%)`;

    // 채집 버튼 상태
    for (const gr of gatherRefs) {
      if (gr.def.label === 'DNA 합성') {
        gr.btn.disabled = st.res.rna < 2;
        gr.sub.textContent = `RNA 2 → DNA ${fmt(Engine.essenceMult(st))}`;
      } else if (st.phase === 'civ') {
        gr.sub.textContent = `+${fmt(Engine.clickPower(st))}`;
      } else {
        gr.sub.textContent = `+${fmt(Engine.essenceMult(st))}`;
      }
    }

    // 자원 구성
    const sum = Math.max(1e-9, allocRefs.reduce((a, c) => a + c.def.of(st.res), 0));
    for (const a of allocRefs) {
      const v = a.def.of(st.res);
      const p = v / sum;
      a.seg.style.flexGrow = String(Math.max(p, 0.02));
      a.pct.textContent = Math.round(p * 100) + '%';
      a.amt.textContent = fmt(v);
    }

    // 활동
    $('activity-count').textContent = '';
    $('activity-count').append(
      document.createTextNode(String(st.stats.actions) + ' '),
      el('span', 'unit', '행동'));
    $('activity-badge').textContent = st.stats.clicks + ' 클릭';

    updateHeat();
    updateTrending(st);
  }

  function setStat(i, icon, label, num, unit, badge) {
    const s = statRefs[i];
    if (!s) return;
    s.icon.textContent = icon;
    s.label.textContent = label;
    s.num.textContent = num;
    s.unit.textContent = unit;
    s.badge.textContent = badge;
  }

  /* ---------- 히트맵 ---------- */

  function updateHeat() {
    const cells = $('heatmap').children;
    const max = Math.max(1e-9, ...heat);
    for (let i = 0; i < cells.length; i++) {
      const v = heat[i] || 0;
      let bin = 0;
      if (v > 0) bin = 1 + Math.min(5, Math.floor((v / max) * 5.999));
      cells[i].style.background = HEAT[bin];
      cells[i].title = v > 0 ? `${fmt(v)} 생산` : '활동 없음';
    }
  }

  /* ---------- 가속 자원 ---------- */

  function updateTrending(st) {
    const box = $('trend-list');
    const n = hist.length;
    box.textContent = '';
    if (n < 10) {
      box.append(el('div', 'trend-empty', '데이터 수집 중… 잠시 후 표시됩니다'));
      return;
    }
    const win = Math.min(n, 60);
    const old = hist[n - win].v, now = hist[n - 1].v;
    const items = [];
    for (const m of METRICS[st.phase]) {
      if (m.id === 'total') continue;
      if (m.needsTech && !st.techs[m.needsTech]) continue;
      const a = old[m.id] || 0, b = now[m.id] || 0;
      if (b - a > 0.5) {
        const pctBase = a > 1 ? (b - a) / a * 100 : 100;
        items.push({ m, gain: b - a, pct: pctBase, cur: b });
      }
    }
    items.sort((x, y) => y.gain - x.gain);
    if (!items.length) {
      box.append(el('div', 'trend-empty', '최근 1분간 증가한 자원이 없습니다'));
      return;
    }
    const resIcon = { rna: '🧬', dna: '🧫', food: '🌾', lumber: '🪵', stone: '🪨', know: '📜', coins: '🪙' };
    for (const it of items.slice(0, 3)) {
      const div = el('div', 'trend-item');
      const ic = el('div', 'trend-icon', resIcon[it.m.id] || '📦');
      const mid = el('div');
      mid.append(el('div', 'trend-name', it.m.name), sparkline(it.m.id));
      const val = el('div', 'trend-val');
      val.append(
        el('div', 'n tnum', fmt(it.cur)),
        el('div', 'd', `+${fmt(it.gain)} (${it.pct >= 100 ? '100+' : Math.round(it.pct)}%)`));
      div.append(ic, mid, val);
      box.append(div);
    }
  }

  function sparkline(metricId) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'trend-spark');
    svg.setAttribute('width', '110');
    svg.setAttribute('height', '22');
    svg.setAttribute('viewBox', '0 0 110 22');
    const pts = hist.slice(-60).map((h) => h.v[metricId] || 0);
    if (pts.length < 2) return svg;
    let mn = Math.min(...pts), mx = Math.max(...pts);
    if (mx - mn < 1e-9) { mx = mn + 1; }
    const d = pts.map((v, i) => {
      const x = i / (pts.length - 1) * 108 + 1;
      const y = 20 - (v - mn) / (mx - mn) * 18 + 1;
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join('');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#5B91FF');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    return svg;
  }

  /* ---------- 메인 라인 차트 ---------- */

  const svgNS = 'http://www.w3.org/2000/svg';
  const CW = 800, CH = 250, PADL = 10, PADR = 62, PADT = 18, PADB = 26;
  let chartPts = []; // 렌더된 점 [{x,y,t,v}]

  function chartData() {
    if (!hist.length) return [];
    const cut = chartRange > 0 ? Date.now() - chartRange * 1000 : 0;
    let pts = hist.filter((h) => h.t >= cut);
    const MAXPT = 160;
    if (pts.length > MAXPT) {
      const stride = Math.ceil(pts.length / MAXPT);
      const ds = [];
      for (let i = 0; i < pts.length; i += stride) ds.push(pts[i]);
      if (ds[ds.length - 1] !== pts[pts.length - 1]) ds.push(pts[pts.length - 1]);
      pts = ds;
    }
    return pts;
  }

  function niceTicks(mn, mx) {
    if (mx - mn < 1e-9) mx = mn + 1;
    const span = mx - mn;
    const step = Math.pow(10, Math.floor(Math.log10(span / 2)));
    const err = span / 2 / step;
    const mult = err >= 5 ? 5 : err >= 2 ? 2 : 1;
    const s = step * mult;
    const t0 = Math.ceil(mn / s) * s;
    const out = [];
    for (let v = t0; v <= mx + 1e-9; v += s) out.push(v);
    return out.slice(0, 4);
  }

  function renderChart(st) {
    const svg = $('chart-svg');
    svg.setAttribute('viewBox', `0 0 ${CW} ${CH}`);
    svg.textContent = '';
    const raw = chartData();
    chartPts = [];
    if (raw.length < 2) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', CW / 2); t.setAttribute('y', CH / 2);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', '#8A8B92'); t.setAttribute('font-size', '13');
      t.textContent = '데이터 수집 중…';
      svg.append(t);
      return;
    }
    const vals = raw.map((h) => h.v[chartMetric] || 0);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (mx - mn < 1e-9) { mx = mn + 1; mn = Math.max(0, mn - 0.5); }
    const pad = (mx - mn) * 0.12;
    mn = Math.max(0, mn - pad); mx += pad;
    const t0 = raw[0].t, t1 = raw[raw.length - 1].t;
    const X = (t) => PADL + (t - t0) / Math.max(1, t1 - t0) * (CW - PADL - PADR);
    const Y = (v) => PADT + (1 - (v - mn) / (mx - mn)) * (CH - PADT - PADB);

    // 그리드 (수평 헤어라인 + 우측 눈금 라벨)
    for (const tv of niceTicks(mn, mx)) {
      const y = Y(tv);
      const ln = document.createElementNS(svgNS, 'line');
      ln.setAttribute('x1', PADL); ln.setAttribute('x2', CW - PADR + 6);
      ln.setAttribute('y1', y); ln.setAttribute('y2', y);
      ln.setAttribute('stroke', 'rgba(255,255,255,0.08)');
      ln.setAttribute('stroke-width', '1');
      svg.append(ln);
      const tx = document.createElementNS(svgNS, 'text');
      tx.setAttribute('x', CW - PADR + 10); tx.setAttribute('y', y + 4);
      tx.setAttribute('fill', '#8A8B92'); tx.setAttribute('font-size', '11');
      tx.setAttribute('font-variant-numeric', 'tabular-nums');
      tx.textContent = fmt(tv);
      svg.append(tx);
    }

    // X축 시간 라벨 (4개)
    for (let i = 0; i <= 3; i++) {
      const tt = t0 + (t1 - t0) * i / 3;
      const tx = document.createElementNS(svgNS, 'text');
      tx.setAttribute('x', X(tt));
      tx.setAttribute('y', CH - 6);
      tx.setAttribute('text-anchor', i === 0 ? 'start' : i === 3 ? 'end' : 'middle');
      tx.setAttribute('fill', '#8A8B92'); tx.setAttribute('font-size', '11');
      tx.textContent = fmtClock(tt);
      svg.append(tx);
    }

    // 영역 + 라인
    let dLine = '', dArea = '';
    raw.forEach((h, i) => {
      const x = X(h.t), y = Y(h.v[chartMetric] || 0);
      chartPts.push({ x, y, t: h.t, v: h.v[chartMetric] || 0 });
      dLine += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    });
    dArea = dLine + `L${X(t1).toFixed(1)} ${CH - PADB}L${X(t0).toFixed(1)} ${CH - PADB}Z`;

    const area = document.createElementNS(svgNS, 'path');
    area.setAttribute('d', dArea);
    area.setAttribute('fill', 'rgba(255,255,255,0.09)');
    svg.append(area);

    const line = document.createElementNS(svgNS, 'path');
    line.setAttribute('d', dLine);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#FFFFFF');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('stroke-linecap', 'round');
    svg.append(line);

    // 끝점 직접 라벨 (선별 라벨링: 마지막 값만)
    const last = chartPts[chartPts.length - 1];
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', last.x); dot.setAttribute('cy', last.y);
    dot.setAttribute('r', '4.5');
    dot.setAttribute('fill', '#FFFFFF');
    dot.setAttribute('stroke', '#121214');
    dot.setAttribute('stroke-width', '2');
    svg.append(dot);

    // 크로스헤어 요소
    const ch = document.createElementNS(svgNS, 'g');
    ch.setAttribute('id', 'crosshair');
    ch.setAttribute('visibility', 'hidden');
    const cline = document.createElementNS(svgNS, 'line');
    cline.setAttribute('y1', PADT); cline.setAttribute('y2', CH - PADB);
    cline.setAttribute('stroke', 'rgba(255,255,255,0.4)');
    cline.setAttribute('stroke-width', '1');
    const cdot = document.createElementNS(svgNS, 'circle');
    cdot.setAttribute('r', '4.5');
    cdot.setAttribute('fill', '#FFFFFF');
    cdot.setAttribute('stroke', '#121214');
    cdot.setAttribute('stroke-width', '2');
    ch.append(cline, cdot);
    svg.append(ch);
  }

  function chartHover(ev) {
    const svg = $('chart-svg');
    const tip = $('chart-tip');
    const ch = svg.querySelector('#crosshair');
    if (!chartPts.length || !ch) return;
    const rect = svg.getBoundingClientRect();
    const px = (ev.clientX - rect.left) / rect.width * CW;
    let best = chartPts[0], bd = Infinity;
    for (const p of chartPts) {
      const d = Math.abs(p.x - px);
      if (d < bd) { bd = d; best = p; }
    }
    ch.setAttribute('visibility', 'visible');
    ch.querySelector('line').setAttribute('x1', best.x);
    ch.querySelector('line').setAttribute('x2', best.x);
    const cdot = ch.querySelector('circle');
    cdot.setAttribute('cx', best.x); cdot.setAttribute('cy', best.y);
    tip.hidden = false;
    tip.textContent = '';
    tip.append(el('div', 'v tnum', fmt(best.v)), el('div', 't', fmtClock(best.t)));
    const wrap = $('chart-wrap');
    const wr = wrap.getBoundingClientRect();
    const lx = best.x / CW * wr.width;
    const ly = best.y / CH * wr.height;
    tip.style.left = Math.max(50, Math.min(wr.width - 50, lx)) + 'px';
    tip.style.top = ly + 'px';
  }

  function chartLeave() {
    const ch = $('chart-svg').querySelector('#crosshair');
    if (ch) ch.setAttribute('visibility', 'hidden');
    $('chart-tip').hidden = true;
  }

  /* ================================================================
   * 건설 / 진화 탭
   * ================================================================ */

  // 카드 참조: id → {count, costBox, btn}
  let buildRefs = {};

  function costLine(box, cost, st) {
    box.textContent = '';
    for (const r in cost) {
      const ok = st.res[r] >= cost[r];
      const span = el('span', ok ? 'cost-ok tnum' : 'cost-no tnum',
        `${DATA.resources[r].icon} ${fmt(cost[r])}`);
      box.append(span);
    }
  }

  function buildBuildTab(st) {
    const root = $('build-content');
    root.textContent = '';
    buildRefs = {};

    if (st.phase === 'evolution') {
      root.append(el('div', 'section-label', '세포 기관 — 반복 구매'));
      const grid1 = el('div', 'build-grid');
      for (const id in DATA.evolutions) {
        const d = DATA.evolutions[id];
        grid1.append(itemCard('evo:' + id, '🧬', d.name, d.desc, () => {
          const evts = [];
          if (Engine.buyEvo(G.state, id, evts)) afterAction(evts);
        }));
      }
      root.append(grid1);

      root.append(el('div', 'section-label', '진화의 사슬 — 순차 해금'));
      const grid2 = el('div', 'build-grid');
      DATA.evoChain.forEach((step, i) => {
        if (i > st.evoChain) return; // 다음 단계만 노출
        grid2.append(itemCard('chain:' + step.id, '✨', step.name, step.desc, () => {
          const evts = [];
          if (Engine.buyChain(G.state, evts)) afterAction(evts);
        }, i < st.evoChain));
      });
      root.append(grid2);
      return;
    }

    // 문명 단계
    root.append(el('div', 'section-label', '건물'));
    const grid = el('div', 'build-grid');
    for (const id in DATA.buildings) {
      if (!Engine.buildingVisible(st, id)) continue;
      const d = DATA.buildings[id];
      grid.append(itemCard('b:' + id, d.icon, d.name, d.desc, () => {
        const evts = [];
        if (Engine.buyBuilding(G.state, id, evts)) afterAction(evts);
      }));
    }
    root.append(grid);

    if (Engine.wonderVisible(st)) {
      root.append(el('div', 'section-label', '불가사의'));
      const w = DATA.wonder;
      const card = el('div', 'card item-card');
      const top = el('div', 'item-top');
      const ic = el('div', 'item-icon', w.icon);
      const nm = el('div');
      nm.append(el('div', 'item-name', w.name), el('div', 'item-count'));
      top.append(ic, nm);
      const desc = el('div', 'item-desc', w.desc);
      const prog = el('div', 'wonder-progress');
      const fill = el('div', 'fill');
      prog.append(fill);
      const cost = el('div', 'item-cost');
      const btn = el('button', 'pill pill-dark', '건설 단계 진행');
      btn.type = 'button';
      btn.addEventListener('click', () => {
        const evts = [];
        if (Engine.buyWonderSeg(G.state, evts)) afterAction(evts);
      });
      card.append(top, desc, prog, cost, btn);
      root.append(card);
      buildRefs['wonder'] = { count: nm.lastChild, costBox: cost, btn, fill };
    }
  }

  function itemCard(key, icon, name, desc, onBuy, done = false) {
    const card = el('div', 'card item-card');
    const top = el('div', 'item-top');
    const ic = el('div', 'item-icon', icon);
    const nm = el('div');
    const count = el('div', 'item-count');
    nm.append(el('div', 'item-name', name), count);
    top.append(ic, nm);
    const dsc = el('div', 'item-desc', desc);
    const cost = el('div', 'item-cost');
    card.append(top, dsc, cost);
    let btn = null;
    if (done) {
      card.append(el('div', 'item-done', '✓ 완료'));
    } else {
      btn = el('button', 'pill pill-dark', '구매');
      btn.type = 'button';
      btn.addEventListener('click', onBuy);
      card.append(btn);
    }
    buildRefs[key] = { count, costBox: cost, btn };
    return card;
  }

  function updateBuildTab(st) {
    for (const key in buildRefs) {
      const ref = buildRefs[key];
      const [kind, id] = key.split(':');
      let cost = null, countText = '';
      if (key === 'wonder') {
        cost = DATA.wonder.segCost;
        countText = `진행 ${st.wonderSeg}/${DATA.wonder.segments}`;
        ref.fill.style.width = (st.wonderSeg / DATA.wonder.segments * 100) + '%';
        if (st.wonderSeg >= DATA.wonder.segments) {
          ref.btn.disabled = true;
          ref.btn.textContent = '완공 — 초월 가능';
          ref.costBox.textContent = '';
          ref.count.textContent = countText;
          continue;
        }
      } else if (kind === 'evo') {
        cost = Engine.evoCost(st, id);
        countText = `보유 ${st.evo[id]}`;
      } else if (kind === 'chain') {
        const step = DATA.evoChain.find((s) => s.id === id);
        const idx = DATA.evoChain.indexOf(step);
        if (idx < st.evoChain) { ref.count.textContent = '완료'; continue; }
        cost = step.cost;
        countText = '1회성';
      } else if (kind === 'b') {
        cost = Engine.bCost(st, id);
        countText = `보유 ${st.buildings[id]}`;
      }
      ref.count.textContent = countText;
      if (cost) {
        costLine(ref.costBox, cost, st);
        if (ref.btn) ref.btn.disabled = !Engine.canPay(st, cost);
      }
    }
  }

  /* ================================================================
   * 연구 탭
   * ================================================================ */

  let techRefs = {};

  function buildResearchTab(st) {
    const root = $('research-content');
    root.textContent = '';
    techRefs = {};
    if (st.phase === 'evolution') {
      root.append(el('div', 'card', '지성을 얻은 뒤에 연구할 수 있습니다.'));
      return;
    }
    for (const tier of [1, 2, 3]) {
      const items = Object.keys(DATA.techs).filter((id) => DATA.techs[id].tier === tier);
      const visible = items.filter((id) => Engine.techVisible(st, id));
      if (!visible.length) continue;
      root.append(el('div', 'section-label', DATA.tierNames[tier]));
      const grid = el('div', 'build-grid');
      for (const id of visible) {
        const d = DATA.techs[id];
        const done = !!st.techs[id];
        const card = el('div', 'card item-card');
        const top = el('div', 'item-top');
        top.append(el('div', 'item-icon', d.icon));
        const nm = el('div');
        nm.append(el('div', 'item-name', d.name), el('div', 'item-count', done ? '연구 완료' : '미연구'));
        top.append(nm);
        const dsc = el('div', 'item-desc', d.desc);
        const cost = el('div', 'item-cost');
        card.append(top, dsc, cost);
        let btn = null;
        if (done) {
          card.append(el('div', 'item-done', '✓ 완료'));
        } else {
          btn = el('button', 'pill pill-dark', '연구');
          btn.type = 'button';
          btn.addEventListener('click', () => {
            const evts = [];
            if (Engine.research(G.state, id, evts)) afterAction(evts);
          });
          card.append(btn);
        }
        grid.append(card);
        techRefs[id] = { costBox: cost, btn, done };
      }
      root.append(grid);
    }
  }

  function updateResearchTab(st) {
    for (const id in techRefs) {
      const ref = techRefs[id];
      if (ref.done) continue;
      const d = DATA.techs[id];
      costLine(ref.costBox, d.cost, st);
      if (ref.btn) ref.btn.disabled = !Engine.canPay(st, d.cost);
    }
  }

  /* ================================================================
   * 인구 탭
   * ================================================================ */

  let jobRefs = {};
  let peopleStatRefs = {};

  function buildPeopleTab(st) {
    const root = $('people-content');
    root.textContent = '';
    jobRefs = {};
    peopleStatRefs = {};
    if (st.phase === 'evolution') {
      root.append(el('div', 'card', '아직 개체가 없습니다 — 진화를 계속하세요.'));
      return;
    }
    const summary = el('div', 'people-summary');
    for (const [key, label] of [['pop', '인구'], ['free', '미배정'], ['eat', '식량 소비'], ['growth', '다음 시민']]) {
      const card = el('div', 'card stat-card');
      const top = el('div', 'stat-top');
      top.append(el('span', null, label));
      const value = el('div', 'stat-value');
      const num = el('span', 'num');
      const unit = el('span', 'unit');
      value.append(num, unit);
      card.append(top, value);
      summary.append(card);
      peopleStatRefs[key] = { num, unit };
    }
    root.append(summary);

    const listCard = el('div', 'card');
    listCard.append(el('h2', null, '일자리 배정'));
    listCard.lastChild.style.marginBottom = '16px';
    const list = el('div', 'job-list');
    for (const j in DATA.jobs) {
      const d = DATA.jobs[j];
      const row = el('div', 'job-row');
      const ic = el('div', 'item-icon', d.icon);
      const info = el('div', 'job-info');
      const t1 = el('div', 't1', d.name);
      const t2 = el('div', 't2');
      info.append(t1, t2);
      const count = el('div', 'job-count tnum');
      const btns = el('div', 'job-btns');
      const minus = el('button', 'job-btn', '−');
      const plus = el('button', 'job-btn', '+');
      minus.type = plus.type = 'button';
      minus.setAttribute('aria-label', d.name + ' 감원');
      plus.setAttribute('aria-label', d.name + ' 증원');
      minus.addEventListener('click', () => { Engine.assign(G.state, j, -1); quickUpdate(); });
      plus.addEventListener('click', () => { Engine.assign(G.state, j, +1); quickUpdate(); });
      btns.append(minus, plus);
      row.append(ic, info, count, btns);
      list.append(row);
      jobRefs[j] = { row, t2, count, minus, plus };
    }
    listCard.append(list);
    root.append(listCard);
  }

  function updatePeopleTab(st) {
    if (st.phase !== 'civ' || !peopleStatRefs.pop) return;
    const cap = Engine.caps(st);
    const free = Engine.freeCitizens(st);
    peopleStatRefs.pop.num.textContent = String(st.pop);
    peopleStatRefs.pop.unit.textContent = `/ ${cap.pop}`;
    peopleStatRefs.free.num.textContent = String(free);
    peopleStatRefs.free.unit.textContent = '명';
    peopleStatRefs.eat.num.textContent = fmt(st.pop * DATA.const.eatPerCitizen);
    peopleStatRefs.eat.unit.textContent = '/s';
    const need = DATA.const.growthTime * (st.techs.calendar ? 0.85 : 1);
    const growing = st.pop < cap.pop && st.res.food > 1;
    peopleStatRefs.growth.num.textContent = growing
      ? fmt(Math.max(0, need - st.growthT)) : '—';
    peopleStatRefs.growth.unit.textContent = growing ? '초 후' : (st.pop >= cap.pop ? '주거 부족' : '식량 부족');

    for (const j in jobRefs) {
      const ref = jobRefs[j];
      const sl = Engine.slots(st, j);
      const visible = sl > 0 || st.jobs[j] > 0;
      ref.row.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const m = Engine.jobMult(st, j);
      const outs = [];
      for (const r in DATA.jobs[j].out)
        outs.push(`${DATA.resources[r].name} +${fmt(DATA.jobs[j].out[r] * m)}/s`);
      if (j === 'miner' && st.techs.ironwork) outs.push(`철 +${fmt(0.15 * m)}/s`);
      ref.t2.textContent = `1인당 ${outs.join(' · ')}`;
      ref.count.textContent = '';
      ref.count.append(document.createTextNode(String(st.jobs[j])),
        el('span', 'cap', ` / ${sl}`));
      ref.minus.disabled = st.jobs[j] <= 0;
      ref.plus.disabled = st.jobs[j] >= sl || Engine.freeCitizens(st) <= 0;
    }
  }

  /* ================================================================
   * 기록 탭 (통계 + 표 보기 = 차트의 접근성 트윈)
   * ================================================================ */

  function renderRecordsTab(st, rt) {
    const root = $('records-content');
    root.textContent = '';
    const grid = el('div', 'records-grid');

    // 통계
    const statsCard = el('div', 'card');
    statsCard.append(el('h2', null, '통계'));
    statsCard.lastChild.style.marginBottom = '14px';
    const sg = el('div', 'stats-grid');
    const entries = [
      ['플레이 시간', fmtDur(st.stats.playSec)],
      ['총 행동', String(st.stats.actions)],
      ['클릭', String(st.stats.clicks)],
      ['누적 지식', fmt(st.stats.cumKnow)],
      ['초월 횟수', String(st.ascensions)],
      ['정수', `✦ ${st.essence} (+${Math.round(st.essence * 5)}%)`],
    ];
    for (const [k, v] of entries) {
      const c = el('div', 'card stat-card');
      const top = el('div', 'stat-top');
      top.append(el('span', null, k));
      const val = el('div', 'stat-value');
      val.append(el('span', 'num', v));
      c.append(top, val);
      sg.append(c);
    }
    statsCard.append(sg);
    grid.append(statsCard);

    // 자원 표
    const resCard = el('div', 'card');
    resCard.append(el('h2', null, '자원 현황 표'));
    resCard.lastChild.style.marginBottom = '14px';
    const wrap1 = el('div', 'table-scroll');
    const tbl = el('table', 'data-table');
    const thead = el('thead');
    const hr = el('tr');
    for (const h of ['자원', '보유', '한도', '순생산/s'])
      hr.append(el('th', h === '자원' ? null : 'num', h));
    thead.append(hr);
    tbl.append(thead);
    const tbody = el('tbody');
    const cap = Engine.caps(st);
    for (const r in DATA.resources) {
      const def = DATA.resources[r];
      if (def.phase !== (st.phase === 'evolution' ? 'evolution' : 'civ')) continue;
      if (def.needsTech && !st.techs[def.needsTech]) continue;
      const tr = el('tr');
      tr.append(el('td', null, `${def.icon} ${def.name}`));
      tr.append(el('td', 'num', fmt(st.res[r])));
      tr.append(el('td', 'num', fmt(cap[r])));
      tr.append(el('td', 'num', fmtRate((rt.prod[r] || 0) - (rt.cons[r] || 0))));
      tbody.append(tr);
    }
    tbl.append(tbody);
    wrap1.append(tbl);
    resCard.append(wrap1);
    grid.append(resCard);

    // 차트 데이터 표 (현재 지표/기간)
    const chartCard = el('div', 'card');
    const mName = (METRICS[st.phase].find((m) => m.id === chartMetric) || {}).name || chartMetric;
    chartCard.append(el('h2', null, `차트 데이터 — ${mName}`));
    chartCard.lastChild.style.marginBottom = '14px';
    const wrap2 = el('div', 'table-scroll');
    const tbl2 = el('table', 'data-table');
    const th2 = el('thead');
    const hr2 = el('tr');
    hr2.append(el('th', null, '시각'), el('th', 'num', '값'));
    th2.append(hr2);
    tbl2.append(th2);
    const tb2 = el('tbody');
    const pts = chartData();
    for (let i = pts.length - 1; i >= 0; i--) {
      const tr = el('tr');
      tr.append(el('td', null, fmtClock(pts[i].t)),
        el('td', 'num', fmt(pts[i].v[chartMetric] || 0)));
      tb2.append(tr);
    }
    if (!pts.length) {
      const tr = el('tr');
      tr.append(el('td', null, '데이터 없음'), el('td', 'num', '—'));
      tb2.append(tr);
    }
    tbl2.append(tb2);
    wrap2.append(tbl2);
    chartCard.append(wrap2);
    grid.append(chartCard);

    // 이벤트 전체
    const logCard = el('div', 'card');
    logCard.append(el('h2', null, '이벤트 기록'));
    logCard.lastChild.style.marginBottom = '14px';
    const ll = el('div', 'log-list');
    ll.style.maxHeight = '400px';
    renderLogInto(ll, 200);
    logCard.append(ll);
    grid.append(logCard);

    root.append(grid);
  }

  /* ================================================================
   * 설정 탭
   * ================================================================ */

  let settingsRefs = {};

  function buildSettingsTab(st) {
    const root = $('settings-content');
    root.textContent = '';
    settingsRefs = {};
    const grid = el('div', 'settings-grid');

    // 초월
    const asc = el('div', 'card ascend-card');
    asc.append(el('h2', null, '✦ 초월'));
    const ascNum = el('div', 'hero-number');
    const ascDesc = el('p', 'setting-note');
    const ascBtn = el('button', 'pill pill-dark wide', '초월하기');
    ascBtn.type = 'button';
    ascBtn.addEventListener('click', () => {
      if (!Engine.canAscend(G.state)) return;
      showOverlay('✦', '초월',
        `문명을 내려놓고 정수 ${Engine.essenceGain(G.state)}을 얻습니다.\n다음 회차의 모든 생산이 영구히 빨라집니다.\n(정수 1 = 생산/클릭 +5%)`,
        '초월한다', () => { G.doAscend(); });
    });
    asc.append(ascNum, ascDesc, ascBtn);
    grid.append(asc);
    settingsRefs.ascNum = ascNum;
    settingsRefs.ascDesc = ascDesc;
    settingsRefs.ascBtn = ascBtn;

    // 저장 관리
    const save = el('div', 'card');
    save.append(el('h2', null, '저장'));
    const row1 = el('div', 'setting-row');
    row1.style.marginTop = '14px';
    const bSave = el('button', 'pill pill-dark', '지금 저장');
    const bExport = el('button', 'pill pill-ghost', '내보내기');
    const bImport = el('button', 'pill pill-ghost', '가져오기');
    bSave.type = bExport.type = bImport.type = 'button';
    row1.append(bSave, bExport, bImport);
    const ta = el('textarea', 'save-io');
    ta.placeholder = '내보내기를 누르면 코드가 생성됩니다. 가져오려면 코드를 붙여넣고 가져오기를 누르세요.';
    ta.style.marginTop = '12px';
    ta.setAttribute('aria-label', '저장 코드');
    save.append(row1, ta, el('p', 'setting-note', '15초마다 자동 저장됩니다. 저장은 이 브라우저(localStorage)에 보관됩니다.'));
    bSave.addEventListener('click', () => { G.save(); flashBtn(bSave, '저장됨!'); });
    bExport.addEventListener('click', () => {
      ta.value = btoa(unescape(encodeURIComponent(Engine.serialize(G.state))));
      ta.select();
      flashBtn(bExport, '생성됨!');
    });
    bImport.addEventListener('click', () => {
      try {
        const st2 = Engine.deserialize(decodeURIComponent(escape(atob(ta.value.trim()))));
        G.replaceState(st2);
        flashBtn(bImport, '가져옴!');
      } catch (e) {
        flashBtn(bImport, '코드 오류');
      }
    });
    grid.append(save);

    // 초기화
    const danger = el('div', 'card danger-zone');
    danger.append(el('h2', null, '초기화'));
    const bReset = el('button', 'pill pill-ghost', '모든 진행 삭제');
    bReset.type = 'button';
    bReset.style.marginTop = '14px';
    bReset.style.color = 'var(--bad)';
    bReset.addEventListener('click', () => {
      showOverlay('⚠️', '전체 초기화',
        '정수를 포함한 모든 진행이 삭제됩니다.\n되돌릴 수 없습니다.', '삭제한다', () => { G.hardReset(); });
    });
    danger.append(bReset);
    grid.append(danger);

    // 정보
    const about = el('div', 'card');
    about.append(el('h2', null, '정보'));
    about.append(el('p', 'setting-note',
      'Primordium — 원시 수프의 RNA 한 가닥에서 문명의 불가사의까지 성장하는 인크리멘탈 게임. Evolve(pmotschmann)에서 영감을 받았습니다.'));
    grid.append(about);

    root.append(grid);
  }

  function flashBtn(btn, msg) {
    const orig = btn.textContent;
    btn.textContent = msg;
    setTimeout(() => { btn.textContent = orig; }, 1200);
  }

  function updateSettingsTab(st) {
    if (!settingsRefs.ascNum) return;
    const can = Engine.canAscend(st);
    settingsRefs.ascNum.textContent = can
      ? `정수 +${Engine.essenceGain(st)}` : '조건 미달성';
    settingsRefs.ascDesc.textContent = can
      ? `초월하면 진화 단계부터 다시 시작하며, 모든 생산이 +${Engine.essenceGain(st) * 5}% 더 빨라집니다.`
      : `대신전을 완공하면 초월할 수 있습니다. (현재 ${st.wonderSeg}/${DATA.wonder.segments})`;
    settingsRefs.ascBtn.disabled = !can;
  }

  /* ================================================================
   * 이벤트 로그
   * ================================================================ */

  const logs = []; // {kind,title,sub,ts} 최신이 앞

  const LOG_ICONS = {
    build: '🔨', tech: '🔬', pop: '👶', warn: '⚠️',
    phase: '✨', wonder: '🏛️', ascend: '✦', gain: '🌙', save: '💾',
  };

  function log(evts) {
    if (!evts || !evts.length) return;
    for (const e of evts) logs.unshift(Object.assign({ ts: Date.now() }, e));
    if (logs.length > 300) logs.length = 300;
    renderLog();
  }

  function renderLog() {
    renderLogInto($('log-list'), 12);
  }

  function renderLogInto(box, max) {
    box.textContent = '';
    if (!logs.length) {
      box.append(el('div', 'log-empty', '아직 기록이 없습니다'));
      return;
    }
    for (const e of logs.slice(0, max)) {
      const item = el('div', 'log-item');
      const ic = el('div', 'log-icon k-' + e.kind, LOG_ICONS[e.kind] || '•');
      const mid = el('div');
      mid.append(el('div', 't1', e.title), el('div', 't2', e.sub || ''));
      item.append(ic, mid, el('div', 'log-time', fmtClock(e.ts)));
      box.append(item);
    }
  }

  /* ================================================================
   * 힌트 / 아바타 / 오버레이
   * ================================================================ */

  function goalHint(st) {
    if (st.phase === 'evolution') {
      if (st.evo.organelle < 1) return 'RNA를 모아 세포소기관을 만드세요';
      if (st.evo.nucleus < 1) return 'DNA를 합성해 핵을 만드세요';
      const step = Engine.chainNext(st);
      if (step) return `다음 진화: ${step.name} (DNA ${step.cost.dna})`;
      return '';
    }
    if (st.buildings.sundial < 1) return '해시계를 지어 지식을 모으세요';
    if (st.buildings.hut < 1) return '오두막을 지어 시민을 맞이하세요';
    if (!st.techs.agriculture) return '「농경」을 연구하세요';
    if (st.buildings.farm < 1) return '농장을 짓고 농부를 배정하세요';
    if (!st.techs.logging) return '「벌목」을 연구하세요';
    if (!st.techs.writing) return '연구를 진행해 「문자」까지 도달하세요';
    if (st.buildings.school < 1) return '학당을 짓고 학자를 배정하세요';
    if (!st.techs.engineering) {
      for (const id of ['mining', 'tools', 'irrigation', 'currency', 'architecture',
        'scholarship', 'bronze', 'ironwork', 'trade', 'engineering'])
        if (!st.techs[id]) return `「${DATA.techs[id].name}」 연구가 남아 있습니다`;
    }
    if (st.wonderSeg < DATA.wonder.segments)
      return `대신전을 건설하세요 (${st.wonderSeg}/${DATA.wonder.segments})`;
    return '초월할 준비가 되었습니다 — 설정 탭에서 초월하세요';
  }

  function updateChrome(st) {
    $('hint-chip').textContent = goalHint(st);
    $('avatar').textContent =
      st.phase === 'evolution' ? '🦠'
        : st.wonderSeg >= DATA.wonder.segments ? '🏛️' : '🧑‍🌾';
    // 진화 단계에서는 연구/인구 탭 숨김
    document.querySelectorAll('.side-btn').forEach((b) => {
      const t = b.dataset.tab;
      if (t === 'research' || t === 'people')
        b.style.display = st.phase === 'evolution' ? 'none' : '';
    });
  }

  let overlayCb = null;

  function showOverlay(icon, title, desc, btnText, cb) {
    $('overlay-icon').textContent = icon;
    $('overlay-title').textContent = title;
    $('overlay-desc').textContent = desc;
    $('overlay-btn').textContent = btnText;
    overlayCb = cb;
    $('overlay').hidden = false;
    $('overlay-btn').focus();
  }

  /* ================================================================
   * 갱신 루프 진입점
   * ================================================================ */

  let lastRates = { prod: {}, cons: {} };

  function afterAction(evts) {
    log(evts);
    markDirty();
    quickUpdate();
  }

  function quickUpdate() {
    update(G.state, Engine.rates(G.state));
  }

  function update(st, rt) {
    lastRates = rt;
    if (structureDirty || builtPhase !== st.phase || builtSig !== structureSig(st)) {
      builtPhase = st.phase;
      builtSig = structureSig(st);
      structureDirty = false;
      buildDashboard(st);
      buildBuildTab(st);
      buildResearchTab(st);
      buildPeopleTab(st);
      buildSettingsTab(st);
      renderChart(st);
      renderLog();
    }
    updateChrome(st);
    if (activeTab === 'dash') updateDashboard(st, rt);
    if (activeTab === 'build') updateBuildTab(st);
    if (activeTab === 'research') updateResearchTab(st);
    if (activeTab === 'people') updatePeopleTab(st);
    if (activeTab === 'settings') updateSettingsTab(st);
  }

  // 1초 주기 갱신(차트/기록처럼 무거운 것)
  function updateSlow(st) {
    if (activeTab === 'dash') renderChart(st);
    if (activeTab === 'records') renderRecordsTab(st, lastRates);
  }

  /* ---------- 초기 바인딩 ---------- */

  function init() {
    document.querySelectorAll('.side-btn').forEach((b) =>
      b.addEventListener('click', () => switchTab(b.dataset.tab, G.state)));
    document.querySelectorAll('[data-goto]').forEach((b) =>
      b.addEventListener('click', () => switchTab(b.dataset.goto, G.state)));
    $('chart-ranges').querySelectorAll('.chip').forEach((chip) =>
      chip.addEventListener('click', () => {
        chartRange = Number(chip.dataset.range);
        $('chart-ranges').querySelectorAll('.chip').forEach((c) =>
          c.classList.toggle('is-active', c === chip));
        renderChart(G.state);
      }));
    const wrap = $('chart-wrap');
    wrap.addEventListener('pointermove', chartHover);
    wrap.addEventListener('pointerleave', chartLeave);
    $('btn-save').addEventListener('click', () => {
      G.save();
      flashBtn($('btn-save'), '저장됨!');
    });
    $('overlay-btn').addEventListener('click', () => {
      $('overlay').hidden = true;
      const cb = overlayCb;
      overlayCb = null;
      if (cb) cb();
    });
  }

  return {
    init, update, updateSlow, markDirty, log, switchTab,
    pushHist, pushHeat, rotateHeat, resetCharts, showOverlay,
    fmt, fmtRate, fmtDur,
  };
})();

if (typeof window !== 'undefined') window.UI = UI;
