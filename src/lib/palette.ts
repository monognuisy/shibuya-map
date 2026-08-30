/** 사업자·레이어 색. CSS 와 three.js 양쪽에서 쓴다. */
export const OPERATOR_COLORS = {
  jr: '#4CA866',
  metro: '#12A5C8',
  tokyu: '#E8384F',
  keio: '#E0559A',
  facility: '#8A96A6',
  passage: '#E8B23A',
} as const;

export const OPERATOR_LABELS = {
  jr: 'JR동일본',
  metro: '도쿄메트로',
  tokyu: '도큐 · 메트로',
  keio: '게이오',
  facility: '건물 · 광장',
  passage: '연결통로',
} as const;

export const SOURCE_COLORS = {
  mlit: '#7E93AC',
  osm: '#49596D',
  curated: '#E8B23A',
} as const;

export const SOURCE_LABELS = {
  mlit: '국토교통성 보행공간 네트워크',
  osm: 'OpenStreetMap 보행로',
  curated: '역 구내 (자체 작성)',
} as const;

export const KIND_LABELS: Record<string, string> = {
  platform: '승강장',
  gate: '개찰',
  entrance: '출입구',
  vertical: '수직 동선',
  building: '건물',
  plaza: '광장 · 콘코스',
  passage: '연결통로',
  street: '보도',
};

export const LINK_KIND_LABELS: Record<string, string> = {
  walk: '보행',
  stairs: '계단',
  escalator: '에스컬레이터',
  elevator: '엘리베이터',
  ramp: '경사로',
  transfer: '환승',
};

export const VERTICAL_COLORS: Record<string, string> = {
  escalator: '#E8B23A',
  stairs: '#E8846A',
  elevator: '#6FC3E0',
};

export const PROVENANCE_LABELS: Record<string, string> = {
  'mlit-pnw': '국토교통성 歩行空間ネットワークデータ (渋谷地区)',
  'mlit-facility': '국토교통성 施設データ (渋谷地区)',
  osm: 'OpenStreetMap © contributors (ODbL)',
  curated: '자체 작성 레이어 — 공식 오픈데이터가 아님',
};

export const hex = (c: string): number => Number.parseInt(c.slice(1), 16);
