'use strict';

/* =========================================================
 * PRIMORDIUM — 클라우드 동기화 (Google Drive appDataFolder)
 * 백엔드 없는 브라우저 전용: Google Identity Services 토큰 +
 * Drive REST. 저장 파일은 각 사용자의 드라이브 앱 전용 공간에
 * 보관되어 본인만 접근할 수 있다.
 * config.js의 googleClientId가 비어 있으면 기능이 숨겨진다.
 * ========================================================= */

const Sync = (() => {
  const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
  const FILE_NAME = 'primordium-save.json';

  let tokenClient = null;
  let accessToken = null;
  let tokenExpiry = 0; // epoch ms
  let fileId = null;
  let lastSyncAt = 0;
  let busy = false;
  let lastError = '';
  let pending = null;  // 진행 중인 signIn의 {resolve, reject}
  let refreshT = 0;    // 만료 전 조용한 갱신 타이머

  // 토큰 자체는 저장할 수 없으니(만료 1시간) "로그인해서 쓰던 중"이라는
  // 사실만 남겨 두고, 다음 방문 때 화면 없이 재발급을 시도한다.
  const FLAG = 'primordium-sync-on';

  const clientId = () =>
    (window.PRIMORDIUM_CONFIG && window.PRIMORDIUM_CONFIG.googleClientId) || '';

  const available = () => !!clientId();
  const signedIn = () => !!accessToken && Date.now() < tokenExpiry - 30000;

  const hasSession = () => {
    try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; }
  };
  const remember = (on) => {
    try { on ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch (e) {}
  };

  /* ---------- GIS 스크립트 로드 (필요할 때 1회) ---------- */

  let gisPromise = null;
  function loadGis() {
    if (window.google && window.google.accounts) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new Error('Google 스크립트 로드 실패')); };
      document.head.append(s);
    });
    return gisPromise;
  }

  /* ---------- 로그인/로그아웃 ---------- */

  function settle(err) {
    const p = pending;
    pending = null;
    if (!p) return;
    if (err) p.reject(err); else p.resolve();
  }

  function scheduleRefresh() {
    clearTimeout(refreshT);
    // 만료 2분 전 조용히 재발급 — 실패하면 signedIn()이 꺼지고 설정 탭에 오류가 표시된다
    refreshT = setTimeout(() => { signIn(true).catch(() => {}); },
      Math.max(60000, tokenExpiry - Date.now() - 120000));
  }

  function signIn(silent) {
    return loadGis().then(() => new Promise((resolve, reject) => {
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId(),
          scope: SCOPES,
          callback: (resp) => {
            if (resp.error) {
              lastError = resp.error;
              settle(new Error(resp.error));
              return;
            }
            accessToken = resp.access_token;
            tokenExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
            lastError = '';
            remember(true);
            scheduleRefresh();
            settle(null);
          },
          // 팝업 차단/사용자가 창을 닫음 등 callback까지 오지 못하는 실패
          error_callback: (err) => {
            lastError = (err && (err.message || err.type)) || '로그인 실패';
            settle(new Error(lastError));
          },
        });
      }
      if (pending) { reject(new Error('로그인 진행 중')); return; }
      pending = { resolve, reject };
      // prompt '' — 이미 동의한 계정이면 화면 없이 토큰만 받고,
      // 첫 로그인이면 Google이 필요한 동의 화면을 알아서 띄운다.
      // silent(자동 복원/갱신)일 때도 동일 — 화면이 필요해지면 팝업 차단으로
      // error_callback에 떨어지고, 로그인 버튼이 다시 표시된다.
      tokenClient.requestAccessToken({ prompt: '' });
    }));
  }

  /* 새로고침 후 로그인 복원 — 이전에 로그인해 쓰던 경우에만 조용히 시도 */
  function restore() {
    if (!available() || !hasSession()) return Promise.resolve(false);
    if (signedIn()) return Promise.resolve(true);
    return signIn(true).then(() => true, () => false);
  }

  function signOut() {
    clearTimeout(refreshT);
    remember(false);
    if (accessToken && window.google && google.accounts) {
      try { google.accounts.oauth2.revoke(accessToken, () => {}); } catch (e) {}
    }
    accessToken = null;
    tokenExpiry = 0;
    fileId = null;
    lastSyncAt = 0;
  }

  /* ---------- Drive REST ---------- */

  async function api(url, opts) {
    const res = await fetch(url, Object.assign({}, opts, {
      headers: Object.assign(
        { Authorization: 'Bearer ' + accessToken },
        (opts && opts.headers) || {}),
    }));
    if (res.status === 401) { accessToken = null; throw new Error('로그인이 만료되었습니다'); }
    if (!res.ok) throw new Error('Drive API 오류 (' + res.status + ')');
    return res;
  }

  async function findFile() {
    if (fileId) return fileId;
    const q = encodeURIComponent(`name='${FILE_NAME}'`);
    const res = await api('https://www.googleapis.com/drive/v3/files'
      + `?spaces=appDataFolder&q=${q}&fields=files(id)`);
    const data = await res.json();
    fileId = data.files && data.files.length ? data.files[0].id : null;
    return fileId;
  }

  async function upload(json) {
    const id = await findFile();
    if (id) {
      await api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: json,
      });
    } else {
      const boundary = 'primordium-' + Math.random().toString(36).slice(2);
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`
        + JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })
        + `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;
      const res = await api(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        });
      fileId = (await res.json()).id;
    }
  }

  async function download() {
    const id = await findFile();
    if (!id) return null;
    const res = await api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    return res.text();
  }

  /* ---------- 상위 API ---------- */

  async function syncUp(json) {
    if (!signedIn() || busy) return false;
    busy = true;
    try {
      await upload(json);
      lastSyncAt = Date.now();
      lastError = '';
      return true;
    } catch (e) {
      lastError = String((e && e.message) || e);
      return false;
    } finally { busy = false; }
  }

  async function syncDown() {
    if (!signedIn() || busy) return null;
    busy = true;
    try {
      const text = await download();
      lastError = '';
      return text;
    } catch (e) {
      lastError = String((e && e.message) || e);
      return null;
    } finally { busy = false; }
  }

  return {
    available, signedIn, hasSession, restore, signIn, signOut, syncUp, syncDown,
    get lastSyncAt() { return lastSyncAt; },
    get lastError() { return lastError; },
  };
})();

if (typeof window !== 'undefined') window.Sync = Sync;
