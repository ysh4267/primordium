/* =========================================================
 * PRIMORDIUM — 게임 정의 데이터 (순수 데이터, 로직 없음)
 * icon 필드는 ui.js의 SVG 아이콘 레지스트리 키.
 * ========================================================= */
'use strict';

const DATA = {

  /* ---------- 자원 ---------- */
  resources: {
    // 진화 단계
    rna:    { name: 'RNA',  icon: 'rna',      phase: 'evolution', baseCap: 120 },
    dna:    { name: 'DNA',  icon: 'dna',      phase: 'evolution', baseCap: 100 },
    // 문명 단계
    food:   { name: '식량', icon: 'wheat',    phase: 'civ', baseCap: 240 },
    lumber: { name: '목재', icon: 'tree',     phase: 'civ', baseCap: 200 },
    stone:  { name: '석재', icon: 'stone',    phase: 'civ', baseCap: 200 },
    copper: { name: '구리', icon: 'ingot',    phase: 'civ', baseCap: 100, needsTech: 'mining' },
    iron:   { name: '철',   icon: 'gear',     phase: 'civ', baseCap: 100, needsTech: 'ironwork' },
    know:   { name: '지식', icon: 'scroll',   phase: 'civ', baseCap: 100 },
    coins:  { name: '화폐', icon: 'coin',     phase: 'civ', baseCap: 250, needsTech: 'currency' },
  },

  /* ---------- 진화 단계: 반복 구매 ---------- */
  evolutions: {
    membrane:  { name: '세포막',       icon: 'membrane',  desc: 'RNA 저장 한도 +45',          cost: { rna: 2 },  mult: 1.18 },
    organelle: { name: '세포소기관',   icon: 'organelle', desc: 'RNA +0.7/s',                 cost: { rna: 12 }, mult: 1.22 },
    nucleus:   { name: '핵',           icon: 'nucleus',   desc: 'RNA 1.4/s → DNA 0.7/s 변환', cost: { dna: 5 },  mult: 1.25 },
    eukaryote: { name: '진핵세포',     icon: 'eukaryote', desc: 'DNA 저장 한도 +40',          cost: { dna: 8 },  mult: 1.30 },
    mito:      { name: '미토콘드리아', icon: 'mito',      desc: '세포소기관 효율 +25%',       cost: { dna: 22 }, mult: 1.35 },
  },

  /* ---------- 진화 단계: 1회성 진화 사슬 ---------- */
  evoChain: [
    { id: 'multicell', name: '다세포화',  desc: 'RNA/DNA 한도 +50, 다음 진화 개방', cost: { dna: 55 } },
    { id: 'sense',     name: '감각 기관', desc: '외부 자극 감지, 다음 진화 개방',    cost: { dna: 85 } },
    { id: 'nerve',     name: '신경계',    desc: '신경망 형성, 다음 진화 개방',       cost: { dna: 130 } },
    { id: 'sentience', name: '지성',      desc: '자아의 각성 — 문명의 시작',         cost: { dna: 200 } },
  ],

  /* ---------- 문명 단계: 직업 ---------- */
  jobs: {
    farmer:     { name: '농부',   icon: 'sprout', out: { food: 1.1 },    slotFrom: 'farm',   perSlot: 1 },
    lumberjack: { name: '벌목꾼', icon: 'axe',    out: { lumber: 0.55 }, slotFrom: 'camp',   perSlot: 2 },
    mason:      { name: '채석공', icon: 'pick',   out: { stone: 0.5 },   slotFrom: 'quarry', perSlot: 2 },
    miner:      { name: '광부',   icon: 'gem',    out: { copper: 0.22 }, slotFrom: 'mine',   perSlot: 2 },
    scholar:    { name: '학자',   icon: 'scroll', out: { know: 0.32 },   slotFrom: 'school', perSlot: 1 },
    merchant:   { name: '상인',   icon: 'coin',   out: { coins: 0.5 },   slotFrom: 'market', perSlot: 1 },
  },

  /* ---------- 문명 단계: 건물 ---------- */
  buildings: {
    hut:     { name: '오두막',    icon: 'hut',      desc: '인구 한도 +2',
               cost: { lumber: 10, stone: 4 },  mult: 1.32 },
    farm:    { name: '농장',      icon: 'sprout',   desc: '농부 일자리 +1, 식량 한도 +25',
               cost: { lumber: 8, stone: 2 },   mult: 1.28, needsTech: 'agriculture' },
    camp:    { name: '벌목 캠프', icon: 'tent',     desc: '벌목꾼 일자리 +2',
               cost: { lumber: 14, stone: 6 },  mult: 1.30, needsTech: 'logging' },
    quarry:  { name: '채석장',    icon: 'pick',     desc: '채석공 일자리 +2',
               cost: { lumber: 18, stone: 10 }, mult: 1.30, needsTech: 'stonecutting' },
    sundial: { name: '해시계',    icon: 'clock',    desc: '지식 +0.3/s, 지식 한도 +25',
               cost: { lumber: 8, stone: 12 },  mult: 1.45 },
    shed:    { name: '저장고',    icon: 'box',      desc: '식량 +90 · 목재/석재 +120 · 광물 +50 한도',
               cost: { lumber: 30, stone: 18 }, mult: 1.22, needsTech: 'storage' },
    school:  { name: '학당',      icon: 'school',   desc: '학자 일자리 +1, 지식 한도 +60',
               cost: { lumber: 50, stone: 35 }, mult: 1.32, needsTech: 'writing' },
    library: { name: '도서관',    icon: 'books',    desc: '지식 한도 +120, 학자 효율 +8%',
               cost: { lumber: 65, stone: 50 }, mult: 1.30, needsTech: 'writing' },
    mine:    { name: '광산',      icon: 'mountain', desc: '광부 일자리 +2',
               cost: { lumber: 75, stone: 55 }, mult: 1.32, needsTech: 'mining' },
    market:  { name: '시장',      icon: 'store',    desc: '상인 일자리 +1, 화폐 한도 +100',
               cost: { lumber: 65, stone: 40, copper: 15 }, mult: 1.32, needsTech: 'currency' },
    house:   { name: '주택',      icon: 'house',    desc: '인구 한도 +5',
               cost: { lumber: 50, stone: 30, copper: 10 }, mult: 1.30, needsTech: 'architecture' },
  },

  /* ---------- 불가사의 (구간 건설) ---------- */
  wonder: {
    name: '대신전', icon: 'temple',
    desc: '문명의 정점. 20단계에 걸쳐 건설하면 초월이 열립니다.',
    segments: 20,
    segCost: { lumber: 140, stone: 120, copper: 35, iron: 25, coins: 80 },
    needsTech: 'engineering',
  },

  /* ---------- 연구 ---------- */
  techs: {
    // 1티어 — 부족 시대
    agriculture:  { name: '농경',      icon: 'sprout',   tier: 1, desc: '농장 건설 개방',
                    cost: { know: 10 } },
    logging:      { name: '벌목',      icon: 'axe',      tier: 1, desc: '벌목 캠프 개방',
                    cost: { know: 15 } },
    stonecutting: { name: '채석',      icon: 'pick',     tier: 1, desc: '채석장 개방',
                    cost: { know: 25 } },
    storage:      { name: '저장 기술', icon: 'box',      tier: 1, desc: '저장고 개방',
                    cost: { know: 40, lumber: 20 } },
    writing:      { name: '문자',      icon: 'pen',      tier: 1, desc: '학당·도서관 개방',
                    cost: { know: 60 } },
    // 2티어 — 고대
    mining:       { name: '채굴',      icon: 'mountain', tier: 2, desc: '광산 개방, 구리 채굴',
                    cost: { know: 90, lumber: 40, stone: 30 }, needs: ['stonecutting'] },
    calendar:     { name: '달력',      icon: 'calendar', tier: 2, desc: '해시계 효율 ×2, 인구 성장 +15%',
                    cost: { know: 120 }, needs: ['writing'] },
    tools:        { name: '도구 개량', icon: 'hammer',   tier: 2, desc: '벌목/채석/광부 +30%, 채집 클릭 ×2',
                    cost: { know: 140, copper: 20 }, needs: ['mining'] },
    irrigation:   { name: '관개',      icon: 'drop',     tier: 2, desc: '농부 효율 +50%',
                    cost: { know: 180, lumber: 60 }, needs: ['agriculture'] },
    currency:     { name: '화폐',      icon: 'coin',     tier: 2, desc: '시장·상인 개방',
                    cost: { know: 240, copper: 40 }, needs: ['mining'] },
    architecture: { name: '건축학',    icon: 'house',    tier: 2, desc: '주택 개방 (인구 +5)',
                    cost: { know: 320, stone: 120 }, needs: ['stonecutting'] },
    // 3티어 — 고전
    scholarship:  { name: '학문',      icon: 'scroll',   tier: 3, desc: '학자 효율 +50%',
                    cost: { know: 420, coins: 100 }, needs: ['writing', 'currency'] },
    bronze:       { name: '청동기',    icon: 'ingot',    tier: 3, desc: '벌목/채석/광부 +40%',
                    cost: { know: 550, copper: 120 }, needs: ['tools'] },
    ironwork:     { name: '철기',      icon: 'gear',     tier: 3, desc: '광부가 철도 채굴 (+0.15/s)',
                    cost: { know: 750, copper: 160, coins: 150 }, needs: ['bronze'] },
    trade:        { name: '교역',      icon: 'ship',     tier: 3, desc: '상인 효율 +75%',
                    cost: { know: 900, coins: 220 }, needs: ['currency'] },
    engineering:  { name: '공학',      icon: 'ruler',    tier: 3, desc: '불가사의 「대신전」 건설 개방',
                    cost: { know: 1200, iron: 120 }, needs: ['ironwork', 'architecture'] },
  },

  tierNames: { 1: '부족 시대', 2: '고대', 3: '고전기' },

  /* ---------- 상수 ---------- */
  const: {
    eatPerCitizen: 0.35,     // 시민 1인당 식량 소비 /s
    growthTime: 18,          // 기본 인구 성장 주기(초)
    starveTime: 5,           // 기아 시 인구 감소 주기(초)
    essencePerBonus: 0.05,   // 정수 1당 생산 +5%
    offlineCapSec: 4 * 3600, // 오프라인 진행 상한 4시간
    clickBase: 1,
    histMax: 3600,           // 차트 히스토리(초)
    heatBucketSec: 10,       // 히트맵 버킷 크기(초)
    heatCells: 84,           // 12 × 7
  },
};

/* Node 없는 브라우저 전역 + 시뮬레이션 하니스 겸용 */
if (typeof window !== 'undefined') window.DATA = DATA;
