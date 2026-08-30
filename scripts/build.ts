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
import { levelZ, mlitFloorToLevel } from '../src/lib/levels.ts';
import {
  buildingHeight,
  isClosed,
  parseLevels,
  primaryLevel,
  type OsmElement,
  type OsmResponse,
} from '../src/lib/osm.ts';
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
const SPEEDS: Record<LinkKind, (d: number, dz: number) => number> = {
  walk: (d) => d / WALK_SPEED,
  transfer: (d) => d / 1.1,
  ramp: (d, dz) => d / 1.05 + Math.abs(dz) * 1.5,
  // 계단은 단높이 0.17m 기준 한 단 0.55초, 하행은 0.75배
  stairs: (d, dz) => d / 1.0 + (Math.abs(dz) / 0.17) * (dz > 0 ? 0.55 : 0.42),
  // 에스컬레이터: 대기 5초 + 경사 이동. 수직 0.33 m/s
  escalator: (_d, dz) => 5 + Math.abs(dz) / 0.33,
  // 엘리베이터: 호출·승하차 대기 25초 + 1.0 m/s
  elevator: (_d, dz) => 25 + Math.abs(dz) / 1.0,
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
  ways: number;
  segs: number;
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
      buildings.push({
        id: `osm:w${e.id}`,
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

    const total = polylineLength(pts) || 1;
    let acc = 0;
    let prev = addNode(pts[0]!.x, pts[0]!.y, from, `osm:${ids[0]}@${from}`);
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
        note: t.name ?? undefined,
      });
      prev = cur;
      segs++;
      placed = true;
    }
    if (placed) ways++;
  }

  return { buildings, platformShapes, entrances, ways, segs };
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
  width?: number;
  desc?: string;
  planned?: boolean;
  provenance: string;
  tags?: Record<string, string>;
  node: number;
}

function loadCurated(): PlaceOut[] {
  const out: PlaceOut[] = [];
  const nodeOf = new Map<string, number>();

  for (const p of CURATED_PLACES) {
    const m = toMeters({ lat: p.at[0], lon: p.at[1] });
    const n = addNode(m.x, m.y, p.level, `curated:${p.id}`);
    nodeOf.set(p.id, n);
    out.push({
      id: p.id,
      name: p.name,
      nameJa: p.nameJa,
      kind: p.kind,
      operator: p.operator,
      level: p.level,
      x: r1(m.x),
      y: r1(m.y),
      line: p.line?.map((ll) => {
        const q = toMeters({ lat: ll[0], lon: ll[1] });
        return [r1(q.x), r1(q.y)] as [number, number];
      }),
      width: p.width,
      desc: p.desc,
      planned: p.planned,
      provenance: 'curated',
      tags: p.tags,
      node: n,
    });
  }

  for (const l of CURATED_LINKS) {
    const a = nodeOf.get(l.from);
    const b = nodeOf.get(l.to);
    if (a === undefined || b === undefined) {
      throw new Error(`curated 링크의 끝점을 찾을 수 없음: ${l.from} → ${l.to}`);
    }
    const d = l.distance ?? dist2(nodes[a]!, nodes[b]!);
    addEdge({
      a,
      b,
      kind: l.kind,
      d,
      bf: l.barrierFree ?? BARRIER_FREE[l.kind],
      src: 'curated',
      planned: l.planned,
      note: l.note,
    });
  }

  return out;
}

/* ───────────────────────────────────────────── 4. 레이어 간 접합(스냅) */

/**
 * curated / MLIT 노드를 가까운 OSM 보행 노드에 붙인다.
 *
 * MLIT 보행망과 OSM 보도는 같은 옥외 보도를 서로 다르게 그린 것이라 대개
 * 10m 안쪽에서 만난다. 반면 curated 개찰·승강장은 대표점 하나로 축약돼 있어
 * 더 넓게 잡아야 지상 보행망에 닿는다. 층 차이가 큰 곳끼리 잘못 이어지지
 * 않도록 같은 층(±0.5) 안에서만 후보를 찾는다.
 */
function stitch(radii: { mlit: number; curated: number }): number {
  const osmNodes = nodes.filter((n) => nodeKeyOf(n.i)?.startsWith('osm:'));
  let made = 0;

  for (const n of nodes) {
    const key = nodeKeyOf(n.i);
    if (!key || key.startsWith('osm:')) continue;
    const maxDist = key.startsWith('mlit:') ? radii.mlit : radii.curated;
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
        src: key.startsWith('mlit:') ? 'mlit' : 'curated',
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

/** curated 지점이 최대 연결 성분 안에 들어와 있는지 확인한다. */
function checkCurated(places: PlaceOut[]): string[] {
  const adj = new Map<number, number[]>();
  for (const e of edges) {
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
  return places.filter((p) => !bestSet.has(p.node)).map((p) => p.id);
}

/* ───────────────────────────────────────────────────────────────── main */

async function main() {
  const mlit = await loadMlit();
  const osm = await loadOsm();
  const places = loadCurated();

  for (const [k, v] of nodeKey) keyOfNode.set(v, k);
  const stitched = stitch({ mlit: 12, curated: 45 });

  const comp = largestComponent();
  const orphans = checkCurated(places);

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
        curatedPlaces: places.length,
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
  if (orphans.length) {
    console.warn(`\n⚠ 주 네트워크에서 끊긴 curated 지점 ${orphans.length}개: ${orphans.join(', ')}`);
  }
  if (comp.size < nodes.length * 0.7) {
    console.warn(
      `⚠ 최대 연결 성분이 전체의 ${((comp.size / nodes.length) * 100).toFixed(1)}% 뿐이다. 접합 반경을 확인할 것.`,
    );
  }
}

await main();
