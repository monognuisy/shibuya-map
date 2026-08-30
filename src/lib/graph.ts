/** 통합 보행 그래프 위의 경로 탐색. */
import type { EdgeDoc, MapDoc, PlaceDoc } from './mapdoc';
import { levelZ } from './levels';

export interface RouteOptions {
  /** 계단·에스컬레이터를 피하고 엘리베이터·평지만 사용 */
  barrierFree: boolean;
  /** 공사중 시설을 개통했다고 가정 */
  includePlanned: boolean;
  /**
   * 개찰 안쪽을 지름길로 쓰지 않는다.
   *
   * 출발·도착이 승강장이면 개찰을 나오고 들어가는 것 자체는 피할 수 없으므로,
   * 「개찰 안 → 개찰 밖 → 개찰 안」 한 번씩만 허용하고 중간에 다시 개찰 안으로
   * 들어갔다 나오는 경로를 막는다. 둘 다 개찰 밖이면 개찰 안을 아예 쓰지 않는다.
   */
  avoidPaidShortcut: boolean;
}

export interface RouteStep {
  edge: EdgeDoc;
  from: number;
  to: number;
  seconds: number;
  distance: number;
}

export interface RouteResult {
  steps: RouteStep[];
  nodes: number[];
  seconds: number;
  distance: number;
  /** 경로가 지나는 층 (진행 순서) */
  levels: number[];
  climb: number;
  descend: number;
  /** 개찰 안/밖이 바뀐 횟수 = 개찰 통과 횟수 */
  gateCrossings: number;
}

/** 개찰 통과 제약을 위한 진행 단계. 0 → 1 → 2 로만 넘어간다. */
const PHASES = 3;

export class WalkGraph {
  private adj: { to: number; e: EdgeDoc }[][];

  constructor(private doc: MapDoc) {
    this.adj = doc.graph.nodes.map(() => []);
    for (const e of doc.graph.edges) {
      this.adj[e.a]?.push({ to: e.b, e });
      this.adj[e.b]?.push({ to: e.a, e });
    }
  }

  get nodeCount(): number {
    return this.doc.graph.nodes.length;
  }

  /** 지점이 가진 모든 노드. 건물은 접속 층마다 하나씩 있다. */
  static nodesOf(p: PlaceDoc): number[] {
    return p.nodes?.length ? p.nodes : [p.node];
  }

  private usable(e: EdgeDoc, o: RouteOptions): boolean {
    if (e.p && !o.includePlanned) return false;
    if (o.barrierFree && !e.bf) return false;
    return true;
  }

  /**
   * 다익스트라. 비용은 보행 시간(초).
   * 여러 출발·도착 노드를 받는다(건물처럼 접속점이 여럿인 지점 때문).
   */
  route(from: number[], to: number[], o: RouteOptions): RouteResult | null {
    const n = this.nodeCount;
    const starts = from.filter((i) => i >= 0 && i < n);
    const goals = new Set(to.filter((i) => i >= 0 && i < n));
    if (!starts.length || !goals.size) return null;

    // 개찰 제약이 없으면 단계는 하나뿐이다.
    const phases = o.avoidPaidShortcut ? PHASES : 1;
    const idx = (node: number, ph: number) => node * phases + ph;

    const size = n * phases;
    const dist = new Float64Array(size).fill(Infinity);
    const prev = new Int32Array(size).fill(-1);
    const prevEdge: (EdgeDoc | null)[] = new Array(size).fill(null);
    const done = new Uint8Array(size);

    const heap = new BinaryHeap();
    for (const s of starts) {
      const k = idx(s, 0);
      if (dist[k] !== 0) {
        dist[k] = 0;
        heap.push(k, 0);
      }
    }

    let end = -1;
    while (heap.size) {
      const cur = heap.pop()!;
      if (done[cur]) continue;
      done[cur] = 1;
      const node = Math.floor(cur / phases);
      const ph = cur % phases;
      if (goals.has(node)) {
        end = cur;
        break;
      }
      for (const { to: nb, e } of this.adj[node]!) {
        if (!this.usable(e, o)) continue;
        const nextPh = phases === 1 ? 0 : nextPhase(ph, Boolean(e.paid));
        if (nextPh < 0) continue;
        const k = idx(nb, nextPh);
        if (done[k]) continue;
        const nd = dist[cur]! + e.s;
        if (nd < dist[k]!) {
          dist[k] = nd;
          prev[k] = cur;
          prevEdge[k] = e;
          heap.push(k, nd);
        }
      }
    }

    if (end < 0) return null;

    const nodes: number[] = [];
    const steps: RouteStep[] = [];
    for (let cur = end; cur !== -1; cur = prev[cur]!) {
      nodes.push(Math.floor(cur / phases));
      const e = prevEdge[cur];
      const p = prev[cur]!;
      if (e && p !== -1) {
        steps.push({
          edge: e,
          from: Math.floor(p / phases),
          to: Math.floor(cur / phases),
          seconds: e.s,
          distance: e.d,
        });
      }
    }
    nodes.reverse();
    steps.reverse();

    const levels: number[] = [];
    let climb = 0;
    let descend = 0;
    for (let i = 0; i < nodes.length; i++) {
      const lv = this.doc.graph.nodes[nodes[i]!]![2];
      if (levels[levels.length - 1] !== lv) levels.push(lv);
      if (i > 0) {
        const dz = levelZ(lv) - levelZ(this.doc.graph.nodes[nodes[i - 1]!]![2]);
        if (dz > 0) climb += dz;
        else descend -= dz;
      }
    }

    let gateCrossings = 0;
    for (let i = 1; i < steps.length; i++) {
      if (Boolean(steps[i]!.edge.paid) !== Boolean(steps[i - 1]!.edge.paid)) gateCrossings++;
    }

    return {
      steps,
      nodes,
      seconds: Math.round(dist[end]!),
      distance: Math.round(steps.reduce((a, s) => a + s.distance, 0)),
      levels,
      climb: Math.round(climb),
      descend: Math.round(descend),
      gateCrossings,
    };
  }

  /** 좌표에서 가장 가까운 그래프 노드 (같은 층 우선). */
  nearest(x: number, y: number, level?: number): number {
    let best = -1;
    let bestD = Infinity;
    const ns = this.doc.graph.nodes;
    for (let i = 0; i < ns.length; i++) {
      const nd = ns[i]!;
      if (level !== undefined && Math.abs(nd[2] - level) > 0.5) continue;
      const d = (nd[0] - x) ** 2 + (nd[1] - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
}

/**
 * 개찰 안(`paid`)·밖(free) 을 오가는 순서를 `안* 밖* 안*` 으로 제한한다.
 * 허용되지 않는 전이는 -1.
 */
function nextPhase(phase: number, paid: boolean): number {
  if (phase === 0) return paid ? 0 : 1;
  if (phase === 1) return paid ? 2 : 1;
  return paid ? 2 : -1;
}

/** 최소 힙. n 이 1만 규모라 배열 기반으로 충분하다. */
class BinaryHeap {
  private ids: number[] = [];
  private ws: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, w: number): void {
    this.ids.push(id);
    this.ws.push(w);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.ws[p]! <= this.ws[i]!) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number | undefined {
    if (!this.ids.length) return undefined;
    const top = this.ids[0]!;
    const lastId = this.ids.pop()!;
    const lastW = this.ws.pop()!;
    if (this.ids.length) {
      this.ids[0] = lastId;
      this.ws[0] = lastW;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.ids.length && this.ws[l]! < this.ws[m]!) m = l;
        if (r < this.ids.length && this.ws[r]! < this.ws[m]!) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.ids[a], this.ids[b]] = [this.ids[b]!, this.ids[a]!];
    [this.ws[a], this.ws[b]] = [this.ws[b]!, this.ws[a]!];
  }
}

/** 초 → "3분 20초" */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (!m) return `${s}초`;
  return s ? `${m}분 ${s}초` : `${m}분`;
}
