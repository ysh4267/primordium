/* =========================================================
 * PRIMORDIUM — 게임 엔진 (순수 로직, DOM 의존성 없음)
 * UI와 헤드리스 시뮬레이션이 동일하게 사용한다.
 * ========================================================= */
'use strict';

const Engine = (() => {
  const C = DATA.const;

  /* ---------- 상태 ---------- */

  function newState(essence = 0, ascensions = 0, lifetime = null) {
    const res = {};
    for (const id in DATA.resources) res[id] = 0;
    const evo = {};
    for (const id in DATA.evolutions) evo[id] = 0;
    const buildings = {};
    for (const id in DATA.buildings) buildings[id] = 0;
    const jobs = {};
    for (const id in DATA.jobs) jobs[id] = 0;
    return {
      v: 1,
      phase: 'evolution',
      essence, ascensions,
      res, evo, buildings, jobs,
      evoChain: 0,
      techs: {},
      ach: {},             // 업적 id → 달성 시각(ms). 초월해도 유지.
      wonderSeg: 0,
      pop: 0,
      growthT: 0,
      starveT: 0,
      stats: {
        cumKnow: 0,        // 이번 회차 누적 지식 (정수 계산용)
        actions: 0,        // 총 행동(클릭+구매+연구)
        clicks: 0,
        starved: 0,        // 기아 사망 누계 (업적용)
        playSec: 0,
        startedAt: lifetime ? lifetime.startedAt : Date.now(),
      },
      lastSave: Date.now(),
    };
  }

  /* ---------- 배수 ---------- */

  const essenceMult = (st) => 1 + st.essence * C.essencePerBonus;

  function jobMult(st, job) {
    let m = essenceMult(st);
    const t = st.techs;
    if (job === 'lumberjack' || job === 'mason' || job === 'miner') {
      if (t.tools) m *= 1.3;
      if (t.bronze) m *= 1.4;
    }
    if (job === 'farmer' && t.irrigation) m *= 1.5;
    if (job === 'scholar') {
      if (t.scholarship) m *= 1.5;
      m *= 1 + 0.08 * st.buildings.library;
    }
    if (job === 'merchant' && t.trade) m *= 1.75;
    return m;
  }

  const clickPower = (st) =>
    C.clickBase * (st.techs.tools ? 2 : 1) * essenceMult(st);

  /* ---------- 한도 ---------- */

  function caps(st) {
    const b = st.buildings;
    const chainBonus = st.evoChain >= 1 ? 50 : 0;
    return {
      rna: DATA.resources.rna.baseCap + st.evo.membrane * 45 + chainBonus,
      dna: DATA.resources.dna.baseCap + st.evo.eukaryote * 40 + chainBonus,
      food: DATA.resources.food.baseCap + b.farm * 25 + b.shed * 90,
      lumber: DATA.resources.lumber.baseCap + b.shed * 120,
      stone: DATA.resources.stone.baseCap + b.shed * 120,
      copper: DATA.resources.copper.baseCap + b.shed * 50,
      iron: DATA.resources.iron.baseCap + b.shed * 50,
      know: DATA.resources.know.baseCap + b.sundial * 25 + b.school * 60 + b.library * 120,
      coins: DATA.resources.coins.baseCap + b.market * 100,
      pop: b.hut * 2 + b.house * 5,
    };
  }

  /* ---------- 일자리 ---------- */

  function slots(st, job) {
    const def = DATA.jobs[job];
    return st.buildings[def.slotFrom] * def.perSlot;
  }

  function assignedTotal(st) {
    let n = 0;
    for (const j in st.jobs) n += st.jobs[j];
    return n;
  }

  const freeCitizens = (st) => st.pop - assignedTotal(st);

  // 기아/정합성 해소용 해고 — 농부는 최후에 해고해 '죽음의 나선'을 막는다
  function fireOne(st) {
    let pick = null;
    for (const j in st.jobs) {
      if (j === 'farmer' || st.jobs[j] <= 0) continue;
      if (!pick || st.jobs[j] > st.jobs[pick]) pick = j;
    }
    if (!pick && st.jobs.farmer > 0) pick = 'farmer';
    if (!pick) return false;
    st.jobs[pick] -= 1;
    return true;
  }

  function assign(st, job, delta) {
    if (delta > 0) {
      const can = Math.min(delta, freeCitizens(st), slots(st, job) - st.jobs[job]);
      if (can > 0) st.jobs[job] += can;
      return can > 0;
    }
    const cut = Math.min(-delta, st.jobs[job]);
    if (cut > 0) st.jobs[job] -= cut;
    return cut > 0;
  }

  /* ---------- 생산율 ---------- */

  // prod: 양(+) 생산만, cons: 소비만. UI/히트맵/틱이 공유.
  function rates(st) {
    const prod = {}, cons = {};
    for (const id in DATA.resources) { prod[id] = 0; cons[id] = 0; }

    if (st.phase === 'evolution') {
      const orgRate = st.evo.organelle * 0.7 * (1 + 0.25 * st.evo.mito) * essenceMult(st);
      prod.rna += orgRate;
      // 핵: RNA 1.4/s → DNA 0.7/s ×정수 (재고 기반 제한은 tick에서 처리)
      cons.rna += st.evo.nucleus * 1.4;
      prod.dna = st.evo.nucleus * 0.7 * essenceMult(st);
      return { prod, cons };
    }

    for (const j in DATA.jobs) {
      const n = st.jobs[j];
      if (!n) continue;
      const m = jobMult(st, j);
      for (const r in DATA.jobs[j].out) prod[r] += DATA.jobs[j].out[r] * n * m;
      if (j === 'miner' && st.techs.ironwork) prod.iron += 0.15 * n * m;
    }
    prod.know += st.buildings.sundial * 0.3 * (st.techs.calendar ? 2 : 1) * essenceMult(st);
    cons.food += st.pop * C.eatPerCitizen;
    return { prod, cons };
  }

  /* ---------- 틱 ---------- */

  function tick(st, dt, evts) {
    if (!(dt > 0)) return;
    const cap = caps(st);
    const { prod, cons } = rates(st);

    if (st.phase === 'evolution') {
      st.res.rna = Math.min(cap.rna, st.res.rna + prod.rna * dt);
      // 핵 변환: 실제 RNA 재고만큼만
      const want = cons.rna * dt;
      const got = Math.min(want, st.res.rna);
      if (want > 0) {
        st.res.rna -= got;
        st.res.dna = Math.min(cap.dna, st.res.dna + got * 0.5 * essenceMult(st));
      }
    } else {
      const knowBefore = st.res.know;
      for (const r in st.res) {
        if (r === 'rna' || r === 'dna') continue;
        const net = (prod[r] - cons[r]) * dt;
        st.res[r] = Math.max(0, Math.min(cap[r], st.res[r] + net));
      }
      // 정수 계산용 누적 지식: 실제로 저장된 양만 집계 (한도에 막히면 누적 중단 — 방치 파밍 방지)
      st.stats.cumKnow += Math.max(0, st.res.know - knowBefore);

      // 인구 성장
      const netFood = prod.food - cons.food;
      if (st.pop < cap.pop && st.res.food > 1) {
        st.growthT += dt;
        const need = C.growthTime * (st.techs.calendar ? 0.85 : 1);
        if (st.growthT >= need) {
          st.growthT = 0;
          st.pop += 1;
          if (evts) evts.push({ kind: 'pop', title: '인구 증가', sub: `시민 ${st.pop}명` });
        }
      } else st.growthT = 0;

      // 기아
      if (st.res.food <= 0 && netFood < 0 && st.pop > 0) {
        st.starveT += dt;
        if (st.starveT >= C.starveTime) {
          st.starveT = 0;
          st.pop -= 1;
          st.stats.starved += 1;
          // 배정 인원이 인구를 넘으면 해제 (농부 보호 순서)
          while (assignedTotal(st) > st.pop) { if (!fireOne(st)) break; }
          if (evts) evts.push({ kind: 'warn', title: '기아 발생', sub: `시민 1명 사망 — 식량을 확보하세요` });
        }
      } else st.starveT = 0;
    }
    st.stats.playSec += dt;
  }

  /* ---------- 클릭 행동 ---------- */

  function clickRNA(st) {
    const cap = caps(st);
    st.res.rna = Math.min(cap.rna, st.res.rna + 1 * essenceMult(st));
    st.stats.clicks++; st.stats.actions++;
  }

  function clickDNA(st) {
    if (st.res.rna < 2) return false;
    const cap = caps(st);
    st.res.rna -= 2;
    st.res.dna = Math.min(cap.dna, st.res.dna + 1 * essenceMult(st));
    st.stats.clicks++; st.stats.actions++;
    return true;
  }

  function gather(st, r) {
    if (r !== 'food' && r !== 'lumber' && r !== 'stone') return;
    const cap = caps(st);
    st.res[r] = Math.min(cap[r], st.res[r] + clickPower(st));
    st.stats.clicks++; st.stats.actions++;
  }

  /* ---------- 구매: 진화 ---------- */

  function evoCost(st, id) {
    const def = DATA.evolutions[id];
    const out = {};
    for (const r in def.cost)
      out[r] = Math.ceil(def.cost[r] * Math.pow(def.mult, st.evo[id]));
    return out;
  }

  function canPay(st, cost) {
    for (const r in cost) if (st.res[r] < cost[r]) return false;
    return true;
  }

  function pay(st, cost) {
    for (const r in cost) st.res[r] -= cost[r];
  }

  function buyEvo(st, id, evts) {
    const cost = evoCost(st, id);
    if (!canPay(st, cost)) return false;
    pay(st, cost);
    st.evo[id]++;
    st.stats.actions++;
    if (evts) evts.push({ kind: 'build', title: DATA.evolutions[id].name, sub: `${st.evo[id]}번째 획득` });
    return true;
  }

  function chainNext(st) {
    return st.evoChain < DATA.evoChain.length ? DATA.evoChain[st.evoChain] : null;
  }

  function buyChain(st, evts) {
    const step = chainNext(st);
    if (!step || !canPay(st, step.cost)) return false;
    pay(st, step.cost);
    st.evoChain++;
    st.stats.actions++;
    if (evts) evts.push({ kind: 'phase', title: `진화 — ${step.name}`, sub: step.desc });
    if (step.id === 'sentience') startCiv(st, evts);
    return true;
  }

  function startCiv(st, evts) {
    st.phase = 'civ';
    st.res.food = 25; // 초기 비축분
    if (evts) evts.push({ kind: 'phase', title: '문명의 시작', sub: '인류가 깨어났습니다' });
  }

  /* ---------- 구매: 건물/연구/불가사의 ---------- */

  function bCost(st, id) {
    const def = DATA.buildings[id];
    const out = {};
    for (const r in def.cost)
      out[r] = Math.ceil(def.cost[r] * Math.pow(def.mult, st.buildings[id]));
    return out;
  }

  function buildingVisible(st, id) {
    const def = DATA.buildings[id];
    return !def.needsTech || !!st.techs[def.needsTech];
  }

  function buyBuilding(st, id, evts) {
    if (!buildingVisible(st, id)) return false;
    const cost = bCost(st, id);
    if (!canPay(st, cost)) return false;
    pay(st, cost);
    st.buildings[id]++;
    st.stats.actions++;
    if (evts) evts.push({ kind: 'build', title: `${DATA.buildings[id].name} 건설`, sub: `보유 ${st.buildings[id]}` });
    return true;
  }

  function techVisible(st, id) {
    const def = DATA.techs[id];
    if (st.techs[id]) return true;
    if (def.needs) for (const n of def.needs) if (!st.techs[n]) return false;
    return true;
  }

  function research(st, id, evts) {
    const def = DATA.techs[id];
    if (st.techs[id] || !techVisible(st, id) || !canPay(st, def.cost)) return false;
    pay(st, def.cost);
    st.techs[id] = true;
    st.stats.actions++;
    if (evts) evts.push({ kind: 'tech', title: `연구 완료 — ${def.name}`, sub: def.desc });
    return true;
  }

  function wonderVisible(st) {
    return !!st.techs[DATA.wonder.needsTech];
  }

  function buyWonderSeg(st, evts) {
    if (!wonderVisible(st) || st.wonderSeg >= DATA.wonder.segments) return false;
    if (!canPay(st, DATA.wonder.segCost)) return false;
    pay(st, DATA.wonder.segCost);
    st.wonderSeg++;
    st.stats.actions++;
    if (evts) {
      if (st.wonderSeg >= DATA.wonder.segments)
        evts.push({ kind: 'wonder', title: '대신전 완공!', sub: '초월이 열렸습니다' });
      else
        evts.push({ kind: 'wonder', title: '대신전 건설', sub: `진행 ${st.wonderSeg}/${DATA.wonder.segments}` });
    }
    return true;
  }

  /* ---------- 초월 ---------- */

  const canAscend = (st) => st.wonderSeg >= DATA.wonder.segments;

  function essenceGain(st) {
    return 2 + Math.floor(Math.sqrt(st.stats.cumKnow / 300));
  }

  function ascend(st, evts) {
    if (!canAscend(st)) return null;
    const gained = essenceGain(st);
    const next = newState(st.essence + gained, st.ascensions + 1, st.stats);
    next.ach = st.ach; // 업적은 초월을 넘어 유지
    if (evts) evts.push({ kind: 'ascend', title: '초월', sub: `정수 +${gained} (총 ${next.essence})` });
    return next;
  }

  /* ---------- 업적 ---------- */

  function checkAchievements(st, evts) {
    let gained = 0;
    for (const d of DATA.achievements) {
      if (st.ach[d.id]) continue;
      let ok = false;
      try { ok = !!d.when(st); } catch (e) { /* 조건 오류는 미달성 취급 */ }
      if (ok) {
        st.ach[d.id] = Date.now();
        gained++;
        if (evts) evts.push({ kind: 'ach', title: `업적 달성 — ${d.name}`, sub: d.desc });
      }
    }
    return gained;
  }

  /* ---------- 오프라인 진행 ---------- */

  function applyOffline(st, elapsedSec, evts) {
    const t = Math.min(Math.max(0, elapsedSec), C.offlineCapSec);
    if (t < 5) return null;
    const before = Object.assign({}, st.res);
    // 온라인 루프와 동일하게 1초 이하 청크 — 성장/기아/한도 로직이 왜곡되지 않게
    const steps = Math.max(1, Math.ceil(t));
    for (let i = 0; i < steps; i++) tick(st, t / steps, null);
    const gains = {};
    for (const r in st.res) {
      const d = st.res[r] - before[r];
      if (d > 0.5) gains[r] = d;
    }
    if (evts) evts.push({
      kind: 'gain', title: '오프라인 진행',
      sub: `${Math.round(t / 60)}분 동안의 수확`,
    });
    return { sec: t, gains };
  }

  /* ---------- 저장/불러오기 ---------- */

  const serialize = (st) => JSON.stringify(Object.assign({}, st, { lastSave: Date.now() }));

  const isPlainObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // 저장본에 없는 필드는 기본값으로 채운다(버전 이행 안전).
  // 알려진 키만, 순수 객체 구조만 병합한다 — __proto__ 오염·타입 붕괴 차단.
  function deserialize(str) {
    const raw = JSON.parse(str);
    const st = newState();
    if (isPlainObj(raw)) {
      merge(st, raw);
      // techs/ach는 키가 열려 있으므로 별도 화이트리스트 복사
      if (isPlainObj(raw.techs)) {
        st.techs = {};
        for (const k in raw.techs) {
          if (!hasOwn(raw.techs, k)) continue;
          if (DATA.techs[k] && raw.techs[k]) st.techs[k] = true;
        }
      }
      if (isPlainObj(raw.ach)) {
        st.ach = {};
        const known = {};
        for (const d of DATA.achievements) known[d.id] = true;
        for (const k in raw.ach) {
          if (!hasOwn(raw.ach, k)) continue;
          if (known[k] && raw.ach[k]) {
            const t = Number(raw.ach[k]);
            st.ach[k] = isFinite(t) && t > 0 ? t : Date.now();
          }
        }
      }
    }
    sanitize(st);
    return st;
  }

  function merge(base, patch) {
    for (const k in patch) {
      if (!hasOwn(patch, k)) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (!hasOwn(base, k)) continue; // 알려진 필드만
      const bv = base[k], pv = patch[k];
      if (isPlainObj(bv)) {
        if (isPlainObj(pv)) merge(bv, pv); // 컨테이너 자리에 스칼라/배열/null 거부
      } else if (pv === null || typeof pv !== 'object') {
        base[k] = pv; // 스칼라 자리에 객체 거부
      }
    }
  }

  const numOr0 = (v, max) => {
    v = Number(v);
    if (!isFinite(v) || v < 0) return 0;
    return max !== undefined && v > max ? max : v;
  };
  const intOr0 = (v, max) => Math.floor(numOr0(v, max));

  // caps() 계산 **이전에** 모든 입력을 유한 비음수로 강제한 뒤 클램프한다.
  function sanitize(st) {
    const fresh = newState();
    for (const k of ['res', 'evo', 'buildings', 'jobs', 'stats', 'techs', 'ach']) {
      if (!isPlainObj(st[k])) st[k] = fresh[k];
    }
    // 알 수 없는 키 제거 + 숫자 강제
    for (const id in st.evo) if (!DATA.evolutions[id]) delete st.evo[id];
    for (const id in st.buildings) if (!DATA.buildings[id]) delete st.buildings[id];
    for (const r in st.res) if (!DATA.resources[r]) delete st.res[r];
    for (const j in st.jobs) if (!DATA.jobs[j]) delete st.jobs[j];
    for (const id in DATA.evolutions) st.evo[id] = intOr0(st.evo[id], 1e6);
    for (const id in DATA.buildings) st.buildings[id] = intOr0(st.buildings[id], 1e6);
    for (const j in DATA.jobs) st.jobs[j] = intOr0(st.jobs[j], 1e6);
    for (const id in st.techs) st.techs[id] = !!st.techs[id];
    st.phase = st.phase === 'civ' ? 'civ' : 'evolution';
    st.evoChain = intOr0(st.evoChain, DATA.evoChain.length);
    st.wonderSeg = intOr0(st.wonderSeg, DATA.wonder.segments);
    st.essence = intOr0(st.essence, 1e6);
    st.ascensions = intOr0(st.ascensions, 1e6);
    st.pop = intOr0(st.pop, 1e9);
    st.growthT = numOr0(st.growthT, 3600);
    st.starveT = numOr0(st.starveT, 3600);
    st.stats.cumKnow = numOr0(st.stats.cumKnow, 1e15);
    st.stats.actions = intOr0(st.stats.actions, 1e15);
    st.stats.clicks = intOr0(st.stats.clicks, 1e15);
    st.stats.starved = intOr0(st.stats.starved, 1e15);
    st.stats.playSec = numOr0(st.stats.playSec, 1e12);
    st.stats.startedAt = numOr0(st.stats.startedAt) || Date.now();
    st.lastSave = numOr0(st.lastSave) || Date.now();
    // 이제 caps는 유한값 — 안전하게 클램프
    const cap = caps(st);
    for (const r in DATA.resources) {
      st.res[r] = numOr0(st.res[r], isFinite(cap[r]) ? cap[r] : 0);
    }
    st.pop = Math.min(st.pop, cap.pop);
    for (const j in DATA.jobs) st.jobs[j] = Math.min(st.jobs[j], slots(st, j));
    while (assignedTotal(st) > st.pop) { if (!fireOne(st)) break; }
    return st;
  }

  return {
    newState, caps, slots, rates, tick, assign, freeCitizens, assignedTotal,
    essenceMult, jobMult, clickPower,
    clickRNA, clickDNA, gather,
    evoCost, buyEvo, chainNext, buyChain,
    bCost, buildingVisible, buyBuilding,
    techVisible, research, canPay,
    wonderVisible, buyWonderSeg,
    canAscend, essenceGain, ascend, checkAchievements,
    applyOffline, serialize, deserialize, sanitize,
  };
})();

if (typeof window !== 'undefined') window.Engine = Engine;
