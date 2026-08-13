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

  // 카운트류(클릭/행동)는 축약 대신 천 단위 구분으로 통일
  const fmtInt = (n) => Math.floor(n).toLocaleString('ko-KR');

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

  function fmtClockSec(ts) {
    const d = new Date(ts);
    const h = d.getHours() % 12 || 12;
    return `${h}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
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

  /* ---------- SVG 아이콘 (24×24 스트로크 — 사이드바와 동일한 스타일) ---------- */

  const svgNSi = 'http://www.w3.org/2000/svg';
  // 'F:' 접두 = fill, 그 외 stroke. '|'로 다중 패스.
  const ICONS = {
    wheat: 'M12 21v-8|M12 13c0-4 3-6 7-6-1 4-3 6-7 6z|M12 13c0-4-3-6-7-6 1 4 3 6 7 6z',
    sprout: 'M12 21v-8|M12 13c0-4 3-6 7-6-1 4-3 6-7 6z|M12 13c0-4-3-6-7-6 1 4 3 6 7 6z',
    tree: 'M12 21v-4|M12 3L5.5 17h13z',
    axe: 'M5 19L15 9|M13 5l6 6-3 1-4-4z',
    stone: 'M7 19h10l3-6-4-8H9L4 13z',
    pick: 'M4 20l9-9|M5 9c4-4 10-4 14 0|M5 9l2 1M19 9l-2 1',
    ingot: 'M6 9h12l2 6H4z|M9 12h6',
    gear: 'M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7|M12 3v3M12 18v3M21 12h-3M6 12H3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6',
    scroll: 'M7 4h11v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z|M9 9h7M9 13h7',
    coin: 'M12 5a7 7 0 100 14 7 7 0 000-14|M9.5 10.5h5M9.5 13.5h5',
    rna: 'M9 3c-3 4 7 6 4 10s-6 4-4 8|M14 6l2 .5M12 12l2 .5M11 18l2 .5',
    dna: 'M8 3c0 5 8 7 8 12M16 3c0 5-8 7-8 12|M9 7h6M9 16h6',
    cell: 'M12 4a8 8 0 100 16 8 8 0 000-16|F:M13.5 11a2.5 2.5 0 100 5 2.5 2.5 0 000-5|F:M9 8.5a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4',
    membrane: 'M12 4a8 8 0 100 16 8 8 0 000-16|M12 7a5 5 0 100 10 5 5 0 000-10',
    organelle: 'M12 4a8 8 0 100 16 8 8 0 000-16|F:M9 9a1.4 1.4 0 100 2.8A1.4 1.4 0 009 9|F:M14 12a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8|F:M12.5 7.2a1 1 0 100 2 1 1 0 000-2',
    nucleus: 'M12 4a8 8 0 100 16 8 8 0 000-16|F:M12 9a3 3 0 100 6 3 3 0 000-6',
    eukaryote: 'M12 4a8 8 0 100 16 8 8 0 000-16|M8.5 12a3.5 2.5 0 107 0 3.5 2.5 0 00-7 0',
    mito: 'M4.5 12a7.5 4.8 0 1015 0 7.5 4.8 0 00-15 0|M7.5 12c1-1.8 2 1.8 3 0s2 1.8 3 0 2 1.8 3 0',
    star: 'F:M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z',
    hut: 'M5 12c0-5 3.5-8 7-8s7 3 7 8|M6 12v8h12v-8|M10 20v-5h4v5',
    house: 'M4 11l8-7 8 7|M6 9.5V20h12V9.5|M10 20v-5h4v5',
    tent: 'M12 4L3 20h7l2-5 2 5h7z',
    clock: 'M12 4a8 8 0 100 16 8 8 0 000-16|M12 7.5V12l3 2',
    box: 'M4 8l8-4 8 4v8l-8 4-8-4z|M4 8l8 4 8-4M12 12v8',
    school: 'M3 20h18|M5 20V9l7-5 7 5v11|M10 20v-6h4v6',
    books: 'M5 4h4v16H5z|M11 4h4v16h-4z|M17 5l3 .8L17.5 20l-3-.8',
    mountain: 'M3 20L10 7l4 7 3-4 4 10z',
    store: 'M5 8l1.2-4h11.6L19 8|M4 8h16|M5 8v12h14V8|M9 20v-6h6v6',
    temple: 'M4 20h16|M5 17h14|M7 9v8M12 9v8M17 9v8|M4 9h16L12 3z',
    pen: 'M4 20l1-4L16 5l3 3L8 19z|M14 7l3 3',
    hammer: 'M4 20l7-7|M10 6l2-2 6 6-2 2z|M12 8l4 4',
    drop: 'M12 3c4 5 6 8 6 11a6 6 0 01-12 0c0-3 2-6 6-11z',
    ship: 'M4 16h16l-2 4H6z|M12 16V5|M12 5c4 1 6 4 6 8h-6z',
    ruler: 'M3 17L17 3l4 4L7 21z|M8 16l1.5 1.5M11 13l1.5 1.5M14 10l1.5 1.5',
    calendar: 'M5 6h14v14H5z|M5 10h14|M8 4v4M16 4v4',
    gem: 'M7 4h10l4 6-9 10-9-10z|M3 10h18|M12 20L8 10l4-6 4 6z',
    user: 'M12 4.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7|M5 20c1-4 4-6 7-6s6 2 7 6',
    alert: 'M12 4L2.5 20h19z|M12 10v4.5|M12 17.2v.6',
    bolt: 'M13 3L5 14h5l-1 7 8-11h-5z',
    moon: 'M20 13A8 8 0 1111 4a6.5 6.5 0 009 9z',
    disk: 'M5 4h11l3 3v13H5z|M8 4v5h7V4|M8 20v-6h8v6',
    flask: 'M10 3h4|M12 3v5l6 10a2 2 0 01-1.8 3H7.8A2 2 0 016 18l6-10|M8.5 14h7',
    download: 'M12 4v10|M8 10l4 4 4-4|M5 19h14',
    trophy: 'M8 4h8v4a4 4 0 01-8 0z|M8 5H5.5c0 2.6 1.2 4 3.2 4.3M16 5h2.5c0 2.6-1.2 4-3.2 4.3|M12 12v4|M10 16h4|M8.5 20h7',
    lock: 'M7 11h10v9H7z|M9 11V8a3 3 0 016 0v3',
  };

  function icon(name, size = 18) {
    const svg = document.createElementNS(svgNSi, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('aria-hidden', 'true');
    for (let d of (ICONS[name] || ICONS.box).split('|')) {
      const p = document.createElementNS(svgNSi, 'path');
      const filled = d.startsWith('F:');
      if (filled) d = d.slice(2);
      p.setAttribute('d', d);
      p.setAttribute('fill', filled ? 'currentColor' : 'none');
      if (!filled) {
        p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', '1.8');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
      }
      svg.append(p);
    }
    return svg;
  }

  // 한도에 도달해 실제로는 늘지 않는 자원의 순생산 표시를 0으로 클램프
  function dispNet(st, cap, r, net) {
    return net > 0 && st.res[r] >= cap[r] - 1e-9 ? 0 : net;
  }

  /* ---------- 색/카테고리 (검증된 팔레트 — 순서 고정) ---------- */

  const CAT = {
    civ: [
      { key: 'food', name: '식량', color: '#1BAF7A', resId: 'food', of: (r) => r.food },
      { key: 'lumber', name: '목재', color: '#EB6834', resId: 'lumber', of: (r) => r.lumber },
      { key: 'stone', name: '석재', color: '#4A3AA7', resId: 'stone', of: (r) => r.stone },
      { key: 'etc', name: '기타', color: '#5B91FF', title: '구리·철·지식·화폐 합계',
        of: (r) => r.copper + r.iron + r.know + r.coins },
    ],
    evolution: [
      { key: 'rna', name: 'RNA', color: '#5B91FF', resId: 'rna', of: (r) => r.rna },
      { key: 'dna', name: 'DNA', color: '#D55181', resId: 'dna', of: (r) => r.dna },
    ],
  };

  const HEAT = ['#EFF0F3', '#D9E5FD', '#AFC9FA', '#84AAF3', '#5B91FF', '#2F63D6', '#1C3F9E'];

  /* ---------- 차트 상태 ---------- */

  // hist: [{t(ms), v:{metric: value}}] — main.js가 1초마다 push
  const hist = [];
  const heat = new Array(DATA.const.heatCells).fill(0); // 뒤가 최신
  let heatAcc = 0;

  // 다크 카드(#121214) 위 시리즈 색 — MOF-2009 CVD 검증 완료, 순서=범례 순서 고정
  const METRICS = {
    evolution: [
      { id: 'rna', name: 'RNA', color: '#3987E5' },
      { id: 'dna', name: 'DNA', color: '#D55181' },
    ],
    // 정식 자원 순서(자원 정의 순서와 동일)로 통일 — 배분 바/기록 표/일자리와 같은 순서
    civ: [
      { id: 'food', name: '식량', color: '#199E70' },
      { id: 'lumber', name: '목재', color: '#D95926' },
      { id: 'stone', name: '석재', color: '#9085E9' },
      { id: 'copper', name: '구리', color: '#D55181', needsTech: 'mining' },
      { id: 'iron', name: '철', color: '#008300', needsTech: 'ironwork' },
      { id: 'know', name: '지식', color: '#3987E5' },
      { id: 'coins', name: '화폐', color: '#C98500', needsTech: 'currency' },
    ],
  };

  let chartMetric = 'all'; // 'all' = 전체 표시, 자원 id = 하이라이트
  let chartRange = 600;

  function chartSeries(st) {
    return METRICS[st.phase].filter((m) => !m.needsTech || st.techs[m.needsTech]);
  }

  function setChartMetric(id) {
    const st = G.state;
    chartMetric = id !== 'all' && chartSeries(st).some((s) => s.id === id) ? id : 'all';
    $('chart-metrics').querySelectorAll('.chip').forEach((c) => {
      const on = (c.dataset.metric || 'all') === chartMetric;
      c.classList.toggle('is-active', on);
      c.setAttribute('aria-pressed', String(on));
    });
    renderChart(st);
  }

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

  function rotateHeat(n = 1) { // 10초마다 호출 — 밀린 회전은 균등 분배해 한 번에 소진
    const share = heatAcc / n;
    for (let i = 0; i < n; i++) {
      heat.push(share);
      if (heat.length > DATA.const.heatCells) heat.shift();
    }
    heatAcc = 0;
  }

  function resetCharts() {
    hist.length = 0;
    heat.fill(0);
    heatAcc = 0;
  }

  /* ---------- 탭 ---------- */

  const TAB_TITLES = {
    dash: '대시보드', build: '건설', research: '연구', people: '인구',
    ach: '업적', records: '기록', settings: '설정',
  };
  let activeTab = 'dash';

  // '내 문명' 카드(채집 클릭 UI 포함)를 활성 탭의 우측 컬럼으로 옮긴다 —
  // 대시보드/건설/연구/인구 어디서든 같은 위치에서 클릭 생산이 가능하다.
  function placePortfolio(tab) {
    const card = document.querySelector('.portfolio-card');
    if (!card) return;
    const anchors = { build: 'build-side', research: 'research-side', people: 'people-side' };
    if (anchors[tab]) $(anchors[tab]).append(card);
    else $('dash-side').prepend(card);
  }


  function switchTab(tab, st) {
    activeTab = tab;
    document.querySelectorAll('.side-btn').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.tab === tab));
    document.querySelectorAll('#view .panel').forEach((p) =>
      p.classList.toggle('is-active', p.id === 'panel-' + tab));
    $('tab-title').textContent =
      tab === 'build' && st.phase === 'evolution' ? '진화' : TAB_TITLES[tab];
    placePortfolio(tab);
    if (tab === 'records') renderRecordsTab(st, lastRates); // 1초 대기 없이 즉시 표시
    if (tab === 'ach') {
      renderAchTab(st);
      achSeen = Object.keys(st.ach || {}).length; // 확인 배지 해제
      try { localStorage.setItem('primordium-ach-seen', String(achSeen)); } catch (e) {}
    }
    if (tab === 'dash') renderChart(st);
    update(st, lastRates);
  }

  /* ---------- 구조 재구축 관리 ---------- */

  let structureDirty = true;
  let builtPhase = null;
  let builtSig = '';
  // 업적 확인 배지: 마지막으로 업적 탭을 본 시점의 달성 수
  let achSeen = 0;
  try { achSeen = Number(localStorage.getItem('primordium-ach-seen')) || 0; } catch (e) {}

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
      btn.title = '길게 누르면 연속 실행';
      holdRepeat(btn, () => { d.act(G.state); quickUpdate(); });
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
      if (c.title) name.title = c.title;
      const pct = el('span', 'pct', '0%');
      name.append(pct);
      const amt = el('span', 'amt tnum', '0');
      item.append(dot, name, amt);
      list.append(item);
      allocRefs.push({ seg, pct, amt, def: c });
    }

    $('pf-title').textContent = st.phase === 'evolution' ? '원시 수프' : '내 문명';

    // --- 차트 지표 칩 (범례 겸 하이라이트 선택) ---
    const mrow = $('chart-metrics');
    mrow.textContent = '';
    const metrics = chartSeries(st);
    if (chartMetric !== 'all' && !metrics.some((m) => m.id === chartMetric)) chartMetric = 'all';
    const mkChip = (id, name, color) => {
      const chip = el('button', 'chip' + (chartMetric === id ? ' is-active' : ''));
      chip.type = 'button';
      chip.dataset.metric = id;
      chip.setAttribute('aria-pressed', String(chartMetric === id));
      if (color) {
        const key = el('span', 'key');
        key.style.background = color;
        chip.append(key);
      }
      chip.append(document.createTextNode(name));
      chip.addEventListener('click', () => setChartMetric(id));
      mrow.append(chip);
    };
    mkChip('all', '전체', null);
    for (const m of metrics) mkChip(m.id, m.name, m.color);
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
      lg.append(el('span', null, '높음'), el('span', null, '· 셀 = 10초 생산량 · 좌상단 = 최근'));
    }
  }

  function updateDashboard(st, rt) {
    const cap = Engine.caps(st);
    const { prod, cons } = rt;

    // 스탯 카드 (한도 도달 시 성장률 대신 '한도 도달' 표시)
    if (st.phase === 'evolution') {
      const rnaFull = st.res.rna >= cap.rna - 1e-9;
      const dnaFull = st.res.dna >= cap.dna - 1e-9;
      setStat(0, 'rna', 'RNA', fmt(st.res.rna), `/ ${fmt(cap.rna)}`,
        rnaFull ? '한도 도달' : fmtRate(prod.rna - cons.rna));
      setStat(1, 'bolt', 'RNA 생산', fmt(prod.rna), '/s', `소기관 ${st.evo.organelle}`);
      setStat(2, 'dna', 'DNA', fmt(st.res.dna), `/ ${fmt(cap.dna)}`,
        dnaFull ? '한도 도달' : fmtRate(prod.dna));
    } else {
      const netFood = prod.food - cons.food;
      const growing = st.pop < cap.pop && st.res.food > 1;
      // 노는 시민이 있으면 성장 상태보다 우선해 표시
      const free = Engine.freeCitizens(st);
      let openSlots = 0;
      for (const j in DATA.jobs) openSlots += Math.max(0, Engine.slots(st, j) - st.jobs[j]);
      setStat(0, 'user', '인구', String(st.pop), `/ ${cap.pop}`,
        free > 0 && openSlots > 0 ? `미배정 ${free}명` : growing ? '성장 중' : '정체');
      setStat(1, 'wheat', '식량 순생산', fmtRate(netFood).replace('/s', ''), '/s',
        netFood >= 0 ? '안정' : '부족');
      setStat(2, 'scroll', '지식', fmt(st.res.know), `/ ${fmt(cap.know)}`,
        st.res.know >= cap.know - 1e-9 ? '한도 도달' : fmtRate(prod.know));
    }

    // 포트폴리오
    let total = 0, totalRate = 0;
    if (st.phase === 'evolution') {
      total = st.res.rna + st.res.dna;
      totalRate = dispNet(st, cap, 'rna', prod.rna - cons.rna)
        + dispNet(st, cap, 'dna', prod.dna);
    } else {
      for (const r in st.res) {
        if (r === 'rna' || r === 'dna') continue;
        total += st.res[r];
        totalRate += dispNet(st, cap, r, (prod[r] || 0) - (cons[r] || 0));
      }
    }
    $('pf-total').textContent = fmt(total);
    $('pf-rate').textContent = fmtRate(totalRate);
    $('pf-essence').textContent = `✦ ${st.essence} (+${Math.round(st.essence * 5)}%)`;

    // 첫 클릭 유도: 진화 시작 직후 RNA 형성 버튼 강조
    if (st.phase === 'evolution' && gatherRefs[0])
      gatherRefs[0].btn.classList.toggle('is-pulse',
        st.stats.clicks < 5 && st.evo.organelle === 0);

    // 채집 버튼 상태
    for (const gr of gatherRefs) {
      if (gr.def.label === 'DNA 합성') {
        const dnaFull = st.res.dna >= cap.dna - 1e-9;
        gr.btn.disabled = st.res.rna < 2 || dnaFull;
        gr.sub.textContent = dnaFull ? 'DNA 한도 가득 참' : `RNA 2 → DNA ${fmt(Engine.essenceMult(st))}`;
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
      // 0%(또는 0.5% 미만) 세그먼트는 숨긴다 — 전부 0이면 회색 트랙만 보임
      a.seg.style.display = p < 0.005 ? 'none' : '';
      a.seg.style.flexGrow = String(p);
      a.pct.textContent = Math.round(p * 100) + '%';
      // 한도 90% 이상이면 '보유 / 한도'로 전환해 저장 병목을 드러낸다
      const rid = a.def.resId;
      if (rid && cap[rid] !== undefined && st.res[rid] >= cap[rid] * 0.9) {
        a.amt.textContent = `${fmt(v)} / ${fmt(cap[rid])}`;
        a.amt.classList.add('is-full');
        a.amt.title = st.res[rid] >= cap[rid] - 1e-9 ? '저장 한도 도달' : '저장 한도 근접';
      } else {
        a.amt.textContent = fmt(v);
        a.amt.classList.remove('is-full');
        a.amt.removeAttribute('title');
      }
    }

    // 활동
    $('activity-count').textContent = '';
    $('activity-count').append(
      document.createTextNode(fmtInt(st.stats.actions) + ' '),
      el('span', 'unit', '행동'));
    $('activity-badge').textContent = fmtInt(st.stats.clicks) + ' 클릭';

    updateHeat();
    updateTrending(st);
  }

  function setStat(i, icn, label, num, unit, badge) {
    const s = statRefs[i];
    if (!s) return;
    if (s.iconName !== icn) { // 아이콘은 바뀔 때만 교체 (250ms 갱신 churn 방지)
      s.iconName = icn;
      s.icon.textContent = '';
      s.icon.append(icon(icn, 17));
    }
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
      const v = heat[heat.length - 1 - i] || 0; // 좌상단 셀이 가장 최근
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
    for (const it of items.slice(0, 3))
      box.append(trendRow(it.m, it.cur, it.gain, it.pct));
  }

  // 가속 카드와 기록 탭 '자원 증감'이 공유하는 행 (아이콘 · 이름+스파크 · 값+증감)
  function trendRow(m, cur, delta, pct) {
    const div = el('div', 'trend-item');
    const ic = el('div', 'trend-icon');
    ic.append(icon((DATA.resources[m.id] || {}).icon || 'box', 16));
    const mid = el('div');
    mid.append(el('div', 'trend-name', m.name), sparkline(m.id, m.color));
    const val = el('div', 'trend-val');
    const flat = Math.abs(delta) <= 0.5;
    const cls = 'd' + (flat ? ' flat' : delta < 0 ? ' down' : '');
    const txt = flat ? '±0 변화 없음'
      : (delta < 0 ? '−' : '+') + fmt(Math.abs(delta))
        + ` (${Math.abs(pct) >= 100 ? '100+' : Math.round(Math.abs(pct))}%)`;
    val.append(el('div', 'n tnum', fmt(cur)), el('div', cls, txt));
    div.append(ic, mid, val);
    return div;
  }

  function sparkline(metricId, color) {
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
    path.setAttribute('stroke', color || '#5B91FF'); // 자원 고유 색으로 통일
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.append(path);
    return svg;
  }

  /* ---------- 메인 라인 차트 ---------- */

  const svgNS = 'http://www.w3.org/2000/svg';
  let chartW = 800, chartH = 250; // 실제 렌더 크기로 매 렌더마다 갱신
  const PADL = 10, PADR = 62, PADT = 18, PADB = 26;
  let chartPts = [];          // 렌더된 점 [{x, t, v:{시리즈별 값}}]
  let chartSeriesCache = [];  // 마지막 렌더의 시리즈 목록
  let chartSelCache = null;   // 마지막 렌더의 하이라이트 id
  let chartYFn = null;        // 마지막 렌더의 Y 스케일 (호버 점 배치용)
  let lastHoverEv = null;     // 마지막 포인터 위치 — 1초 재렌더 후 호버 재적용용

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
    // 실제 렌더 크기에 viewBox를 일치시켜 텍스트 비율 왜곡(preserveAspectRatio 문제)을 없앤다
    const wrapRect = $('chart-wrap').getBoundingClientRect();
    if (wrapRect.width > 60) {
      chartW = wrapRect.width;
      if (wrapRect.height > 40) chartH = wrapRect.height;
    }
    svg.setAttribute('viewBox', `0 0 ${chartW} ${chartH}`);
    svg.textContent = '';
    const raw = chartData();
    chartPts = [];
    chartSeriesCache = chartSeries(st);
    chartSelCache = chartMetric !== 'all' && chartSeriesCache.some((s) => s.id === chartMetric)
      ? chartMetric : null;
    const series = chartSeriesCache, sel = chartSelCache;
    if (raw.length < 2) {
      const t = document.createElementNS(svgNS, 'text');
      t.setAttribute('x', chartW / 2); t.setAttribute('y', chartH / 2);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', '#8A8B92'); t.setAttribute('font-size', '13');
      t.textContent = st.phase === 'evolution'
        ? 'RNA 형성을 누르면 여기에 추이가 그려집니다' : '데이터 수집 중…';
      svg.append(t);
      chartLeave();
      return;
    }
    // 도메인은 항상 전체 시리즈 기준 — 하이라이트 시에도 나머지가 흐리게 남아 보이도록
    let mn = Infinity, mx = -Infinity;
    for (const s of series) {
      for (const h of raw) {
        const v = h.v[s.id] || 0;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
    }
    if (!isFinite(mn)) { mn = 0; mx = 1; }
    if (mx - mn < 1e-9) { mx = mn + 1; mn = Math.max(0, mn - 0.5); }
    const pad = (mx - mn) * 0.12;
    mn = Math.max(0, mn - pad); mx += pad;
    const t0 = raw[0].t, t1 = raw[raw.length - 1].t;
    const X = (t) => PADL + (t - t0) / Math.max(1, t1 - t0) * (chartW - PADL - PADR);
    const Y = (v) => PADT + (1 - (v - mn) / (mx - mn)) * (chartH - PADT - PADB);

    // 그리드 (수평 헤어라인 + 우측 눈금 라벨)
    for (const tv of niceTicks(mn, mx)) {
      const y = Y(tv);
      const ln = document.createElementNS(svgNS, 'line');
      ln.setAttribute('x1', PADL); ln.setAttribute('x2', chartW - PADR + 6);
      ln.setAttribute('y1', y); ln.setAttribute('y2', y);
      ln.setAttribute('stroke', 'rgba(255,255,255,0.08)');
      ln.setAttribute('stroke-width', '1');
      svg.append(ln);
      const tx = document.createElementNS(svgNS, 'text');
      tx.setAttribute('x', chartW - PADR + 10); tx.setAttribute('y', y + 4);
      tx.setAttribute('fill', '#8A8B92'); tx.setAttribute('font-size', '11');
      tx.setAttribute('font-variant-numeric', 'tabular-nums');
      tx.textContent = fmt(tv);
      svg.append(tx);
    }

    // X축 시간 라벨 (4개) — 짧은 구간에서는 초까지 표시해 라벨 중복 방지
    const shortSpan = t1 - t0 < 600000;
    for (let i = 0; i <= 3; i++) {
      const tt = t0 + (t1 - t0) * i / 3;
      const tx = document.createElementNS(svgNS, 'text');
      tx.setAttribute('x', X(tt));
      tx.setAttribute('y', chartH - 6);
      tx.setAttribute('text-anchor', i === 0 ? 'start' : i === 3 ? 'end' : 'middle');
      tx.setAttribute('fill', '#8A8B92'); tx.setAttribute('font-size', '11');
      tx.textContent = shortSpan ? fmtClockSec(tt) : fmtClock(tt);
      svg.append(tx);
    }

    chartYFn = Y;

    // 하이라이트 줌에서 흐린 시리즈가 플롯 밖으로 나가면 잘라내는 클립
    const defs = document.createElementNS(svgNS, 'defs');
    const clip = document.createElementNS(svgNS, 'clipPath');
    clip.setAttribute('id', 'plot-clip');
    const crect = document.createElementNS(svgNS, 'rect');
    crect.setAttribute('x', 0); crect.setAttribute('y', 2);
    crect.setAttribute('width', chartW - PADR + 8);
    crect.setAttribute('height', chartH - PADB - 2);
    clip.append(crect);
    defs.append(clip);
    svg.append(defs);

    // 호버용 포인트 캐시 (인덱스별 전체 시리즈 값)
    raw.forEach((h) => chartPts.push({ x: X(h.t), t: h.t, v: h.v }));

    // 시리즈 라인 — 흐린 것 먼저 그리고 하이라이트를 맨 위에
    const ordered = sel
      ? series.filter((s) => s.id !== sel).concat(series.filter((s) => s.id === sel))
      : series;
    for (const s of ordered) {
      let d = '';
      raw.forEach((h, i) => {
        d += (i ? 'L' : 'M') + X(h.t).toFixed(1) + ' ' + Y(h.v[s.id] || 0).toFixed(1);
      });
      if (sel === s.id) {
        const area = document.createElementNS(svgNS, 'path');
        area.setAttribute('d',
          d + `L${X(t1).toFixed(1)} ${chartH - PADB}L${X(t0).toFixed(1)} ${chartH - PADB}Z`);
        area.setAttribute('fill', s.color + '1A'); // 10% 워시
        area.setAttribute('clip-path', 'url(#plot-clip)');
        svg.append(area);
      }
      const line = document.createElementNS(svgNS, 'path');
      line.setAttribute('d', d);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', sel && sel !== s.id ? 'rgba(138,139,146,0.35)' : s.color);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-linejoin', 'round');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('clip-path', 'url(#plot-clip)');
      svg.append(line);
    }

    // 끝점: 전체 모드는 시리즈별 소형 점, 하이라이트는 선택 시리즈만 큰 점
    const lastH = raw[raw.length - 1];
    for (const s of series) {
      if (sel && s.id !== sel) continue;
      const dot = document.createElementNS(svgNS, 'circle');
      dot.setAttribute('cx', X(t1));
      dot.setAttribute('cy', Y(lastH.v[s.id] || 0));
      dot.setAttribute('r', sel ? '4.5' : '3.5');
      dot.setAttribute('fill', s.color);
      dot.setAttribute('stroke', '#121214');
      dot.setAttribute('stroke-width', '2');
      svg.append(dot);
    }

    // 크로스헤어: 세로선 + 시리즈별 점
    const ch = document.createElementNS(svgNS, 'g');
    ch.setAttribute('id', 'crosshair');
    ch.setAttribute('visibility', 'hidden');
    const cline = document.createElementNS(svgNS, 'line');
    cline.setAttribute('y1', PADT); cline.setAttribute('y2', chartH - PADB);
    cline.setAttribute('stroke', 'rgba(255,255,255,0.4)');
    cline.setAttribute('stroke-width', '1');
    ch.append(cline);
    for (const s of series) {
      const cdot = document.createElementNS(svgNS, 'circle');
      cdot.setAttribute('class', 'ch-dot' + (sel && sel !== s.id ? ' ch-dim' : ''));
      cdot.dataset.id = s.id;
      cdot.setAttribute('r', sel ? (sel === s.id ? '4.5' : '3') : '3.5');
      cdot.setAttribute('fill', s.color);
      cdot.setAttribute('stroke', '#121214');
      cdot.setAttribute('stroke-width', '2');
      ch.append(cdot);
    }
    svg.append(ch);

    // 포인터가 차트 위에 있으면 새 데이터에 호버를 재적용 —
    // 정지한 커서에서도 1초 재렌더가 툴팁을 지우지 않는다
    if (lastHoverEv && $('chart-wrap').matches(':hover')) chartHover(lastHoverEv);
    else if (!$('chart-tip').hidden) chartLeave();
  }

  function chartHover(ev) {
    const svg = $('chart-svg');
    const tip = $('chart-tip');
    const ch = svg.querySelector('#crosshair');
    if (!chartPts.length || !ch || !chartYFn) return;
    lastHoverEv = { clientX: ev.clientX, clientY: ev.clientY };
    const rect = svg.getBoundingClientRect();
    const px = (ev.clientX - rect.left) / rect.width * chartW;
    let best = chartPts[0], bd = Infinity;
    for (const p of chartPts) {
      const d = Math.abs(p.x - px);
      if (d < bd) { bd = d; best = p; }
    }
    ch.setAttribute('visibility', 'visible');
    ch.querySelector('line').setAttribute('x1', best.x);
    ch.querySelector('line').setAttribute('x2', best.x);
    ch.querySelectorAll('.ch-dot').forEach((c) => {
      c.setAttribute('cx', best.x);
      c.setAttribute('cy', chartYFn(best.v[c.dataset.id] || 0));
    });

    // 툴팁: 시각 + 모든 시리즈 값 (하이라이트가 맨 위)
    const series = chartSeriesCache, sel = chartSelCache;
    const spanShort = chartPts[chartPts.length - 1].t - chartPts[0].t < 600000;
    tip.hidden = false;
    tip.textContent = '';
    tip.append(el('div', 't', spanShort ? fmtClockSec(best.t) : fmtClock(best.t)));
    const rows = sel
      ? series.filter((s) => s.id === sel).concat(series.filter((s) => s.id !== sel))
      : series;
    for (const s of rows) {
      const row = el('div', 'row' + (sel === s.id ? ' lead' : ''));
      const key = el('span', 'key');
      key.style.background = s.color;
      row.append(key, el('span', 'name', s.name), el('span', 'v tnum', fmt(best.v[s.id] || 0)));
      tip.append(row);
    }
    const wrap = $('chart-wrap');
    const wr = wrap.getBoundingClientRect();
    const lx = best.x / chartW * wr.width;
    tip.style.left = Math.max(70, Math.min(wr.width - 70, lx)) + 'px';
    // 여러 행이라 위로 넘치지 않게 클램프 (translateY -110% 배율 반영)
    tip.style.top = Math.max(tip.offsetHeight * 1.1 + 6, 40) + 'px';
  }

  function chartLeave() {
    lastHoverEv = null;
    const ch = $('chart-svg').querySelector('#crosshair');
    if (ch) ch.setAttribute('visibility', 'hidden');
    $('chart-tip').hidden = true;
  }

  /* ================================================================
   * 건설 / 진화 탭
   * ================================================================ */

  // 카드 참조: id → {count, costBox, btn}
  let buildRefs = {};
  let buyAmt = 1; // 구매 수량: 1 | 10 | 0(=최대)

  function costLine(box, cost, st) {
    box.textContent = '';
    const cap = Engine.caps(st);
    for (const r in cost) {
      // 저장 한도 자체가 비용보다 낮으면 '부족(빨강)'이 아니라 별도 표시 — 저장고 안내
      const capShort = cap[r] !== undefined && cap[r] < cost[r];
      const ok = st.res[r] >= cost[r];
      const span = el('span', capShort ? 'cost-cap tnum' : ok ? 'cost-ok tnum' : 'cost-no tnum');
      span.title = capShort
        ? `${DATA.resources[r].name} 저장 한도(${fmt(cap[r])})가 비용보다 낮습니다 — 저장고가 필요합니다`
        : DATA.resources[r].name;
      span.append(icon(DATA.resources[r].icon, 12), document.createTextNode(' ' + fmt(cost[r])));
      box.append(span);
    }
  }

  // 구매 수량 선택 칩 (드로어 상단)
  function buyAmtRow() {
    const row = el('div', 'buy-amt');
    row.append(el('span', 'buy-amt-label', '구매 수량'));
    for (const [v, label] of [[1, '×1'], [10, '×10'], [0, '최대']]) {
      const b = el('button', 'amt-chip' + (buyAmt === v ? ' is-active' : ''), label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(buyAmt === v));
      b.addEventListener('click', () => {
        buyAmt = v;
        row.querySelectorAll('.amt-chip').forEach((c) => {
          c.classList.toggle('is-active', c === b);
          c.setAttribute('aria-pressed', String(c === b));
        });
      });
      row.append(b);
    }
    return row;
  }

  // 수량만큼 반복 구매 후 로그는 한 줄로 압축 (완공 같은 특수 이벤트는 보존)
  function buyN(buyFn, label) {
    const n = buyAmt === 0 ? 1000 : buyAmt;
    const evts = [];
    let k = 0;
    while (k < n && buyFn(evts)) k++;
    if (!k) return;
    let out = evts;
    if (k > 1) {
      const last = evts[evts.length - 1];
      out = [{ kind: last.kind, title: `${label} ×${k} 구매`, sub: last.sub }];
      const done = evts.find((e) => e.kind === 'wonder' && e.title.indexOf('완공') >= 0);
      if (done) out.push(done);
    }
    afterAction(out);
  }

  // 길게 누르면 연속 실행 (400ms 후 130ms 간격). 키보드 클릭(detail 0)도 지원.
  function holdRepeat(btn, fire) {
    let t = null, iv = null;
    const stop = () => {
      if (t) clearTimeout(t);
      if (iv) clearInterval(iv);
      t = iv = null;
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      fire(e);
      t = setTimeout(() => { iv = setInterval(() => fire(e), 130); }, 400);
    });
    for (const evn of ['pointerup', 'pointerleave', 'pointercancel']) {
      btn.addEventListener(evn, stop);
    }
    btn.addEventListener('click', (e) => { if (e.detail === 0) fire(e); });
  }

  function buildBuildTab(st) {
    const root = $('build-content');
    root.textContent = '';
    buildRefs = {};

    if (st.phase === 'evolution') {
      root.append(buyAmtRow());
      root.append(el('div', 'section-label', '세포 기관 — 반복 구매'));
      const grid1 = el('div', 'build-grid');
      for (const id in DATA.evolutions) {
        const d = DATA.evolutions[id];
        grid1.append(itemCard('evo:' + id, d.icon, d.name, d.desc, () => {
          buyN((evts) => Engine.buyEvo(G.state, id, evts), d.name);
        }));
      }
      root.append(grid1);

      root.append(el('div', 'section-label', '진화의 사슬 — 순차 해금'));
      const grid2 = el('div', 'build-grid');
      DATA.evoChain.forEach((step, i) => {
        if (i > st.evoChain) return; // 다음 단계만 노출
        grid2.append(itemCard('chain:' + step.id, 'star', step.name, step.desc, () => {
          const evts = [];
          if (Engine.buyChain(G.state, evts)) afterAction(evts);
        }, i < st.evoChain));
      });
      root.append(grid2);
      return;
    }

    // 문명 단계 — 불가사의(개방 시)를 맨 위로, 이어서 카테고리별 섹션
    root.append(buyAmtRow());

    if (Engine.wonderVisible(st)) {
      root.append(el('div', 'section-label', '불가사의'));
      const w = DATA.wonder;
      const card = el('div', 'card item-card');
      const top = el('div', 'item-top');
      const ic = el('div', 'item-icon');
      ic.append(icon(w.icon, 19));
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
        buyN((evts) => Engine.buyWonderSeg(G.state, evts), '대신전 건설');
      });
      card.append(top, desc, prog, cost, btn);
      root.append(card);
      buildRefs['wonder'] = { count: nm.lastChild, costBox: cost, btn, fill };
    }

    for (const [cat, catName] of DATA.buildingCats) {
      const ids = Object.keys(DATA.buildings).filter((id) =>
        DATA.buildings[id].cat === cat && Engine.buildingVisible(st, id));
      if (!ids.length) continue;
      root.append(el('div', 'section-label', catName));
      const grid = el('div', 'build-grid');
      for (const id of ids) {
        const d = DATA.buildings[id];
        grid.append(itemCard('b:' + id, d.icon, d.name, d.desc, () => {
          buyN((evts) => Engine.buyBuilding(G.state, id, evts), d.name);
        }));
      }
      root.append(grid);
    }
  }

  function itemCard(key, icn, name, desc, onBuy, done = false) {
    const card = el('div', 'card item-card');
    const top = el('div', 'item-top');
    const ic = el('div', 'item-icon');
    ic.append(icon(icn, 19));
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

  // 부족한 연구의 예상 대기 시간 (현재 순생산 기준)
  function researchEta(st, cost) {
    const { prod, cons } = lastRates;
    let worst = 0;
    for (const r in cost) {
      const deficit = cost[r] - st.res[r];
      if (deficit <= 0) continue;
      const net = (prod[r] || 0) - (cons[r] || 0);
      if (net <= 0.001) return Infinity;
      worst = Math.max(worst, deficit / net);
    }
    return worst;
  }

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
        const tic = el('div', 'item-icon');
        tic.append(icon(d.icon, 19));
        top.append(tic);
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
        techRefs[id] = { costBox: cost, btn, done, countEl: nm.lastChild };
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
      const can = Engine.canPay(st, d.cost);
      if (ref.btn) ref.btn.disabled = !can;
      // '언제 살 수 있나'를 드로어 안에서 바로 알 수 있게 ETA 표시
      if (ref.countEl) {
        if (can) ref.countEl.textContent = '연구 가능';
        else {
          const eta = researchEta(st, d.cost);
          ref.countEl.textContent =
            eta === Infinity ? '생산 부족' : `약 ${fmtDur(Math.ceil(eta))} 후 가능`;
        }
      }
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
    const lh = el('div', 'card-head');
    lh.append(el('h2', null, '일자리 배정'));
    const fillBtn = el('button', 'pill pill-ghost', '빈 일자리 채우기');
    fillBtn.type = 'button';
    fillBtn.title = '미배정 시민을 일자리 순서대로 빈 슬롯에 배정합니다';
    fillBtn.addEventListener('click', () => {
      const s = G.state;
      for (const j in DATA.jobs) {
        const room = Engine.slots(s, j) - s.jobs[j];
        const free = Engine.freeCitizens(s);
        if (room > 0 && free > 0) Engine.assign(s, j, Math.min(room, free));
      }
      quickUpdate();
    });
    lh.append(fillBtn);
    listCard.append(lh);
    peopleStatRefs._fillBtn = fillBtn;
    const emptyMsg = el('div', 'log-empty',
      '건물을 지으면 일자리가 열립니다 — 농장(농부) · 벌목 캠프(벌목꾼) · 채석장(채석공) · 광산(광부) · 학당(학자) · 시장(상인)');
    peopleStatRefs._emptyMsg = emptyMsg;
    const list = el('div', 'job-list');
    for (const j in DATA.jobs) {
      const d = DATA.jobs[j];
      const row = el('div', 'job-row');
      const ic = el('div', 'item-icon');
      ic.append(icon(d.icon, 19));
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
      minus.title = plus.title = 'Shift+클릭 = 10명 · 길게 누르면 연속';
      holdRepeat(minus, (e) => { Engine.assign(G.state, j, e && e.shiftKey ? -10 : -1); quickUpdate(); });
      holdRepeat(plus, (e) => { Engine.assign(G.state, j, e && e.shiftKey ? 10 : 1); quickUpdate(); });
      btns.append(minus, plus);
      row.append(ic, info, count, btns);
      list.append(row);
      jobRefs[j] = { row, t2, count, minus, plus };
    }
    listCard.append(list, emptyMsg);
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

    let visibleRows = 0;
    let totalOpen = 0;
    for (const j in jobRefs) {
      const ref = jobRefs[j];
      const sl = Engine.slots(st, j);
      totalOpen += Math.max(0, sl - st.jobs[j]);
      const visible = sl > 0 || st.jobs[j] > 0;
      ref.row.style.display = visible ? '' : 'none';
      if (!visible) continue;
      visibleRows++;
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
    // 빈 상태 안내 + 채우기 버튼 활성 조건
    if (peopleStatRefs._emptyMsg)
      peopleStatRefs._emptyMsg.style.display = visibleRows ? 'none' : '';
    if (peopleStatRefs._fillBtn)
      peopleStatRefs._fillBtn.disabled = free <= 0 || totalOpen <= 0;
  }

  /* ================================================================
   * 업적 탭
   * ================================================================ */

  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${fmtClock(ts)}`;
  }

  function renderAchTab(st) {
    const root = $('ach-content');
    // 텍스트 선택 중에는 재구축 보류 (1초 재렌더의 선택 해제 방지)
    const achSel = document.getSelection();
    if (achSel && !achSel.isCollapsed && root.contains(achSel.anchorNode)) return;
    root.textContent = '';
    const defs = DATA.achievements;
    const got = defs.filter((d) => st.ach[d.id]).length;

    // 요약 카드
    const sum = el('div', 'card ach-summary');
    const head = el('div', 'card-head');
    head.append(el('h2', null, '달성 현황'),
      el('span', 'badge badge-blue', `${Math.round(got / defs.length * 100)}%`));
    const big = el('div', 'big-number');
    big.append(document.createTextNode(`${got} `), el('span', 'unit', `/ ${defs.length}`));
    const prog = el('div', 'wonder-progress');
    const fill = el('div', 'fill');
    fill.style.width = (got / defs.length * 100) + '%';
    prog.append(fill);
    sum.append(head, big, prog);
    root.append(sum);

    // 업적 그리드 (달성 먼저, 정의 순서 유지)
    const grid = el('div', 'build-grid ach-grid');
    grid.style.marginTop = '18px';
    const sorted = defs.slice().sort((a, b) => (st.ach[b.id] ? 1 : 0) - (st.ach[a.id] ? 1 : 0));
    for (const d of sorted) {
      const doneAt = st.ach[d.id];
      const card = el('div', 'card item-card ach-card' + (doneAt ? ' is-done' : ''));
      const top = el('div', 'item-top');
      const ic = el('div', 'item-icon ach-icon');
      ic.append(icon(doneAt ? d.icon : 'lock', 19));
      const nm = el('div');
      nm.append(el('div', 'item-name', d.name),
        el('div', 'item-count', doneAt ? fmtDate(doneAt) + ' 달성' : '미달성'));
      top.append(ic, nm);
      card.append(top, el('div', 'item-desc', d.desc));
      grid.append(card);
    }
    root.append(grid);
  }

  /* ================================================================
   * 기록 탭 (통계 + 표 보기 = 차트의 접근성 트윈)
   * ================================================================ */

  function renderRecordsTab(st, rt) {
    const root = $('records-content');
    // 사용자가 텍스트를 선택 중이면 재구축을 보류 (매초 선택 해제 방지)
    const sel = document.getSelection();
    if (sel && !sel.isCollapsed && root.contains(sel.anchorNode)) return;
    // 재구축 전 스크롤 위치 보존
    const scrolls = Array.from(root.querySelectorAll('.table-scroll, .log-list'))
      .map((n) => n.scrollTop);
    root.textContent = '';
    const grid = el('div', 'records-grid');

    // 통계
    const statsCard = el('div', 'card');
    statsCard.append(el('h2', null, '통계'));
    statsCard.lastChild.style.marginBottom = '14px';
    const sg = el('div', 'stats-grid');
    const entries = [
      ['플레이 시간', fmtDur(st.stats.playSec)],
      ['총 행동', fmtInt(st.stats.actions)],
      ['클릭', fmtInt(st.stats.clicks)],
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

    // 자원 증감 모음 — 대시보드 '가속 중인 자원'의 전체 자원판.
    // 감소·정체도 함께 보여주고, 정렬은 자원 순서 고정(매초 재구축 시 행이 튀지 않게)
    const flowCard = el('div', 'card');
    flowCard.id = 'res-flow-card';
    flowCard.append(el('h2', null, '자원 증감 — 최근 1분'));
    flowCard.lastChild.style.marginBottom = '14px';
    if (hist.length < 10) {
      flowCard.append(el('div', 'trend-empty', '데이터 수집 중… 잠시 후 표시됩니다'));
    } else {
      const fn = hist.length, fwin = Math.min(fn, 60);
      const fold = hist[fn - fwin].v, fnow = hist[fn - 1].v;
      const fg = el('div', 'flow-grid');
      for (const m of METRICS[st.phase]) {
        if (m.id === 'total') continue;
        if (m.needsTech && !st.techs[m.needsTech]) continue;
        const a = fold[m.id] || 0, b = fnow[m.id] || 0;
        const pct = a > 1 ? (b - a) / a * 100 : (b - a > 0.5 ? 100 : 0);
        fg.append(trendRow(m, b, b - a, pct));
      }
      flowCard.append(fg);
    }
    grid.append(flowCard);

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
      tr.append(el('td', null, def.name));
      tr.append(el('td', 'num', fmt(st.res[r])));
      tr.append(el('td', 'num', fmt(cap[r])));
      const net = (rt.prod[r] || 0) - (rt.cons[r] || 0);
      const capped = net > 0 && st.res[r] >= cap[r] - 1e-9;
      tr.append(el('td', 'num', capped ? '가득참' : fmtRate(dispNet(st, cap, r, net))));
      tbody.append(tr);
    }
    tbl.append(tbody);
    wrap1.append(tbl);
    resCard.append(wrap1);
    grid.append(resCard);

    // 차트 데이터 표 (현재 하이라이트/기간 — 차트의 표 트윈)
    const chartCard = el('div', 'card');
    const allSeries = chartSeries(st);
    const cols = chartMetric !== 'all'
      ? allSeries.filter((s) => s.id === chartMetric) : allSeries;
    chartCard.append(el('h2', null,
      `차트 데이터 — ${cols.length === 1 ? cols[0].name : '전체 자원'}`));
    chartCard.lastChild.style.marginBottom = '14px';
    const wrap2 = el('div', 'table-scroll');
    const tbl2 = el('table', 'data-table');
    const th2 = el('thead');
    const hr2 = el('tr');
    hr2.append(el('th', null, '시각'));
    for (const s of cols) hr2.append(el('th', 'num', s.name));
    th2.append(hr2);
    tbl2.append(th2);
    const tb2 = el('tbody');
    const pts = chartData();
    const tblShort = pts.length > 1 && pts[pts.length - 1].t - pts[0].t < 600000;
    for (let i = pts.length - 1; i >= 0; i--) {
      const tr = el('tr');
      tr.append(el('td', null, tblShort ? fmtClockSec(pts[i].t) : fmtClock(pts[i].t)));
      for (const s of cols) tr.append(el('td', 'num', fmt(pts[i].v[s.id] || 0)));
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
  let saveIoValue = ''; // 재구축을 넘어 textarea 내용 유지

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
      showOverlay('star', '초월',
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
    ta.value = saveIoValue; // 탭 전환/재구축에도 내용 유지
    ta.addEventListener('input', () => { saveIoValue = ta.value; });
    save.append(row1, ta, el('p', 'setting-note', '15초마다 자동 저장됩니다. 저장은 이 브라우저(localStorage)에 보관됩니다.'));
    bSave.addEventListener('click', () => { flashBtn(bSave, G.save() ? '저장됨!' : '저장 실패'); });
    bExport.addEventListener('click', () => {
      ta.value = btoa(unescape(encodeURIComponent(Engine.serialize(G.state))));
      saveIoValue = ta.value;
      ta.select();
      flashBtn(bExport, '생성됨!');
    });
    bImport.addEventListener('click', () => {
      try {
        const st2 = Engine.deserialize(decodeURIComponent(escape(atob(ta.value.trim()))));
        G.replaceState(st2);
        // replaceState의 재구축이 버튼을 교체하므로 flashBtn 대신 오버레이로 확정 피드백
        showOverlay('download', '가져오기 완료', '저장 코드를 불러왔습니다.', '확인', null);
      } catch (e) {
        flashBtn(bImport, '코드 오류');
      }
    });
    grid.append(save);

    // 클라우드 동기화 (Google Drive)
    const cloud = el('div', 'card');
    cloud.append(el('h2', null, '클라우드 동기화'));
    if (!Sync.available()) {
      cloud.append(el('p', 'setting-note',
        'Google 계정으로 저장을 여러 기기에서 동기화하는 기능입니다. 활성화하려면 배포 소유자가 '
        + 'Google Cloud Console에서 OAuth 클라이언트 ID(웹 애플리케이션, 원본 https://ysh4267.github.io)를 '
        + '발급해 js/config.js의 googleClientId에 넣으면 됩니다.'));
    } else {
      const crow = el('div', 'setting-row');
      crow.style.marginTop = '14px';
      const bLogin = el('button', 'pill pill-dark', 'Google 로그인');
      const bUp = el('button', 'pill pill-ghost', '지금 업로드');
      const bDown = el('button', 'pill pill-ghost', '클라우드에서 불러오기');
      const bOut = el('button', 'pill pill-ghost', '로그아웃');
      for (const b of [bLogin, bUp, bDown, bOut]) b.type = 'button';
      crow.append(bLogin, bUp, bDown, bOut);
      const cnote = el('p', 'setting-note');
      cloud.append(crow, cnote);
      settingsRefs.cloud = { bLogin, bUp, bDown, bOut, note: cnote };
      bLogin.addEventListener('click', () => {
        Sync.signIn()
          .then(() => { G.cloudSmartSync(true); quickUpdate(); })
          .catch(() => { flashBtn(bLogin, '로그인 실패'); quickUpdate(); });
      });
      bUp.addEventListener('click', () => {
        G.cloudUp().then((ok) => flashBtn(bUp, ok ? '업로드됨!' : '업로드 실패'));
      });
      bDown.addEventListener('click', () => { G.cloudDown(); });
      bOut.addEventListener('click', () => { Sync.signOut(); quickUpdate(); });
    }
    grid.append(cloud);

    // 초기화
    const danger = el('div', 'card danger-zone');
    danger.append(el('h2', null, '초기화'));
    const bReset = el('button', 'pill pill-ghost', '모든 진행 삭제');
    bReset.type = 'button';
    bReset.style.marginTop = '14px';
    bReset.style.color = 'var(--bad)';
    bReset.addEventListener('click', () => {
      showOverlay('alert', '전체 초기화',
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
    // 클라우드 동기화 상태
    const c = settingsRefs.cloud;
    if (c) {
      const on = Sync.signedIn();
      c.bLogin.style.display = on ? 'none' : '';
      c.bUp.style.display = on ? '' : 'none';
      c.bDown.style.display = on ? '' : 'none';
      c.bOut.style.display = on ? '' : 'none';
      c.note.textContent = on
        ? (Sync.lastError
          ? '오류: ' + Sync.lastError
          : (Sync.lastSyncAt
            ? `로그인됨 — 마지막 업로드 ${fmtClock(Sync.lastSyncAt)}. 5분마다 자동 업로드되고, 다음 방문 때 자동으로 다시 로그인됩니다.`
            : '로그인됨 — 5분마다 자동 업로드되고, 다음 방문 때 자동으로 다시 로그인됩니다.'))
        : (Sync.lastError
          ? '오류: ' + Sync.lastError + ' — 다시 로그인해 주세요.'
          : 'Google Drive의 앱 전용 공간에 저장을 백업합니다. 다른 기기에서 이어하려면 같은 계정으로 로그인하세요.');
    }
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
    build: 'hammer', tech: 'flask', pop: 'user', warn: 'alert',
    phase: 'star', wonder: 'temple', ascend: 'star', gain: 'moon', save: 'disk',
    ach: 'trophy',
  };

  function log(evts) {
    if (!evts || !evts.length) return;
    for (const e of evts) {
      // 정례 이벤트(인구/기아)는 연속되면 한 줄로 병합해 로그 도배 방지
      const prev = logs[0];
      if (prev && prev.kind === e.kind && (e.kind === 'pop' || e.kind === 'warn')) {
        const n = (prev.n || 1) + 1;
        logs[0] = Object.assign({}, e, {
          ts: Date.now(), n,
          title: e.title.replace(/ ×\d+$/, '') + ` ×${n}`,
        });
      } else {
        logs.unshift(Object.assign({ ts: Date.now(), n: 1 }, e));
      }
      if (e.kind === 'ach') toast('trophy', e.title, e.sub);
    }
    if (logs.length > 300) logs.length = 300;
    renderLog();
  }

  // 비모달 토스트 — 어느 화면에 있든 업적 달성을 알린다
  function toast(icn, title, sub) {
    const box = $('toast-box');
    if (!box) return;
    const t = el('div', 'toast');
    const ic = el('span', 'toast-icon');
    ic.append(icon(icn, 16));
    const mid = el('div');
    mid.append(el('div', 't1', title), el('div', 't2', sub || ''));
    t.append(ic, mid);
    box.append(t);
    while (box.childElementCount > 3) box.firstElementChild.remove();
    setTimeout(() => { t.classList.add('is-out'); }, 2600);
    setTimeout(() => { t.remove(); }, 3000);
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
      const ic = el('div', 'log-icon k-' + e.kind);
      ic.append(icon(LOG_ICONS[e.kind] || 'box', 16));
      const mid = el('div');
      mid.append(el('div', 't1', e.title), el('div', 't2', e.sub || ''));
      item.append(ic, mid, el('div', 'log-time', fmtClock(e.ts)));
      box.append(item);
    }
  }

  /* ================================================================
   * 힌트 / 아바타 / 오버레이
   * ================================================================ */

  // 다음 목표 텍스트 + 클릭 시 이동할 화면. 필요 수치를 함께 표기해 목표 감각을 준다.
  function goalHint(st) {
    if (st.phase === 'evolution') {
      if (st.evo.organelle < 1)
        return { text: `RNA ${Engine.evoCost(st, 'organelle').rna}를 모아 세포소기관을 만드세요`, target: 'build' };
      if (st.evo.nucleus < 1)
        return { text: `RNA를 DNA로 합성해 핵을 만드세요 (DNA ${Engine.evoCost(st, 'nucleus').dna})`, target: 'build' };
      const step = Engine.chainNext(st);
      if (step) return { text: `다음 진화: ${step.name} (DNA ${step.cost.dna})`, target: 'build' };
      return { text: '', target: '' };
    }
    // 초반: 채집 선행 안내 (비용을 못 대는 상태에서 '지어라'만 반복하지 않게)
    if (st.buildings.sundial < 1) {
      const c = Engine.bCost(st, 'sundial');
      if (st.res.lumber < c.lumber || st.res.stone < c.stone)
        return { text: `벌목·채석 버튼으로 목재 ${c.lumber}·석재 ${c.stone}을 모으세요 (해시계)`, target: 'dash' };
      return { text: '해시계를 지어 지식을 모으세요', target: 'build' };
    }
    if (st.buildings.hut < 1) {
      const c = Engine.bCost(st, 'hut');
      if (st.res.lumber < c.lumber || st.res.stone < c.stone)
        return { text: `채집으로 목재 ${c.lumber}·석재 ${c.stone}을 모아 오두막을 지으세요`, target: 'dash' };
      return { text: '오두막을 지어 시민을 맞이하세요', target: 'build' };
    }
    // 노는 시민이 있고 빈 일자리가 있으면 최우선 안내
    const free = Engine.freeCitizens(st);
    if (free > 0) {
      let openSlots = 0;
      for (const j in DATA.jobs) openSlots += Math.max(0, Engine.slots(st, j) - st.jobs[j]);
      if (openSlots > 0)
        return { text: `노는 시민 ${free}명을 일자리에 배정하세요`, target: 'people' };
    }
    if (!st.techs.agriculture)
      return { text: `지식 ${DATA.techs.agriculture.cost.know}으로 「농경」을 연구하세요`, target: 'research' };
    if (st.buildings.farm < 1) return { text: '농장을 짓고 농부를 배정하세요', target: 'build' };
    if (!st.techs.logging)
      return { text: `지식 ${DATA.techs.logging.cost.know}으로 「벌목」을 연구하세요`, target: 'research' };
    if (!st.techs.writing) return { text: '연구를 진행해 「문자」까지 도달하세요', target: 'research' };
    if (st.buildings.school < 1) return { text: '학당을 짓고 학자를 배정하세요', target: 'build' };
    if (!st.techs.engineering) {
      for (const id of ['mining', 'tools', 'irrigation', 'currency', 'architecture',
        'scholarship', 'bronze', 'ironwork', 'trade', 'engineering'])
        if (!st.techs[id])
          return { text: `「${DATA.techs[id].name}」 연구가 남아 있습니다 (지식 ${DATA.techs[id].cost.know})`, target: 'research' };
    }
    if (st.wonderSeg < DATA.wonder.segments)
      return { text: `대신전을 건설하세요 (${st.wonderSeg}/${DATA.wonder.segments})`, target: 'build' };
    return { text: '초월할 준비가 되었습니다 — 설정 탭에서 초월하세요', target: 'settings' };
  }

  function updateChrome(st) {
    const goal = goalHint(st);
    const hc = $('hint-chip');
    hc.textContent = goal.text;
    hc.dataset.target = goal.target || '';
    const av = $('avatar');
    const avIcon = st.phase === 'evolution' ? 'cell'
      : st.wonderSeg >= DATA.wonder.segments ? 'temple' : 'user';
    if (av.dataset.icon !== avIcon) {
      av.dataset.icon = avIcon;
      av.textContent = '';
      av.append(icon(avIcon, 20));
    }
    // 진화 단계에서는 연구/인구 탭 숨김, 건설 탭 라벨은 '진화'
    document.querySelectorAll('.side-btn').forEach((b) => {
      const t = b.dataset.tab;
      if (t === 'research' || t === 'people')
        b.style.display = st.phase === 'evolution' ? 'none' : '';
      if (t === 'build') {
        const lbl = b.querySelector('.side-label');
        const name = st.phase === 'evolution' ? '진화' : '건설';
        if (lbl && lbl.textContent !== name) lbl.textContent = name;
        b.title = name;
        b.setAttribute('aria-label', name);
      }
    });
    // 카드의 건설 이동 버튼: 건설 탭에서만 숨김
    const pfm = $('pf-manage');
    pfm.textContent = st.phase === 'evolution' ? '진화 관리' : '건설 관리';
    pfm.style.display = activeTab === 'build' ? 'none' : '';
    // 미확인 업적 점 배지
    const achBtn = document.querySelector('.side-btn[data-tab="ach"]');
    if (achBtn)
      achBtn.classList.toggle('has-dot', Object.keys(st.ach || {}).length > achSeen);
  }

  let overlayCb = null;
  let overlayPrevFocus = null;

  function showOverlay(icn, title, desc, btnText, cb) {
    const oi = $('overlay-icon');
    oi.textContent = '';
    oi.append(icon(icn, 40));
    $('overlay-title').textContent = title;
    $('overlay-desc').textContent = desc;
    $('overlay-btn').textContent = btnText;
    overlayCb = cb;
    overlayPrevFocus = document.activeElement;
    $('overlay').hidden = false;
    $('overlay-btn').focus();
  }

  // Esc = 취소(콜백 미실행), 버튼 = 실행. 닫을 때 이전 포커스 복원.
  function closeOverlay(runCb) {
    $('overlay').hidden = true;
    const cb = overlayCb;
    overlayCb = null;
    if (overlayPrevFocus && overlayPrevFocus.isConnected) overlayPrevFocus.focus();
    overlayPrevFocus = null;
    if (runCb && cb) cb();
  }

  /* ================================================================
   * 갱신 루프 진입점
   * ================================================================ */

  let lastRates = { prod: {}, cons: {} };

  function afterAction(evts) {
    log(evts);
    for (const e of evts) {
      if (e.kind === 'wonder' && e.title.indexOf('완공') >= 0) {
        showOverlay('temple', '대신전 완공',
          '문명의 정점에 도달했습니다.\n설정 탭에서 초월하여 다음 회차를 준비할 수 있습니다.',
          '확인', null);
      }
    }
    // 재구축 여부는 update()의 structureSig 비교에 맡긴다 —
    // 무조건 재구축하면 방금 클릭한 버튼이 파괴되어 키보드 포커스가 유실된다.
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
    // 어느 탭이든 '내 문명' 카드가 따라다니므로 대시보드 값은 항상 갱신
    updateDashboard(st, rt);
    if (activeTab === 'settings') updateSettingsTab(st);
    if (activeTab === 'build') updateBuildTab(st);
    if (activeTab === 'research') updateResearchTab(st);
    if (activeTab === 'people') updatePeopleTab(st);
  }

  // 1초 주기 갱신(차트/기록처럼 무거운 것)
  function updateSlow(st) {
    if (activeTab === 'dash') renderChart(st);
    if (activeTab === 'records') renderRecordsTab(st, lastRates);
    if (activeTab === 'ach') renderAchTab(st);
  }

  /* ---------- 초기 바인딩 ---------- */

  function init() {
    document.querySelectorAll('.side-btn').forEach((b) =>
      b.addEventListener('click', () => switchTab(b.dataset.tab, G.state)));
    document.querySelectorAll('[data-goto]').forEach((b) =>
      b.addEventListener('click', () => {
        switchTab(b.dataset.goto, G.state);
        // data-focus = 탭 안의 특정 카드로 바로 스크롤 (예: 가속 자원 → 자원 증감)
        if (b.dataset.focus) {
          const t = document.getElementById(b.dataset.focus);
          if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }));
    // 오버레이 Esc/Tab 처리 (document 레벨 — 포커스 위치와 무관하게 동작)
    document.addEventListener('keydown', (ev) => {
      if ($('overlay').hidden) return;
      if (ev.key === 'Escape') { ev.preventDefault(); closeOverlay(false); }
      else if (ev.key === 'Tab') { ev.preventDefault(); $('overlay-btn').focus(); }
    });
    // 카드 바깥(어두운 배경) 클릭·터치 = Esc와 동일하게 취소
    $('overlay').addEventListener('click', (ev) => {
      if (ev.target === $('overlay')) closeOverlay(false);
    });
    $('chart-ranges').querySelectorAll('.chip').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.classList.contains('is-active')));
      chip.addEventListener('click', () => {
        chartRange = Number(chip.dataset.range);
        $('chart-ranges').querySelectorAll('.chip').forEach((c) => {
          c.classList.toggle('is-active', c === chip);
          c.setAttribute('aria-pressed', String(c === chip));
        });
        renderChart(G.state);
      });
    });
    const wrap = $('chart-wrap');
    wrap.addEventListener('pointermove', chartHover);
    wrap.addEventListener('pointerleave', chartLeave);
    $('btn-save').addEventListener('click', () => {
      flashBtn($('btn-save'), G.save() ? '저장됨!' : '저장 실패');
    });
    // 힌트 칩 클릭 → 해당 화면으로 이동
    $('hint-chip').addEventListener('click', () => {
      const t = $('hint-chip').dataset.target;
      if (t) switchTab(t, G.state);
    });
    $('overlay-btn').addEventListener('click', () => closeOverlay(true));
  }

  return {
    init, update, updateSlow, markDirty, log, switchTab, setChartMetric,
    pushHist, pushHeat, rotateHeat, resetCharts, showOverlay,
    fmt, fmtRate, fmtDur,
  };
})();

if (typeof window !== 'undefined') window.UI = UI;
