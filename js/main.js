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
      return true;
    } catch (e) {
      return false; // 저장 공간/프라이빗 모드 등 — 게임은 계속, UI가 실패를 표시
    }
  }

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      if (raw) return Engine.deserialize(raw);
    } catch (e) {
      // 손상된 저장 → 원본을 백업해 두고 새 게임 (자동저장이 덮어쓰기 전에 보존)
      try { if (raw) localStorage.setItem(KEY + '-corrupt', raw); } catch (e2) {}
    }
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
    UI.showOverlay('cell', '새로운 시작',
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
      UI.showOverlay('user', '지성 획득',
        '수십억 년의 진화 끝에, 인류가 깨어났습니다.\n이제 부족을 이끌고 문명을 세우세요.',
        '문명 시작', null);
    }

    UI.log(evts);

    // 1초 주기: 히스토리 + 느린 렌더
    histT += dt;
    if (histT >= 1) {
      histT = 0;
      UI.pushHist(state);
      UI.updateSlow(state);
    }
    // 10초 주기: 히트맵 회전 (큰 dt는 한 번에 소진하며 균등 분배)
    heatT += dt;
    const rotations = Math.floor(heatT / DATA.const.heatBucketSec);
    if (rotations > 0) {
      heatT -= rotations * DATA.const.heatBucketSec;
      UI.rotateHeat(rotations);
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
      if (off) {
        const parts = [];
        for (const r in off.gains)
          parts.push(`${DATA.resources[r].name} +${UI.fmt(off.gains[r])}`);
        if (parts.length && evts.length)
          evts[evts.length - 1].sub += ' — ' + parts.slice(0, 4).join(' · ');
        save(); // 즉시 저장 — 비정상 종료 시 오프라인 보상 중복 지급 방지
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
