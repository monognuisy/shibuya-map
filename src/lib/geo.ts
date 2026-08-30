/**
 * 로컬 ENU(East-North-Up) 평면 투영.
 *
 * 시부야역 반경 2km 정도만 다루므로, 원점에서의 자오선/묘유선 곡률반경을
 * 상수로 고정한 접평면 근사를 쓴다. 이 범위에서 상대오차는 1e-6 미만이라
 * 미터 단위 거리 계산에 그대로 써도 된다.
 */

/** JR 시부야역 중앙 부근. 모든 미터 좌표의 원점. */
export const ORIGIN = { lat: 35.658034, lon: 139.701636 } as const;

const A = 6378137.0; // WGS84 장반경
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const DEG = Math.PI / 180;

function curvature(lat0Deg: number) {
  const s = Math.sin(lat0Deg * DEG);
  const w = 1 - E2 * s * s;
  return {
    /** 자오선 곡률반경 — 위도 1rad 당 북쪽 미터 */
    m: (A * (1 - E2)) / Math.pow(w, 1.5),
    /** 묘유선 곡률반경 — 경도 1rad 당 동쪽 미터(위도 보정 포함) */
    n: (A / Math.sqrt(w)) * Math.cos(lat0Deg * DEG),
  };
}

const R = curvature(ORIGIN.lat);

export interface LatLon {
  lat: number;
  lon: number;
}
/** x=동(m), y=북(m) */
export interface Vec2 {
  x: number;
  y: number;
}

export function toMeters({ lat, lon }: LatLon): Vec2 {
  return {
    x: (lon - ORIGIN.lon) * DEG * R.n,
    y: (lat - ORIGIN.lat) * DEG * R.m,
  };
}

export function toLatLon({ x, y }: Vec2): LatLon {
  return {
    lat: ORIGIN.lat + y / R.m / DEG,
    lon: ORIGIN.lon + x / R.n / DEG,
  };
}

export function dist2(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** 폴리라인 평면 길이(m). */
export function polylineLength(pts: readonly Vec2[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += dist2(pts[i - 1]!, pts[i]!);
  return d;
}

/** 하버사인 — 투영 정확도 검증용. */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const la = a.lat * DEG;
  const lb = b.lat * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

/** 점들을 감싸는 축정렬 바운딩박스. */
export function bbox(pts: readonly Vec2[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
