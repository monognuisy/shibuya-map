/**
 * data/raw → data/build/map.json
 *
 *   pnpm data:build
 *
 * 세 갈래 소스를 하나의 미터 좌표계 위로 올려 통합 그래프를 만든다.
 *   1) 국토교통성 歩行空間ネットワークデータ(渋谷地区)  — 옥외 공식 보행망 + 배리어프리 속성
 *   2) OpenStreetMap                                  — 건물/승강장 형상, 층 태그가 붙은 실내 보행로
 *   3) src/data/curated                               — 개찰·승강장·연락통로 (자체 작성)
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ORIGIN, dist2, polylineLength, toMeters, type Vec2 } from '../src/lib/geo.ts';
import { levelCode, levelZ, mlitFloorToLevel } from '../src/lib/levels.ts';
import {
  buildingHeight,
  isClosed,
  parseLevels,
  primaryLevel,
  type OsmResponse,
} from '../src/lib/osm.ts';
import { LANDMARK_BY_NAME } from '../src/data/curated/buildings.ts';
import { CURATED_LINKS, CURATED_PLACES } from '../src/data/curated/station.ts';
import type { LinkKind } from '../src/lib/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT = join(ROOT, 'data', 'build');

/** 렌더 대상 반경(m). 시부야역 중심에서 이 밖은 버린다. */
const RADIUS = 620;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;

/* ─────────────────────────────────────────────────────────── 보행 시간 모델 */

const WALK_SPEED = 1.25; // m/s, 평지 보행
/** 계단·에스컬레이터가 30° 경사라고 보고, 높이차 dz 가 잡아먹는 수평 거리 */
const RUN = (dz: number) => Math.abs(dz) * 1.73;
/** 링크 길이 중 수직 설비가 차지하지 않는 나머지 = 걸어야 하는 구간 */
const flat = (d: number, dz: number) => Math.max(0, d - RUN(dz)) / WALK_SPEED;

const SPEEDS: Record<LinkKind, (d: number, dz: number) => number> = {
  walk: (d) => d / WALK_SPEED,
  transfer: (d) => d / 1.1,
  ramp: (d, dz) => d / 1.05 + Math.abs(dz) * 1.5,
  // 계단은 단높이 0.17m 기준 한 단 0.55초(상행) / 0.42초(하행)
  stairs: (d, dz) => flat(d, dz) + (Math.abs(dz) / 0.17) * (dz > 0 ? 0.55 : 0.42),
  // 에스컬레이터: 대기 5초 + 수직 0.33 m/s. 남는 수평 구간은 걸어서 이동한다.
  escalator: (d, dz) => flat(d, dz) + 5 + Math.abs(dz) / 0.33,
  // 엘리베이터: 호출·승하차 25초 + 1.0 m/s. 승강기 자체는 수평 이동이 없으므로
  // 링크 길이 전체를 접근 보행으로 본다.
  elevator: (d, dz) => d / WALK_SPEED + 25 + Math.abs(dz) / 1.0,
};

const BARRIER_FREE: Record<LinkKind, boolean> = {
  walk: true,
  transfer: true,
  ramp: true,
  stairs: false,
  escalator: false, // 휠체어 기준으로는 이용 불가로 본다
  elevator: true,
};

function seconds(kind: LinkKind, d: number, dz: number): number {
  return Math.round(SPEEDS[kind](d, dz));
}

/* ───────────────────────────────────────────────────────────────── 그래프 */

interface GNode {
  i: number;
  x: number;
  y: number;
  level: number;
  /** 이 노드에 붙은 place id */
  place?: string;
}

type Src = 'mlit' | 'osm' | 'curated';

interface GEdge {
  a: number;
  b: number;
  kind: LinkKind;
  d: number;
  s: number;
  bf: boolean;
  /** 개찰 안쪽(유료 구역)을 지나는 링크인가 */
  paid?: boolean;
  /** 이 링크가 속한 수직 동선(계단·에스컬레이터·EV) 지점 id */
  vertical?: string;
  src: Src;
  planned?: boolean;
  /** 중간 형상 (있을 때만) */
  path?: [number, number][];
  note?: string;
}

const nodes: GNode[] = [];
const edges: GEdge[] = [];
const nodeKey = new Map<string, number>();

function addNode(x: number, y: number, level: number, key?: string): number {
  if (key) {
    const hit = nodeKey.get(key);
    if (hit !== undefined) return hit;
  }
  const i = nodes.length;
  nodes.push({ i, x: r2(x), y: r2(y), level });
  if (key) nodeKey.set(key, i);
  return i;
}

function addEdge(e: Omit<GEdge, 's'> & { s?: number }): void {
  if (e.a === e.b) return;
  const dz = levelZ(nodes[e.b]!.level) - levelZ(nodes[e.a]!.level);
  edges.push({
    ...e,
    d: r1(e.d),
    s: e.s ?? seconds(e.kind, e.d, dz),
  });
}

/* ────────────────────────────────────────────────────────────────── CSV */

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0]!.split(',').map((s) => s.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    head.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()));
    return row;
  });
}

/* ──────────────────────────────────────────────────────── 1. MLIT PNW */

interface MlitStats {
  nodes: number;
  links: number;
  dropped: number;
}

async function loadMlit(): Promise<MlitStats> {
  const [nodeCsv, linkCsv] = await Promise.all([
    readFile(join(RAW, 'mlit-pnw', 'node.csv'), 'utf8'),
    readFile(join(RAW, 'mlit-pnw', 'link.csv'), 'utf8'),
  ]);

  const idx = new Map<string, { p: Vec2; level: number }>();
  for (const row of parseCsv(nodeCsv)) {
    const lat = Number.parseFloat(row.lat!);
    const lon = Number.parseFloat(row.lon!);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const p = toMeters({ lat, lon });
    idx.set(row.node_id!, {
      p,
      level: mlitFloorToLevel(Number.parseFloat(row.floor ?? '0') || 0),
    });
  }

  let used = 0;
  let dropped = 0;
  const nodeOf = new Map<string, number>();
  const within = (p: Vec2) => Math.hypot(p.x, p.y) <= RADIUS;

  for (const row of parseCsv(linkCsv)) {
    const a = idx.get(row.start_id!);
    const b = idx.get(row.end_id!);
    if (!a || !b) {
      dropped++;
      continue;
    }
    if (!within(a.p) && !within(b.p)) continue;

    const ai = ensure(row.start_id!, a);
    const bi = ensure(row.end_id!, b);

    // rt_struct: 1=차도와 분리된 보도, 2=차도 병용 … 3=계단, 4=에스컬레이터, 5=엘리베이터
    const struct = row.rt_struct;
    const kind: LinkKind =
      struct === '3' ? 'stairs' : struct === '4' ? 'escalator' : struct === '5' ? 'elevator' : 'walk';
    const dist = Number.parseFloat(row.distance ?? '') || dist2(a.p, b.p);

    addEdge({
      a: ai,
      b: bi,
      kind,
      d: dist,
      // lev_diff: 1=단차 없음, 2=단차 있음 / vtcl_slope: 1=완만, 2=급경사
      bf: BARRIER_FREE[kind] && row.lev_diff !== '2',
      src: 'mlit',
      note: mlitNote(row),
    });
    used++;
  }

  function ensure(id: string, v: { p: Vec2; level: number }): number {
    const hit = nodeOf.get(id);
    if (hit !== undefined) return hit;
    const i = addNode(v.p.x, v.p.y, v.level, `mlit:${id}`);
    nodeOf.set(id, i);
    return i;
  }

  return { nodes: nodeOf.size, links: used, dropped };
}

function mlitNote(row: Record<string, string>): string | undefined {
  const bits: string[] = [];
  const w = Number.parseFloat(row.width ?? '');
  if (Number.isFinite(w) && w > 0) bits.push(`폭원구분 ${w}`);
  if (row.lev_diff === '2') bits.push('단차 있음');
  if (row.vtcl_slope === '2') bits.push('급경사');
  if (row.roof === '2') bits.push('지붕 있음');
  if (row.elevator === '2') bits.push('EV 있음');
  if (row.brail_tile === '2') bits.push('점자블록');
  return bits.length ? bits.join(' · ') : undefined;
}

/* ─────────────────────────────────────────────────────────────── 2. OSM */

interface OsmOut {
  buildings: unknown[];
  platformShapes: unknown[];
  entrances: unknown[];
  verticals: VerticalOut[];
  ways: number;
  segs: number;
}

/** OSM 에 실좌표로 들어 있는 계단·에스컬레이터·엘리베이터 한 대 */
interface VerticalOut {
  id: string;
  kind: LinkKind;
  from: number;
  to: number;
  x: number;
  y: number;
  /** 아래쪽 / 위쪽 끝 그래프 노드 */
  nodeLo: number;
  nodeHi: number;
  name: string | null;
  conveying: string | null;
  wheelchair: string | null;
}

function ringMeters(geom: { lat: number; lon: number }[]): [number, number][] {
  return geom.map((p) => {
    const m = toMeters(p);
    return [r1(m.x), r1(m.y)] as [number, number];
  });
}

function centroid(pts: [number, number][]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  return { x: x / pts.length, y: y / pts.length };
}

function ringArea(pts: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    s += pts[i]![0] * pts[i + 1]![1] - pts[i + 1]![0] * pts[i]![1];
  }
  return Math.abs(s) / 2;
}

async function loadOsm(): Promise<OsmOut> {
  const raw = JSON.parse(await readFile(join(RAW, 'osm', 'shibuya.json'), 'utf8')) as OsmResponse;
  const els = raw.elements;

  const buildings: unknown[] = [];
  const platformShapes: unknown[] = [];
  const entrances: unknown[] = [];
  const verticals: VerticalOut[] = [];

  for (const e of els) {
    const t = e.tags ?? {};
    const geom = e.geometry ?? [];

    if (t.building && geom.length >= 4 && isClosed(geom)) {
      const ring = ringMeters(geom);
      const c = centroid(ring);
      if (Math.hypot(c.x, c.y) > RADIUS) continue;
      const area = ringArea(ring);
      // 이름 없는 소규모 건물은 화면을 어지럽히기만 하므로 버린다.
      if (!t.name && area < 400) continue;
      const landmark = t.name ? LANDMARK_BY_NAME.get(t.name) : undefined;
      buildings.push({
        id: `osm:w${e.id}`,
        landmark: landmark?.id,
        name: t.name ?? t['name:ja'] ?? null,
        nameEn: t['name:en'] ?? null,
        kind: t.building,
        height: buildingHeight(t) ?? null,
        levels: t['building:levels'] ? Number.parseFloat(t['building:levels']) : null,
        area: Math.round(area),
        ring,
      });
      continue;
    }

    if ((t.railway === 'platform' || t.public_transport === 'platform') && geom.length >= 3) {
      const ring = ringMeters(geom);
      const c = centroid(ring);
      if (Math.hypot(c.x, c.y) > RADIUS) continue;
      platformShapes.push({
        id: `osm:w${e.id}`,
        name: t.name ?? null,
        ref: t.ref ?? null,
        operator: t.operator ?? null,
        level: primaryLevel(t.level, 1),
        ring,
      });
      continue;
    }

    if (e.type === 'node' && (t.railway === 'subway_entrance' || t.railway === 'train_station_entrance')) {
      if (e.lat === undefined || e.lon === undefined) continue;
      const p = toMeters({ lat: e.lat, lon: e.lon });
      if (Math.hypot(p.x, p.y) > RADIUS) continue;
      entrances.push({
        id: `osm:n${e.id}`,
        name: t.name ?? t['name:ja'] ?? null,
        nameEn: t['name:en'] ?? null,
        // 시부야역 지하철 출입구는 A0·A5b·B3·C1 같은 기호로 안내된다.
        ref: t.ref ?? null,
        wheelchair: t.wheelchair ?? null,
        railway: t.railway,
        x: r1(p.x),
        y: r1(p.y),
      });
    }
  }

  // ── 보행 그래프
  const PED = new Set(['footway', 'steps', 'elevator', 'corridor', 'pedestrian', 'path']);
  let ways = 0;
  let segs = 0;

  for (const e of els) {
    const t = e.tags ?? {};
    if (e.type !== 'way' || !t.highway || !PED.has(t.highway)) continue;
    const geom = e.geometry ?? [];
    const ids = e.nodes ?? [];
    if (geom.length < 2 || ids.length !== geom.length) continue;

    const lv = parseLevels(t.level);
    const from = lv.length ? lv[0]! : 1;
    const to = lv.length ? lv[lv.length - 1]! : from;

    const kind: LinkKind =
      t.highway === 'steps'
        ? t.conveying && t.conveying !== 'no'
          ? 'escalator'
          : 'stairs'
        : t.highway === 'elevator'
          ? 'elevator'
          : t.incline || t.ramp === 'yes'
            ? 'ramp'
            : 'walk';

    // 층이 걸쳐 있으면 진행 방향으로 균등 배분
    const pts = geom.map((p) => toMeters(p));
    if (pts.every((p) => Math.hypot(p.x, p.y) > RADIUS)) continue;

    // 층을 오르내리는 설비는 개별 시설로 따로 세워 둔다. 같은 통로라도 어느
    // 에스컬레이터를 타느냐에 따라 도착지가 달라지기 때문에, 이걸 한 덩어리로
    // 뭉뚱그리면 경로 안내가 쓸모없어진다.
    const isVertical = kind === 'stairs' || kind === 'escalator' || kind === 'elevator';
    const mid = pts[Math.floor(pts.length / 2)]!;
    const verticalId =
      isVertical && lv.length && from !== to && Math.hypot(mid.x, mid.y) <= RADIUS
        ? `v-${e.id}`
        : undefined;
    const total = polylineLength(pts) || 1;
    let acc = 0;
    const first = addNode(pts[0]!.x, pts[0]!.y, from, `osm:${ids[0]}@${from}`);
    let prev = first;
    let placed = false;

    for (let i = 1; i < pts.length; i++) {
      const d = dist2(pts[i - 1]!, pts[i]!);
      acc += d;
      const level = from + (to - from) * (acc / total);
      const cur = addNode(pts[i]!.x, pts[i]!.y, level, `osm:${ids[i]}@${round4(level)}`);
      addEdge({
        a: prev,
        b: cur,
        kind,
        d,
        bf: BARRIER_FREE[kind] && t.wheelchair !== 'no',
        src: 'osm',
        vertical: verticalId,
        note: t.name ?? undefined,
      });
      prev = cur;
      segs++;
      placed = true;
    }
    if (placed) ways++;

    if (verticalId && placed) {
      verticals.push({
        id: verticalId,
        kind,
        from,
        to,
        x: r1(mid.x),
        y: r1(mid.y),
        nodeLo: from <= to ? first : prev,
        nodeHi: from <= to ? prev : first,
        name: t.name ?? t.ref ?? null,
        conveying: t.conveying ?? null,
        wheelchair: t.wheelchair ?? null,
      });
    }
  }

  return { buildings, platformShapes, entrances, verticals, ways, segs };
}

const round4 = (n: number) => Math.round(n * 4) / 4;

/* ─────────────────────────────────────────────────────────── 3. curated */

interface PlaceOut {
  id: string;
  name: string;
  nameJa?: string;
  kind: string;
  operator: string;
  level: number;
  x: number;
  y: number;
  line?: [number, number][];
  footprints?: [number, number][][];
  height?: number;
  width?: number;
  desc?: string;
  planned?: boolean;
  provenance: string;
  tags?: Record<string, string>;
  /** 대표 노드 */
  node: number;
  /** 이 지점에 속한 모든 그래프 노드 (건물은 접속 층마다, 선형 지점은 중심선을 따라) */
  nodes?: number[];
  /** 경로 탐색의 출발·도착으로 쓸 수 있는 노드 */
  entries?: number[];
  /** 개찰 안쪽 */
  paid?: boolean;
  /** 건물이 바깥과 이어지는 층 / 수직 동선이 잇는 두 층 */
  connectLevels?: number[];
  /** 수직 동선의 종류 */
  linkKind?: LinkKind;
}

/** `bldg-hikarie@-3` → `bldg-hikarie` */
function baseId(ref: string): string {
  const i = ref.indexOf('@');
  return i < 0 ? ref : ref.slice(0, i);
}

function loadCurated(external: Map<string, number>): PlaceOut[] {
  const out: PlaceOut[] = [];
  const nodeOf = new Map<string, number>();
  /** 선형 지점(승강장·연락통로)은 중심선을 따라 노드를 여러 개 갖는다 */
  const chains = new Map<string, number[]>();

  for (const p of CURATED_PLACES) {
    const m = toMeters({ lat: p.at[0], lon: p.at[1] });
    const line = p.line?.map((ll) => {
      const q = toMeters({ lat: ll[0], lon: ll[1] });
      return { x: q.x, y: q.y };
    });

    let node: number;
    let chain: number[] | undefined;
    if (line && line.length >= 2) {
      chain = buildChain(p.id, line, p.level);
      chains.set(p.id, chain);
      node = chain[Math.floor(chain.length / 2)]!;
      // 체인을 따라 실제 거리만큼 걷게 한다. 승강장 남쪽 끝에서 북쪽 개찰로
      // 가려면 승강장 길이만큼 걸어야 한다는 사실이 여기서 나온다.
      for (let i = 1; i < chain.length; i++) {
        addEdge({
          a: chain[i - 1]!,
          b: chain[i]!,
          kind: 'walk',
          d: dist2(nodes[chain[i - 1]!]!, nodes[chain[i]!]!),
          bf: true,
          paid: p.paid,
          src: 'curated',
          note: `${p.name} 내부 이동`,
          planned: p.planned,
        });
      }
    } else {
      node = addNode(m.x, m.y, p.level, `curated:${p.id}`);
    }
    nodeOf.set(p.id, node);

    out.push({
      id: p.id,
      name: p.name,
      nameJa: p.nameJa,
      kind: p.kind,
      operator: p.operator,
      level: p.level,
      x: r1(m.x),
      y: r1(m.y),
      line: line?.map((q) => [r1(q.x), r1(q.y)] as [number, number]),
      width: p.width,
      desc: p.desc,
      planned: p.planned,
      provenance: 'curated',
      tags: p.tags,
      paid: p.paid,
      node,
      nodes: chain ?? [node],
      entries: [node],
    });
  }

  const paidOf = new Map(CURATED_PLACES.map((p) => [p.id, Boolean(p.paid)]));

  /** 링크 끝점 후보. 선형 지점은 체인 전체, 건물은 층별 노드. */
  const candidates = (ref: string): number[] => {
    const ext = external.get(ref);
    if (ext !== undefined) return [ext];
    const chain = chains.get(ref);
    if (chain) return chain;
    const n = nodeOf.get(ref);
    return n === undefined ? [] : [n];
  };

  for (const l of CURATED_LINKS) {
    const ca = candidates(l.from);
    const cb = candidates(l.to);
    if (!ca.length || !cb.length) {
      throw new Error(`curated 링크의 끝점을 찾을 수 없음: ${l.from} → ${l.to}`);
    }
    // 선형 지점에는 상대 지점에 가장 가까운 곳에 붙인다. 어느 계단·에스컬레이터를
    // 쓰는지를 손으로 지정하지 않아도, 실제 형상이 붙는 위치를 정해 준다.
    const [a, b] = nearestPair(ca, cb);
    const d = l.distance ?? dist2(nodes[a]!, nodes[b]!);
    addEdge({
      a,
      b,
      kind: l.kind,
      d,
      bf: l.barrierFree ?? BARRIER_FREE[l.kind],
      // 개찰은 경계이므로 개찰 자체는 유료가 아니다. 한쪽 끝이 승강장이나
      // 개찰 안 콘코스면 그 링크는 개찰 안쪽을 지난다.
      paid: paidOf.get(baseId(l.from)) || paidOf.get(baseId(l.to)),
      src: 'curated',
      planned: l.planned,
      note: l.note,
    });
  }

  return out;
}

/** 중심선을 따라 노드를 깐다. 긴 구간은 최대 `STEP` 간격으로 잘게 나눈다. */
const CHAIN_STEP = 35;

function buildChain(id: string, line: Vec2[], level: number): number[] {
  const chain: number[] = [addNode(line[0]!.x, line[0]!.y, level, `curated:${id}#0`)];
  let k = 1;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const len = dist2(a, b);
    const steps = Math.max(1, Math.round(len / CHAIN_STEP));
    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      chain.push(
        addNode(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, level, `curated:${id}#${k++}`),
      );
    }
  }
  return chain;
}

function nearestPair(ca: number[], cb: number[]): [number, number] {
  let best: [number, number] = [ca[0]!, cb[0]!];
  let bestD = Infinity;
  for (const a of ca) {
    for (const b of cb) {
      const d = dist2(nodes[a]!, nodes[b]!);
      if (d < bestD) {
        bestD = d;
        best = [a, b];
      }
    }
  }
  return best;
}

/* ────────────────────────────────────── 3-b. 실제 형상 붙이기 */

/**
 * 폴리라인을 폭 `w` 로 부풀려 폴리곤을 만든다.
 * 시부야역 승강장·연락통로는 완만한 곡선이라 단순 양측 오프셋으로 충분하다.
 */
function bufferLine(line: Vec2[], w: number): [number, number][] {
  if (line.length < 2) return [];
  const h = w / 2;
  const left: [number, number][] = [];
  const right: [number, number][] = [];

  for (let i = 0; i < line.length; i++) {
    const prev = line[Math.max(0, i - 1)]!;
    const next = line[Math.min(line.length - 1, i + 1)]!;
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    // 좌·우 법선
    const nx = -dy * h;
    const ny = dx * h;
    const p = line[i]!;
    left.push([r1(p.x + nx), r1(p.y + ny)]);
    right.push([r1(p.x - nx), r1(p.y - ny)]);
  }
  right.reverse();
  const ring = [...left, ...right];
  ring.push(ring[0]!);
  return ring;
}

/**
 * OSM 승강장 폴리곤을 curated 승강장에 붙인다.
 * 붙지 않는 승강장(= OSM 에 없는 JR 야마노테·사이쿄선)은 중심선을 부풀려 만든다.
 */
function attachShapes(
  places: PlaceOut[],
  shapes: { level: number; ring: [number, number][] }[],
): number {
  const targets = places.filter((p) => p.kind === 'platform');
  let matched = 0;

  for (const sh of shapes) {
    const c = centroid(sh.ring);
    let best: PlaceOut | null = null;
    let bestD = 90;
    for (const t of targets) {
      if (Math.abs(t.level - sh.level) > 0.5) continue;
      const d = Math.hypot(t.x - c.x, t.y - c.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (best) {
      (best.footprints ??= []).push(sh.ring);
      matched++;
    }
  }

  for (const p of places) {
    if (p.footprints?.length) continue;
    if (!p.line) continue;
    const line = p.line.map(([x, y]) => ({ x, y }));
    p.footprints = [bufferLine(line, p.width ?? 6)];
  }
  return matched;
}

/** 출입구 이름. 사업자가 안내에 쓰는 이름/기호를 그대로 살린다. */
const ENTRANCE_NAMES: Record<string, string> = {
  ハチ公口: '하치코 출입구',
  西口: '서 출입구',
  東口: '동 출입구',
  南口: '남 출입구',
  北口: '북 출입구',
  新南口: '신남 출입구',
  新南改札: '신남개찰',
  宮益坂口: '미야마스자카 출입구',
  玉川口: '다마가와 출입구',
  中央改札: '중앙개찰',
};

function entranceName(name: string | null, ref: string | null): string {
  if (name) {
    const ko = ENTRANCE_NAMES[name];
    if (ko) return ref ? `${ko} (${ref})` : ko;
    // 「渋谷駅」·「渋谷駅8」 처럼 이름만으로는 구분이 안 되는 경우가 대부분이라
    // 실제 안내에 쓰이는 출구 기호를 앞세운다.
    if (ref) return `${ref} 출입구`;
    return name;
  }
  return ref ? `${ref} 출입구` : '출입구';
}

/** 주요 건물과 지상 출입구를 선택 가능한 지점으로 올린다. */
function emitOsmPlaces(osm: OsmOut): { places: PlaceOut[]; ids: Map<string, number> } {
  const places: PlaceOut[] = [];
  const ids = new Map<string, number>();

  for (const raw of osm.buildings) {
    const b = raw as {
      id: string;
      landmark?: string;
      name: string | null;
      height: number | null;
      levels: number | null;
      ring: [number, number][];
    };
    if (!b.landmark) continue;
    const meta = [...LANDMARK_BY_NAME.values()].find((l) => l.id === b.landmark);
    const c = centroid(b.ring);
    const connect = meta?.connectLevels?.length ? meta.connectLevels : [1];

    // 접속 층마다 노드를 하나씩 두고, 그 사이를 건물 내부 수직 동선으로 잇는다.
    const perLevel = connect.map((lv) => ({
      lv,
      node: addNode(c.x, c.y, lv, `osmb:${b.id}@${lv}`),
    }));
    for (const { lv, node } of perLevel) {
      ids.set(`${b.landmark}@${lv}`, node);
    }
    ids.set(b.landmark, perLevel[0]!.node);

    const sorted = [...perLevel].sort((x, y) => x.lv - y.lv);
    for (let i = 1; i < sorted.length; i++) {
      const lo = sorted[i - 1]!;
      const hi = sorted[i]!;
      const dz = levelZ(hi.lv) - levelZ(lo.lv);
      const travel = Math.abs(dz) * 1.4;
      // 건물 안 수직 동선은 EV 와 ES 가 함께 있는 것이 보통이라 둘 다 넣는다.
      for (const kind of ['elevator', 'escalator'] as LinkKind[]) {
        addEdge({
          a: lo.node,
          b: hi.node,
          kind,
          d: travel,
          bf: BARRIER_FREE[kind],
          src: 'curated',
          note: `건물 내부 ${kind === 'elevator' ? '엘리베이터' : '에스컬레이터'}`,
        });
      }
    }

    // 발자국은 지상에 그리므로 대표 층은 1층(있으면), 없으면 가장 낮은 접속 층.
    const ground = perLevel.find((x) => x.lv === 1) ?? sorted[0]!;
    places.push({
      id: b.landmark,
      name: meta?.name ?? b.name ?? b.landmark,
      nameJa: b.name ?? undefined,
      kind: 'building',
      operator: 'facility',
      level: ground.lv,
      x: r1(c.x),
      y: r1(c.y),
      footprints: [b.ring],
      height: b.height ?? (b.levels ? b.levels * 4.2 : undefined) ?? undefined,
      desc: meta?.desc,
      provenance: 'osm',
      tags: meta?.tags,
      connectLevels: connect,
      node: ground.node,
      nodes: perLevel.map((x) => x.node),
      entries: perLevel.map((x) => x.node),
    });
  }

  for (const raw of osm.entrances) {
    const e = raw as {
      id: string;
      name: string | null;
      nameEn: string | null;
      ref: string | null;
      wheelchair: string | null;
      railway: string;
      x: number;
      y: number;
    };
    const node = addNode(e.x, e.y, 1, `osme:${e.id}`);
    const tags: Record<string, string> = {};
    if (e.ref) tags['출구 기호'] = e.ref;
    if (e.wheelchair) {
      tags['휠체어'] =
        { yes: '가능', no: '불가', limited: '일부 가능' }[e.wheelchair] ?? e.wheelchair;
    }
    if (e.name) tags['원표기'] = e.name;
    places.push({
      id: e.id.replace(':', '-'),
      name: entranceName(e.name, e.ref),
      nameJa: e.name ?? undefined,
      kind: 'entrance',
      operator: e.railway === 'subway_entrance' ? 'metro' : 'jr',
      level: 1,
      x: e.x,
      y: e.y,
      desc:
        e.railway === 'subway_entrance' ? '지하철 지상 출입구입니다.' : '역 지상 출입구입니다.',
      provenance: 'osm',
      tags: Object.keys(tags).length ? tags : undefined,
      node,
      nodes: [node],
      entries: [node],
    });
  }

  for (const v of osm.verticals) {
    const lo = Math.min(v.from, v.to);
    const hi = Math.max(v.from, v.to);
    const label = VERTICAL_LABELS[v.kind] ?? '수직 동선';
    const tags: Record<string, string> = {
      구간: `${levelCode(lo)} ↔ ${levelCode(hi)}`,
    };
    if (v.conveying && v.conveying !== 'no') {
      tags['운행 방향'] =
        { yes: '단방향', both: '양방향', reversible: '시간대별 전환', forward: '단방향', backward: '단방향' }[
          v.conveying
        ] ?? v.conveying;
    }
    if (v.wheelchair) {
      tags['휠체어'] =
        { yes: '가능', no: '불가', limited: '일부 가능' }[v.wheelchair] ?? v.wheelchair;
    }
    places.push({
      id: v.id,
      name: v.name ? `${v.name} ${label}` : `${label} ${levelCode(lo)}–${levelCode(hi)}`,
      kind: 'vertical',
      operator: 'facility',
      level: lo,
      x: v.x,
      y: v.y,
      desc: 'OpenStreetMap 에 실좌표로 등록된 수직 동선입니다. 같은 통로라도 설비마다 도착하는 층·방면이 다릅니다.',
      provenance: 'osm',
      tags,
      linkKind: v.kind,
      connectLevels: [lo, hi],
      node: v.nodeLo,
      nodes: [v.nodeLo, v.nodeHi],
      entries: [v.nodeLo, v.nodeHi],
    });
  }

  return { places, ids };
}

const VERTICAL_LABELS: Partial<Record<LinkKind, string>> = {
  stairs: '계단',
  escalator: '에스컬레이터',
  elevator: '엘리베이터',
};

/* ───────────────────────────────────────────── 4. 레이어 간 접합(스냅) */

/**
 * curated / MLIT 노드를 가까운 OSM 보행 노드에 붙인다.
 *
 * MLIT 보행망과 OSM 보도는 같은 옥외 보도를 서로 다르게 그린 것이라 대개
 * 10m 안쪽에서 만난다. 반면 curated 개찰·승강장은 대표점 하나로 축약돼 있어
 * 더 넓게 잡아야 지상 보행망에 닿는다. 층 차이가 큰 곳끼리 잘못 이어지지
 * 않도록 같은 층(±0.5) 안에서만 후보를 찾는다.
 */
function stitch(
  radii: { mlit: number; curated: number; building: number },
  paidNodes: Set<number>,
): number {
  const osmNodes = nodes.filter((n) => nodeKeyOf(n.i)?.startsWith('osm:'));
  let made = 0;

  for (const n of nodes) {
    const key = nodeKeyOf(n.i);
    if (!key || key.startsWith('osm:')) continue;
    // 승강장·개찰 안 콘코스를 바깥 보도에 바로 붙이면 개찰을 통과하지 않고
    // 승강장으로 들어가는 가짜 경로가 생긴다.
    if (paidNodes.has(n.i)) continue;
    const maxDist = key.startsWith('mlit:')
      ? radii.mlit
      : key.startsWith('osmb:')
        ? // 건물은 대표점이 덩어리 한가운데라 가장 가까운 보도까지 거리가 멀다.
          radii.building
        : radii.curated;
    let best: GNode | null = null;
    let bestD = maxDist;
    for (const o of osmNodes) {
      if (Math.abs(o.level - n.level) > 0.5) continue;
      const d = Math.hypot(o.x - n.x, o.y - n.y);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (best) {
      addEdge({
        a: n.i,
        b: best.i,
        kind: 'walk',
        d: bestD,
        bf: true,
        src: key.startsWith('mlit:') ? 'mlit' : key.startsWith('osm') ? 'osm' : 'curated',
        note: '레이어 접합',
      });
      made++;
    }
  }
  return made;
}

const keyOfNode = new Map<number, string>();
function nodeKeyOf(i: number): string | undefined {
  return keyOfNode.get(i);
}

/* ──────────────────────────────────────────────────────────────── 검증 */

function largestComponent(): { size: number; components: number } {
  const adj = new Map<number, number[]>();
  for (const e of edges) {
    (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push(e.b);
    (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push(e.a);
  }
  const seen = new Set<number>();
  let best = 0;
  let comps = 0;
  for (const n of nodes) {
    if (seen.has(n.i)) continue;
    comps++;
    let size = 0;
    const stack = [n.i];
    seen.add(n.i);
    while (stack.length) {
      const cur = stack.pop()!;
      size++;
      for (const nb of adj.get(cur) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    if (size > best) best = size;
  }
  return { size: best, components: comps };
}

/**
 * 최대 연결 성분에 속한 노드 집합.
 * `includePlanned` 가 false 면 공사 중 링크를 빼고 계산한다 — 아직 없는 시설을
 * 통해서만 닿는 지점은 지금은 갈 수 없는 곳이다.
 */
function mainComponent(includePlanned: boolean): Set<number> {
  const adj = new Map<number, number[]>();
  for (const e of edges) {
    if (e.planned && !includePlanned) continue;
    (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push(e.b);
    (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push(e.a);
  }
  const seen = new Set<number>();
  let bestSet: Set<number> = new Set();
  for (const n of nodes) {
    if (seen.has(n.i)) continue;
    const set = new Set<number>([n.i]);
    const stack = [n.i];
    seen.add(n.i);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nb of adj.get(cur) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          set.add(nb);
          stack.push(nb);
        }
      }
    }
    if (set.size > bestSet.size) bestSet = set;
  }
  return bestSet;
}

/* ───────────────────────────────────────────────────────────────── main */

async function main() {
  const mlit = await loadMlit();
  const osm = await loadOsm();
  // 건물·출입구를 먼저 올려야 curated 링크가 이들을 끝점으로 참조할 수 있다.
  const emitted = emitOsmPlaces(osm);
  const places = loadCurated(emitted.ids);
  const shapesMatched = attachShapes(
    places,
    osm.platformShapes as { level: number; ring: [number, number][] }[],
  );
  places.push(...emitted.places);

  for (const [k, v] of nodeKey) keyOfNode.set(v, k);
  const stitched = stitch(
    { mlit: 12, curated: 45, building: 140 },
    new Set(places.filter((p) => p.paid).flatMap((p) => p.nodes ?? [p.node])),
  );

  const comp = largestComponent();

  // 주 네트워크에 닿지 않는 지점은 경로 안내에 쓸 수 없다.
  // OSM 유래(고립된 출입구 등)는 조용히 버리고, curated 는 데이터 오류이므로 실패시킨다.
  const mainAll = mainComponent(true);
  const mainNow = mainComponent(false);
  // 공사 중 지점은 개통을 가정했을 때 닿으면 되고, 나머지는 지금 닿아야 한다.
  const orphans = places.filter((p) =>
    p.planned ? !mainAll.has(p.node) : !mainNow.has(p.node),
  );
  const badCurated = orphans.filter((p) => p.provenance === 'curated');
  if (badCurated.length) {
    throw new Error(
      `주 네트워크에서 끊긴 curated 지점: ${badCurated.map((p) => p.id).join(', ')}`,
    );
  }
  const dropped = orphans.map((p) => p.id);
  for (const p of dropped) {
    const i = places.findIndex((q) => q.id === p);
    if (i >= 0) places.splice(i, 1);
  }

  const sources = JSON.parse(await readFile(join(RAW, 'sources.json'), 'utf8'));

  const out = {
    meta: {
      builtAt: new Date().toISOString(),
      origin: ORIGIN,
      radius: RADIUS,
      sources,
      counts: {
        mlitNodes: mlit.nodes,
        mlitLinks: mlit.links,
        osmWays: osm.ways,
        osmSegments: osm.segs,
        buildings: osm.buildings.length,
        platformShapes: osm.platformShapes.length,
        entrances: osm.entrances.length,
        curatedPlaces: CURATED_PLACES.length,
        landmarkPlaces: places.filter((p) => p.kind === 'building').length,
        entrancePlaces: places.filter((p) => p.kind === 'entrance').length,
        verticalPlaces: places.filter((p) => p.kind === 'vertical').length,
        droppedPlaces: dropped.length,
        platformShapesMatched: shapesMatched,
        curatedLinks: CURATED_LINKS.length,
        stitched,
        graphNodes: nodes.length,
        graphEdges: edges.length,
        largestComponent: comp.size,
        components: comp.components,
      },
    },
    buildings: osm.buildings,
    platformShapes: osm.platformShapes,
    entrances: osm.entrances,
    places,
    graph: {
      nodes: nodes.map((n) => [n.x, n.y, n.level]),
      edges: edges.map((e) => ({
        a: e.a,
        b: e.b,
        k: e.kind,
        d: e.d,
        s: e.s,
        bf: e.bf ? 1 : 0,
        ...(e.paid ? { paid: 1 as const } : {}),
        ...(e.vertical ? { v: e.vertical } : {}),
        src: e.src,
        ...(e.planned ? { p: 1 } : {}),
        ...(e.note ? { n: e.note } : {}),
      })),
    },
  };

  await mkdir(OUT, { recursive: true });
  const json = JSON.stringify(out);
  await writeFile(join(OUT, 'map.json'), json);
  // 런타임에 fetch 로 읽는다. 번들에 인라인하면 초기 JS 가 500KB 늘어난다.
  const pub = join(ROOT, 'public', 'data');
  await mkdir(pub, { recursive: true });
  await writeFile(join(pub, 'map.json'), json);

  console.table(out.meta.counts);
  console.log(
    `\nmap.json ${(json.length / 1024).toFixed(0)} KB` +
      `  sha256 ${createHash('sha256').update(json).digest('hex').slice(0, 12)}`,
  );
  if (dropped.length) {
    console.warn(`\n주 네트워크에 닿지 않아 제외한 OSM 지점 ${dropped.length}개: ${dropped.join(', ')}`);
  }
  if (comp.size < nodes.length * 0.7) {
    console.warn(
      `⚠ 최대 연결 성분이 전체의 ${((comp.size / nodes.length) * 100).toFixed(1)}% 뿐이다. 접합 반경을 확인할 것.`,
    );
  }
}

await main();
