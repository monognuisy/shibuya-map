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
  /** graph.nodes 인덱스 (대표) */
  node: number;
  /** 이 지점에 속한 모든 노드. 건물은 접속 층마다, 선형 지점은 중심선을 따라. */
  nodes?: number[];
  /** 경로 탐색의 출발·도착으로 쓸 수 있는 노드 */
  entries?: number[];
  /** 개찰 안쪽 */
  paid?: boolean;
  /** 건물이 바깥과 이어지는 층 / 수직 동선이 잇는 두 층 */
  connectLevels?: number[];
  /** 수직 동선(kind='vertical')의 종류 */
  linkKind?: LinkKind;
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
  /** 개찰 안쪽(유료 구역)을 지나는 링크 */
  paid?: 1;
  /** 이 링크가 속한 수직 동선 지점 id */
  v?: string;
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
