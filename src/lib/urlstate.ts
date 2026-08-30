/**
 * 앱 상태 ↔ 쿼리스트링. 특정 층·지점·경로를 그대로 링크로 공유할 수 있게 한다.
 *
 *   ?level=-3&sel=gate-ty-miyachuo&from=plat-jr-yamanote&to=plat-ginza&bf=1&planned=1&np=1&h=1
 */
import type { AppState } from './store.svelte';

export interface UrlState {
  level: number | null;
  sel: string | null;
  from: string | null;
  to: string | null;
  bf: boolean;
  planned: boolean;
  /** no paid — 개찰 안쪽 지름길 금지 */
  np: boolean;
  /** 건물을 실제 높이로 */
  h: boolean;
  /** 경로 따라가기 시작 위치(씬 단위). 읽기 전용 — 재생 중에 주소가 바뀌면 시끄럽다 */
  nav: number | null;
  /** 열자마자 재생 */
  play: boolean;
  ex: number | null;
  /** 경로 선 굵기 */
  rw: number | null;
}

export function readUrl(search: string): Partial<UrlState> {
  const q = new URLSearchParams(search);
  const num = (k: string) => {
    const v = q.get(k);
    if (v === null) return undefined;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const out: Partial<UrlState> = {};
  const lv = num('level');
  if (lv !== undefined) out.level = lv;
  const ex = num('ex');
  if (ex !== undefined) out.ex = Math.min(8, Math.max(1, ex));
  const rw = num('rw');
  if (rw !== undefined) out.rw = Math.min(6, Math.max(0.6, rw));
  for (const k of ['sel', 'from', 'to'] as const) {
    const v = q.get(k);
    if (v) out[k] = v;
  }
  if (q.has('bf')) out.bf = q.get('bf') === '1';
  if (q.has('planned')) out.planned = q.get('planned') === '1';
  if (q.has('np')) out.np = q.get('np') === '1';
  if (q.has('nav')) out.nav = num('nav') ?? 0;
  if (q.has('play')) out.play = q.get('play') === '1';
  if (q.has('h')) out.h = q.get('h') === '1';
  return out;
}

export function applyUrl(app: AppState, search: string): void {
  const u = readUrl(search);
  const known = (id: string | null | undefined) =>
    id && app.places.some((p) => p.id === id) ? id : null;

  if (u.level !== undefined) app.activeLevel = u.level;
  if (u.ex !== undefined && u.ex !== null) app.exaggeration = u.ex;
  if (u.rw !== undefined && u.rw !== null) app.routeWidth = u.rw;
  if (u.bf !== undefined) app.barrierFree = u.bf;
  if (u.planned !== undefined) app.showPlanned = u.planned;
  if (u.np !== undefined) app.avoidPaidShortcut = u.np;
  if (u.h !== undefined) app.realHeights = u.h;
  if (u.nav !== undefined && u.nav !== null) app.navT = u.nav;
  if (u.play) {
    app.navT ??= 0;
    app.navPlaying = true;
  }
  if (u.from) app.fromId = known(u.from) ?? app.fromId;
  if (u.to) app.toId = known(u.to) ?? app.toId;
  if (u.sel) app.selectedId = known(u.sel);
}

export function toSearch(app: AppState): string {
  const q = new URLSearchParams();
  if (app.activeLevel !== null) q.set('level', String(app.activeLevel));
  if (app.selectedId) q.set('sel', app.selectedId);
  if (app.fromId) q.set('from', app.fromId);
  if (app.toId) q.set('to', app.toId);
  if (app.barrierFree) q.set('bf', '1');
  if (app.showPlanned) q.set('planned', '1');
  if (app.avoidPaidShortcut) q.set('np', '1');
  if (app.realHeights) q.set('h', '1');
  if (app.exaggeration !== 5) q.set('ex', String(app.exaggeration));
  if (app.routeWidth !== 2.2) q.set('rw', String(app.routeWidth));
  return q.toString();
}
