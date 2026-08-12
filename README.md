# Primordium — 진화 인크리멘탈

원시 수프의 RNA 한 가닥에서 문명의 불가사의까지 성장하는 브라우저 인크리멘탈 게임.
[Evolve](https://pmotschmann.github.io/Evolve/)에서 영감을 받았습니다.

**플레이: https://ysh4267.github.io/primordium/**

## 진행

1. **진화** — RNA를 모으고 DNA를 합성해 세포소기관 → 핵 → 다세포 → 지성으로 진화
2. **문명** — 인구를 늘리고 일자리를 배정하며 16종 연구와 12종 건물로 부족을 문명으로
3. **초월** — 불가사의 「대신전」을 완공하면 정수를 얻고 처음부터, 그러나 영구히 더 빠르게

## 특징

- 순수 HTML/CSS/JS — 빌드 도구 없음, 정적 호스팅이면 어디서든 동작
- 핀테크 대시보드 스타일 UI (Outfit / `#5B91FF` / `#121214`)
- 실시간 라인 차트 · 활동 히트맵 · 자원 구성 바 · 이벤트 로그
- 자동 저장(localStorage) · 내보내기/가져오기 · 오프라인 진행(최대 4시간)
- 색각 이상 검증을 거친 차트 팔레트 (MOF-2009 시뮬레이션, OKLab ΔE)

## 클라우드 동기화 활성화 (소유자 1회 설정)

설정 탭의 Google 로그인 동기화(Drive 앱 전용 공간)는 OAuth 클라이언트 ID가 있어야 켜집니다:

1. https://console.cloud.google.com/ 에서 프로젝트 생성(무료)
2. `API 및 서비스 → 라이브러리`에서 **Google Drive API** 사용 설정
3. `API 및 서비스 → OAuth 동의 화면`: 외부(External) 선택, 앱 이름/이메일만 입력,
   범위에 `.../auth/drive.appdata` 추가, 게시 상태를 **프로덕션**으로 게시
4. `사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID`:
   유형 **웹 애플리케이션**, 승인된 JavaScript 원본에 `https://ysh4267.github.io` 추가
5. 발급된 클라이언트 ID를 `js/config.js`의 `googleClientId`에 붙여넣고 커밋/푸시

저장 파일은 각 플레이어 본인의 Google Drive `appDataFolder`(앱 전용, 다른 앱/사람 접근 불가)에
`primordium-save.json`으로 보관됩니다. 로그인 시 5분마다·화면 이탈 시 자동 업로드,
「클라우드에서 불러오기」로 다른 기기에서 이어하기가 가능합니다.

## 개발

정적 파일뿐이므로 `index.html`을 열면 바로 실행됩니다.

- `js/engine.js` — DOM 의존성 없는 순수 게임 로직
- `js/ui.js` — 렌더링/차트
- `tools/sim.html` — 그리디 봇이 엔진으로 풀 플레이스루를 돌며 밸런스와
  불변식(자원 한도, NaN, 인구/슬롯 초과)을 검증하는 헤드리스 하니스

```
msedge --headless=new --dump-dom tools/sim.html
```
