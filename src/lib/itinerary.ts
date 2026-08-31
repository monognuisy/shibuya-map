/**
 * 경로 → 사람이 읽는 경유지 목록.
 *
 * 다익스트라가 돌려주는 것은 노드 3천 개짜리 그래프 위의 엣지 나열이라
 * 그대로는 안내가 되지 않는다. 여기서 이름 있는 지점을 만날 때마다 끊어
 * 「어디를 지나 어디로」 형태로 다시 묶는다.
 */
import type { RouteResult } from './graph';
import { levelCode } from './levels';
import type { MapDoc, PlaceDoc } from './mapdoc';
import type { LinkKind } from './types';

export interface Leg {
  /** 이 구간의 주된 이동 수단 */
  kind: LinkKind;
  distance: number;
  seconds: number;
  fromLevel: number;
  toLevel: number;
  paid: boolean;
  /** 지나는 통로·설비 이름 */
  via: string[];
  /** 이 구간에서 탄 계단·에스컬레이터·EV */
  vertical?: PlaceDoc;
  /** 구간이 끝나는 지점 */
  arrival?: PlaceDoc;
  /** 선형 지점 위 어디에 도착하는지 (예: 「북쪽 끝」) */
  arrivalDetail?: string;
  /** 3D 하이라이트·내비게이션용 노드 나열 */
  nodes: number[];
  /** 이 구간을 이루는 자체 작성 링크의 근거. meta.linkSources 의 키. */
  refs: string[];
  /** 근거가 아직 없는 자체 작성 링크를 포함하는가 */
  unsourced: boolean;
  /** route.nodes 안에서 이 구간이 끝나는 위치 */
  endIndex: number;
}

export interface Itinerary {
  origin?: PlaceDoc;
  destination?: PlaceDoc;
  legs: Leg[];
  seconds: number;
  distance: number;
  gateCrossings: number;
}

/** 안내에 쓸모없는 내부 표기 */
const HIDDEN_NOTES = /레이어 접합|내부 이동/;

export function buildItinerary(doc: MapDoc, route: RouteResult): Itinerary {
  const byNode = nodeIndex(doc);
  const legs: Leg[] = [];

  let cur: Leg | null = null;
  let startPlace = byNode.get(route.nodes[0]!);
  let idx = 0;

  const flush = (arrivalNode: number, at: number) => {
    if (!cur) return;
    const p = byNode.get(arrivalNode);
    cur.arrival = p;
    cur.arrivalDetail = p ? describePosition(doc, p, arrivalNode) : undefined;
    cur.toLevel = doc.graph.nodes[arrivalNode]![2];
    cur.endIndex = at;
    legs.push(cur);
    cur = null;
  };

  for (const step of route.steps) {
    idx++;
    const level = doc.graph.nodes[step.from]![2];
    const paid = Boolean(step.edge.paid);

    // 이동 수단이나 개찰 안/밖이 달라지면 구간을 끊는다
    if (cur && (cur.kind !== step.edge.k || cur.paid !== paid)) flush(step.from, idx - 1);

    cur ??= {
      kind: step.edge.k,
      distance: 0,
      seconds: 0,
      fromLevel: level,
      toLevel: level,
      paid,
      via: [],
      nodes: [step.from],
      refs: [],
      unsourced: false,
      endIndex: idx,
    };

    cur.distance += step.distance;
    cur.seconds += step.seconds;
    cur.nodes.push(step.to);
    if (step.edge.n && !HIDDEN_NOTES.test(step.edge.n) && !cur.via.includes(step.edge.n)) {
      cur.via.push(step.edge.n);
    }
    if (step.edge.src === 'curated' && !HIDDEN_NOTES.test(step.edge.n ?? '')) {
      if (step.edge.r?.length) {
        for (const r of step.edge.r) if (!cur.refs.includes(r)) cur.refs.push(r);
      } else {
        cur.unsourced = true;
      }
    }
    if (step.edge.v && !cur.vertical) {
      cur.vertical = doc.places.find((p) => p.id === step.edge.v);
    }

    // 이름 있는 지점에 닿으면 거기서 끊어 경유지로 남긴다
    const at = byNode.get(step.to);
    if (at && at !== startPlace && at.kind !== 'vertical') {
      flush(step.to, idx);
      startPlace = at;
    }
  }
  if (cur) flush(route.nodes[route.nodes.length - 1]!, route.nodes.length - 1);

  return {
    origin: byNode.get(route.nodes[0]!),
    destination: byNode.get(route.nodes[route.nodes.length - 1]!),
    legs: legs.filter((l) => l.distance > 1.5 || l.kind !== 'walk'),
    seconds: route.seconds,
    distance: route.distance,
    gateCrossings: route.gateCrossings,
  };
}

/** 노드 → 지점. 승강장·개찰처럼 안내에 의미 있는 것이 출입구·수직동선보다 우선. */
const KIND_RANK: Record<string, number> = {
  platform: 0,
  gate: 1,
  plaza: 2,
  passage: 3,
  building: 4,
  entrance: 5,
  vertical: 6,
  street: 7,
};

function nodeIndex(doc: MapDoc): Map<number, PlaceDoc> {
  const map = new Map<number, PlaceDoc>();
  for (const p of doc.places) {
    for (const n of p.nodes ?? [p.node]) {
      const prev = map.get(n);
      if (!prev || (KIND_RANK[p.kind] ?? 9) < (KIND_RANK[prev.kind] ?? 9)) map.set(n, p);
    }
  }
  return map;
}

/**
 * 선형 지점 위 어디쯤인지. 승강장 남쪽 끝과 북쪽 끝은 200m 넘게 떨어져 있어서
 * 「승강장」 한 마디로는 안내가 되지 않는다.
 */
export function describePosition(
  doc: MapDoc,
  place: PlaceDoc,
  node: number,
): string | undefined {
  const chain = place.nodes;
  if (!chain || chain.length < 4 || !place.line || place.line.length < 2) return undefined;
  const i = chain.indexOf(node);
  if (i < 0) return undefined;
  const t = i / (chain.length - 1);

  const a = place.line[0]!;
  const b = place.line[place.line.length - 1]!;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const northSouth = Math.abs(dy) >= Math.abs(dx);
  // t=0 이 어느 쪽 끝인지
  const lowEnd = northSouth ? (dy > 0 ? '남' : '북') : dx > 0 ? '서' : '동';
  const highEnd = northSouth ? (dy > 0 ? '북' : '남') : dx > 0 ? '동' : '서';

  if (t <= 0.15) return `${lowEnd}쪽 끝`;
  if (t <= 0.38) return `${lowEnd}쪽`;
  if (t < 0.62) return '중앙';
  if (t < 0.85) return `${highEnd}쪽`;
  return `${highEnd}쪽 끝`;
}

/** 구간 한 줄 요약. */
export function legSummary(leg: Leg): string {
  const move = LEG_VERBS[leg.kind] ?? '이동';
  if (leg.fromLevel !== leg.toLevel) {
    return `${move} ${levelCode(leg.fromLevel)} → ${levelCode(leg.toLevel)}`;
  }
  return move;
}

const LEG_VERBS: Record<string, string> = {
  walk: '걷기',
  stairs: '계단',
  escalator: '에스컬레이터',
  elevator: '엘리베이터',
  ramp: '경사로',
  transfer: '환승 통로',
};
