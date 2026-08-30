/**
 * 앱 상태 ↔ 쿼리스트링. 특정 층·지점·경로를 그대로 링크로 공유할 수 있게 한다.
 *
 *   ?level=-3&sel=gate-ty-miyachuo&from=plat-jr-yamanote&to=plat-ginza&bf=1&planned=1
 */
import type { AppState } from './store.svelte';

export interface UrlState {
  level: number | null;
  sel: string | null;
  from: string | null;
  to: string | null;
  bf: boolean;
  planned: boolean;
  ex: number | null;
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
  for (const k of ['sel', 'from', 'to'] as const) {
    const v = q.get(k);
    if (v) out[k] = v;
  }
  if (q.has('bf')) out.bf = q.get('bf') === '1';
  if (q.has('planned')) out.planned = q.get('planned') === '1';
  return out;
}

export function applyUrl(app: AppState, search: string): void {
  const u = readUrl(search);
  const known = (id: string | null | undefined) =>
    id && app.places.some((p) => p.id === id) ? id : null;

  if (u.level !== undefined) app.activeLevel = u.level;
  if (u.ex !== undefined && u.ex !== null) app.exaggeration = u.ex;
  if (u.bf !== undefined) app.barrierFree = u.bf;
  if (u.planned !== undefined) app.showPlanned = u.planned;
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
  if (app.exaggeration !== 5) q.set('ex', String(app.exaggeration));
  return q.toString();
}
