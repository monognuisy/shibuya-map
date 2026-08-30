/**
 * OSM(Overpass) 응답을 다루기 위한 최소 타입과 해석 규칙.
 */
export interface OsmTags {
  [k: string]: string | undefined;
}

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  geometry?: { lat: number; lon: number }[];
  tags?: OsmTags;
}

export interface OsmResponse {
  elements: OsmElement[];
}

/**
 * OSM `level` 태그 → 이 프로젝트의 층 id.
 *
 * 시부야역 일대의 OSM 데이터는 철도 시설(승강장 -5/-3/3, 개찰 1/2/4)에
 * **일본식 층 번호**를 그대로 쓰고 있다. 다만 일부 상업시설은 지상=0 관례를
 * 섞어 쓰기 때문에, 0 은 지상(1F)으로 정규화하고 나머지는 값을 그대로 쓴다.
 * `"1;2"` 처럼 여러 층에 걸친 값은 층 구간으로 해석한다.
 */
export function parseLevels(tag: string | undefined): number[] {
  if (!tag) return [];
  return tag
    .split(/[;,]/)
    .map((s) => Number.parseFloat(s.trim()))
    .filter((n) => Number.isFinite(n))
    .map((n) => (n === 0 ? 1 : n));
}

export function primaryLevel(tag: string | undefined, fallback = 1): number {
  const ls = parseLevels(tag);
  return ls.length ? ls[0]! : fallback;
}

/** 폐합 여부 (첫 점 == 끝 점) */
export function isClosed(geom: { lat: number; lon: number }[]): boolean {
  if (geom.length < 4) return false;
  const a = geom[0]!;
  const b = geom[geom.length - 1]!;
  return a.lat === b.lat && a.lon === b.lon;
}

/** 건물 높이(m). height 태그 우선, 없으면 층수 × 4.2m. */
export function buildingHeight(tags: OsmTags): number | undefined {
  const h = Number.parseFloat(tags.height ?? '');
  if (Number.isFinite(h) && h > 0) return h;
  const lv = Number.parseFloat(tags['building:levels'] ?? '');
  if (Number.isFinite(lv) && lv > 0) return lv * 4.2;
  return undefined;
}
