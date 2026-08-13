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
  let syncT = 0;   // 클라우드 자동 업로드 타이머
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

  /* ---------- 클라우드 동기화 ---------- */

  function cloudUp() {
    return Sync.syncUp(Engine.serialize(state));
  }

  /* 로그인/복원 직후 첫 동기화. 예전에는 무조건 업로드해서 새 기기에서
   * 로그인하면 클라우드 저장을 빈 진행으로 덮어썼다 — 먼저 내려받아 비교한다.
   * interactive: 로그인 버튼 경로. 클라우드 저장이 있으면 항상 물어본다
   * (새 기기의 방금 만든 상태가 타임스탬프상 더 "최신"일 수 있어서).
   * 조용한 복원 경로에서는 클라우드가 확실히 최신일 때만 묻는다. */
  function cloudSmartSync(interactive) {
    return Sync.syncDown().then((text) => {
      let cloud = null;
      if (text) { try { cloud = Engine.deserialize(text); } catch (e) {} }
      const newer = cloud && cloud.lastSave > state.lastSave + 2000;
      if (cloud && (interactive || newer)) {
        const ageMin = Math.max(0, Math.round((Date.now() - cloud.lastSave) / 60000));
        UI.showOverlay('download', '클라우드 저장 발견',
          `클라우드 저장: 약 ${ageMin}분 전 업로드${newer ? ' (이 기기보다 최신)' : ''}.\n`
          + '불러오면 이 기기의 진행을 덮어씁니다.\n'
          + 'Esc를 누르면 이 기기의 진행을 유지하고, 이후 자동 업로드가 클라우드를 덮어씁니다.',
          '불러온다', () => { replaceState(cloud); });
      } else {
        cloudUp();
      }
    });
  }

  function cloudDown() {
    return Sync.syncDown().then((text) => {
      if (!text) {
        UI.showOverlay('download', '클라우드 저장 없음',
          '클라우드에 저장된 데이터가 없습니다.\n먼저 「지금 업로드」로 올려두세요.', '확인', null);
        return;
      }
      let cloudState = null;
      try { cloudState = Engine.deserialize(text); } catch (e) {}
      if (!cloudState) {
        UI.showOverlay('alert', '불러오기 실패',
          '클라우드 저장 데이터를 읽을 수 없습니다.', '확인', null);
        return;
      }
      const ageMin = Math.max(0, Math.round((Date.now() - cloudState.lastSave) / 60000));
      const newer = cloudState.lastSave >= state.lastSave;
      UI.showOverlay('download', '클라우드에서 불러오기',
        `클라우드 저장: 약 ${ageMin}분 전 업로드.\n현재 기기의 진행을 덮어씁니다.`
        + (newer ? '' : '\n주의: 현재 기기 저장이 더 최신입니다.'),
        '불러온다', () => { replaceState(cloudState); });
    });
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
    Engine.checkAchievements(state, evts);

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
      UI.switchTab('dash', state); // 드로어를 닫고 채집 버튼이 보이는 대시보드로
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
    // 5분 주기: 클라우드 자동 업로드 (로그인 시)
    syncT += dt;
    if (syncT >= 300) {
      syncT = 0;
      if (Sync.signedIn()) cloudUp();
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

    // 딥링크: #build/#research/#people = 드로어, #ach/#records/#settings = 메인 탭,
    //         #hl=자원id = 차트 하이라이트
    const hash = location.hash.slice(1);
    if (hash === 'build' || hash === 'ach' || hash === 'records' || hash === 'settings' ||
        (state.phase === 'civ' && (hash === 'research' || hash === 'people')))
      UI.switchTab(hash, state);
    const hl = hash.match(/^hl=([a-z]+)$/);
    if (hl) UI.setChartMetric(hl[1]);

    // 이전에 로그인해 쓰던 계정이면 조용히 복원 — 성공하면 첫 동기화까지.
    // (state.lastSave는 이 시점엔 아직 "지난 방문의 마지막 저장 시각"이라
    //  다른 기기에서 올린 클라우드 저장과 올바르게 비교된다)
    if (Sync.available() && Sync.hasSession())
      Sync.restore().then((ok) => { if (ok) cloudSmartSync(false); });

    lastTick = performance.now();
    setInterval(loop, 250);
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        save();
        if (Sync.signedIn()) cloudUp(); // 떠날 때 클라우드에도 반영
      }
    });
  }

  return {
    get state() { return state; },
    boot, save, replaceState, doAscend, hardReset, cloudUp, cloudDown, cloudSmartSync,
  };
})();

G.boot();
