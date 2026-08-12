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

  const clientId = () =>
    (window.PRIMORDIUM_CONFIG && window.PRIMORDIUM_CONFIG.googleClientId) || '';

  const available = () => !!clientId();
  const signedIn = () => !!accessToken && Date.now() < tokenExpiry - 30000;

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

  function signIn() {
    return loadGis().then(() => new Promise((resolve, reject) => {
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId(),
          scope: SCOPES,
          callback: () => {},
        });
      }
      tokenClient.callback = (resp) => {
        if (resp.error) {
          lastError = resp.error;
          reject(new Error(resp.error));
          return;
        }
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        lastError = '';
        resolve();
      };
      // 첫 로그인은 동의 화면, 이후는 조용히 갱신 시도
      tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
    }));
  }

  function signOut() {
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
    available, signedIn, signIn, signOut, syncUp, syncDown,
    get lastSyncAt() { return lastSyncAt; },
    get lastError() { return lastError; },
  };
})();

if (typeof window !== 'undefined') window.Sync = Sync;
