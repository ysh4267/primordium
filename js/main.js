/* =========================================================
 * PRIMORDIUM — 부트스트랩 & 게임 루프
 * ========================================================= */
'use strict';

const G = (() => {
  const KEY = 'primordium-save';
  let state = null;
  let lastTick = 0;
  let histT = 0;   // 1초 히스토리 타이머
  let heatT = 0;   // 10초 히트맵 타이머
  let saveT = 0;   // 자동 저장 타이머
  let prevPhase = null;

  /* ---------- 저장 ---------- */

  function save() {
    try {
      localStorage.setItem(KEY, Engine.serialize(state));
    } catch (e) { /* 저장 공간 문제 등 — 게임은 계속 */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Engine.deserialize(raw);
    } catch (e) { /* 손상된 저장 → 새 게임 */ }
    return null;
  }

  /* ---------- 상태 교체 ---------- */

  function replaceState(st) {
    state = st;
    prevPhase = st.phase;
    UI.resetCharts();
    UI.markDirty();
    UI.update(state, Engine.rates(state));
    save();
  }

  function doAscend() {
    const evts = [];
    const next = Engine.ascend(state, evts);
    if (!next) return;
    state = next;
    prevPhase = state.phase;
    UI.resetCharts();
    UI.markDirty();
    UI.log(evts);
    UI.switchTab('dash', state);
    UI.update(state, Engine.rates(state));
    save();
    UI.showOverlay('🦠', '새로운 시작',
      `정수의 힘이 원시 수프에 스며듭니다.\n모든 생산 +${state.essence * 5}% 상태로 다시 진화를 시작합니다.`,
      '진화 시작', null);
  }

  function hardReset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    state = Engine.newState();
    prevPhase = state.phase;
    UI.resetCharts();
    UI.markDirty();
    UI.switchTab('dash', state);
    UI.update(state, Engine.rates(state));
  }

  /* ---------- 루프 ---------- */

  function loop() {
    const now = performance.now();
    let dt = (now - lastTick) / 1000;
    lastTick = now;
    if (!(dt > 0)) return;
    if (dt > 3600) dt = 3600; // 비활성 탭 장시간 방치 보호

    const evts = [];
    // 큰 dt는 1초 단위로 쪼개어 한도/기아 로직이 올바르게 동작하게 한다
    let remain = dt;
    while (remain > 0) {
      const step = Math.min(1, remain);
      Engine.tick(state, step, evts);
      remain -= step;
    }

    // 히트맵: 이번 틱의 총 생산량 적산
    const rt = Engine.rates(state);
    let prodSum = 0;
    for (const r in rt.prod) prodSum += rt.prod[r];
    UI.pushHeat(prodSum, dt);

    // 단계 전환 감지
    if (state.phase !== prevPhase) {
      prevPhase = state.phase;
      UI.resetCharts();
      UI.markDirty();
      UI.showOverlay('🧠', '지성 획득',
        '수십억 년의 진화 끝에, 인류가 깨어났습니다.\n이제 부족을 이끌고 문명을 세우세요.',
        '문명 시작', null);
    }
    for (const e of evts) {
      if (e.kind === 'wonder' && e.title.indexOf('완공') >= 0) {
        UI.showOverlay('🏛️', '대신전 완공',
          '문명의 정점에 도달했습니다.\n설정 탭에서 초월하여 다음 회차를 준비할 수 있습니다.',
          '확인', null);
      }
    }

    UI.log(evts);

    // 1초 주기: 히스토리 + 느린 렌더
    histT += dt;
    if (histT >= 1) {
      histT = 0;
      UI.pushHist(state);
      UI.updateSlow(state);
    }
    // 10초 주기: 히트맵 회전
    heatT += dt;
    if (heatT >= DATA.const.heatBucketSec) {
      heatT -= DATA.const.heatBucketSec;
      UI.rotateHeat();
    }
    // 15초 주기: 자동 저장
    saveT += dt;
    if (saveT >= 15) {
      saveT = 0;
      save();
    }

    UI.update(state, rt);
  }

  /* ---------- 부트 ---------- */

  function boot() {
    state = load() || Engine.newState();
    prevPhase = state.phase;

    UI.init();

    // 오프라인 진행
    const evts = [];
    if (state.lastSave) {
      const off = Engine.applyOffline(state, (Date.now() - state.lastSave) / 1000, evts);
      if (off && evts.length) {
        const parts = [];
        for (const r in off.gains)
          parts.push(`${DATA.resources[r].name} +${UI.fmt(off.gains[r])}`);
        if (parts.length)
          evts[evts.length - 1].sub += ' — ' + parts.slice(0, 4).join(' · ');
      }
    }
    UI.log(evts);
    UI.update(state, Engine.rates(state));
    UI.pushHist(state);

    lastTick = performance.now();
    setInterval(loop, 250);
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') save();
    });
  }

  return {
    get state() { return state; },
    boot, save, replaceState, doAscend, hardReset,
  };
})();

G.boot();
