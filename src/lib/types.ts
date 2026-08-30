import type { LatLon, Vec2 } from './geo';

/** 이 피처가 어디서 왔는지. UI에서 공식/자체작성을 반드시 구분해 표시한다. */
export type Provenance =
  /** 국토교통성 歩行空間ネットワークデータ(渋谷地区) */
  | 'mlit-pnw'
  /** 국토교통성 施設データ(渋谷地区) */
  | 'mlit-facility'
  /** OpenStreetMap (ODbL) */
  | 'osm'
  /** 본 프로젝트가 각 사업자 공개 구내도를 참고해 직접 작성 */
  | 'curated';

export type Operator = 'jr' | 'metro' | 'tokyu' | 'keio' | 'facility' | 'passage';

export type PlaceKind =
  | 'platform'
  | 'gate'
  | 'building'
  | 'plaza'
  | 'passage'
  | 'street';

export type LinkKind =
  | 'walk'
  | 'stairs'
  | 'escalator'
  | 'elevator'
  | 'ramp'
  | 'transfer';

export interface Place {
  id: string;
  name: string;
  nameJa?: string;
  level: number;
  /** 대표점(미터). 폴리라인/폴리곤 피처는 중심점. */
  pos: Vec2;
  latlon: LatLon;
  kind: PlaceKind;
  operator: Operator;
  provenance: Provenance;
  desc?: string;
  /** 미개통·공사중 */
  planned?: boolean;
  /** 승강장·통로처럼 선형인 경우의 중심선(미터) */
  path?: Vec2[];
  /** 층이 바뀌는 통로의 시작/끝 층 */
  levelSpan?: [number, number];
  /** 폭원(m). 통로 렌더 두께에 사용 */
  width?: number;
  /** 건물 외곽선(미터) */
  footprint?: Vec2[];
  /** 건물 높이(m) */
  height?: number;
  /** 상세 패널에 노출할 부가 정보 */
  tags?: Record<string, string>;
}

export interface Link {
  id: string;
  from: string;
  to: string;
  kind: LinkKind;
  /** 실제 보행 거리(m) */
  distance: number;
  /** 추정 소요(초) */
  seconds: number;
  /** 휠체어·유모차 통행 가능 */
  barrierFree: boolean;
  provenance: Provenance;
  note?: string;
  planned?: boolean;
  /** 중간 형상이 있는 경우 */
  path?: Vec2[];
}

export interface NetworkData {
  places: Place[];
  links: Link[];
  meta: BuildMeta;
}

export interface BuildMeta {
  builtAt: string;
  origin: LatLon;
  sources: SourceMeta[];
  counts: Record<string, number>;
}

export interface SourceMeta {
  key: string;
  title: string;
  url: string;
  license: string;
  fetchedAt: string;
  files: { name: string; bytes: number; sha256: string }[];
}
