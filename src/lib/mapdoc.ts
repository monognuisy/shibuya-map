/** `data/build/map.json` (= `public/data/map.json`) 의 구조. */
import type { LinkKind, Operator, PlaceKind, Provenance } from './types';

export type XY = [number, number];

export interface BuildingDoc {
  id: string;
  /** LANDMARKS 에 등록된 주요 건물이면 그 id */
  landmark?: string;
  name: string | null;
  nameEn: string | null;
  kind: string;
  height: number | null;
  levels: number | null;
  area: number;
  ring: XY[];
}

export interface PlatformShapeDoc {
  id: string;
  name: string | null;
  ref: string | null;
  operator: string | null;
  level: number;
  ring: XY[];
}

export interface EntranceDoc {
  id: string;
  name: string | null;
  nameEn: string | null;
  railway: string;
  x: number;
  y: number;
}

export interface PlaceDoc {
  id: string;
  name: string;
  nameJa?: string;
  kind: PlaceKind;
  operator: Operator;
  level: number;
  x: number;
  y: number;
  line?: XY[];
  /** 실제 형상. 승강장·통로는 폴리곤, 건물은 발자국. */
  footprints?: XY[][];
  /** 건물 높이(m) */
  height?: number;
  width?: number;
  desc?: string;
  planned?: boolean;
  provenance: Provenance;
  tags?: Record<string, string>;
  /** graph.nodes 인덱스 */
  node: number;
}

export type EdgeSource = 'mlit' | 'osm' | 'curated';

export interface EdgeDoc {
  a: number;
  b: number;
  k: LinkKind;
  /** 거리(m) */
  d: number;
  /** 소요(초) */
  s: number;
  /** 배리어프리 1/0 */
  bf: 0 | 1;
  src: EdgeSource;
  /** 공사중 */
  p?: 1;
  /** 비고 */
  n?: string;
}

export interface MapDoc {
  meta: {
    builtAt: string;
    origin: { lat: number; lon: number };
    radius: number;
    sources: {
      key: string;
      title: string;
      url: string;
      license: string;
      fetchedAt: string;
    }[];
    counts: Record<string, number>;
  };
  buildings: BuildingDoc[];
  platformShapes: PlatformShapeDoc[];
  entrances: EntranceDoc[];
  places: PlaceDoc[];
  graph: {
    /** [x, y, level] */
    nodes: [number, number, number][];
    edges: EdgeDoc[];
  };
}

export async function loadMap(url: string): Promise<MapDoc> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`지도 데이터를 불러오지 못했습니다 (${res.status})`);
  return (await res.json()) as MapDoc;
}
