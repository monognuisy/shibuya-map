/**
 * 시부야역의 층 정의.
 *
 * `z` 는 지상 1층 바닥을 0m 로 둔 근사 표고(m). 공개된 단면도가 없어
 * 정확한 실측값은 알 수 없고, 각 사업자 구내도와 공표된 심도 정보를 바탕으로 한
 * 근사치다. 층간 시각적 분리와 수직 이동 시간 추정에만 쓰인다.
 */
export interface LevelDef {
  /** 1F=1, B1=-1 (0층은 없음) */
  id: number;
  code: string;
  label: string;
  /** 지상 1층 기준 근사 표고(m) */
  z: number;
}

export const LEVELS: readonly LevelDef[] = [
  { id: 5, code: '5F', label: '마크시티 버스터미널', z: 22.0 },
  { id: 4, code: '4F', label: '스카이웨이(공사중) · 아베뉴 출입구', z: 17.0 },
  { id: 3, code: '3F', label: '긴자선 · JR 중앙/신남개찰', z: 12.0 },
  { id: 2, code: '2F', label: '서측 데크 · 이노카시라선', z: 6.5 },
  { id: 1, code: '1F', label: '하치코 광장 · 스크램블 교차로', z: 0.0 },
  { id: -1, code: 'B1', label: '시부치카 지하상가', z: -6.0 },
  { id: -2, code: 'B2', label: '미야마스자카 · 하치코개찰', z: -12.0 },
  { id: -3, code: 'B3', label: '덴엔토시선 · 히카리에개찰', z: -18.5 },
  { id: -4, code: 'B4', label: '환승 콘코스', z: -24.0 },
  { id: -5, code: 'B5', label: '도요코선 · 후쿠토신선', z: -30.0 },
];

const byId = new Map(LEVELS.map((l) => [l.id, l]));

export function levelZ(id: number): number {
  const l = byId.get(id);
  if (l) return l.z;
  // MLIT 보행공간 네트워크의 floor 값(0, 0.5, 1)처럼 정수가 아닌 경우 선형 보간.
  const lo = Math.floor(id);
  const hi = Math.ceil(id);
  const zl = byId.get(lo === 0 ? 1 : lo)?.z ?? 0;
  const zh = byId.get(hi === 0 ? 1 : hi)?.z ?? 0;
  return lo === hi ? zl : zl + (zh - zl) * (id - lo);
}

export function levelCode(id: number): string {
  return byId.get(id)?.code ?? (id > 0 ? `${id}F` : `B${-id}`);
}

/** MLIT `floor` 필드(0=지상, 0.5=중2층, 1=2층 상당) → 프로젝트 층 id */
export function mlitFloorToLevel(floor: number): number {
  if (floor === 0) return 1;
  if (floor === 0.5) return 1.5;
  return floor + 1;
}
