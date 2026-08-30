/** 통합 보행 그래프 위의 경로 탐색. */
import type { EdgeDoc, MapDoc } from './mapdoc';
import { levelZ } from './levels';

export interface RouteOptions {
  /** 계단·에스컬레이터를 피하고 엘리베이터·평지만 사용 */
  barrierFree: boolean;
  /** 공사중 시설을 개통했다고 가정 */
  includePlanned: boolean;
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
}

export class WalkGraph {
  /** 노드별 인접 리스트 */
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

  private usable(e: EdgeDoc, o: RouteOptions): boolean {
    if (e.p && !o.includePlanned) return false;
    if (o.barrierFree && !e.bf) return false;
    return true;
  }

  /** 다익스트라. 비용은 보행 시간(초). */
  route(from: number, to: number, o: RouteOptions): RouteResult | null {
    const n = this.nodeCount;
    if (from < 0 || to < 0 || from >= n || to >= n) return null;

    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const prevEdge: (EdgeDoc | null)[] = new Array(n).fill(null);
    const done = new Uint8Array(n);
    dist[from] = 0;

    const heap = new BinaryHeap();
    heap.push(from, 0);

    while (heap.size) {
      const cur = heap.pop()!;
      if (done[cur]) continue;
      done[cur] = 1;
      if (cur === to) break;
      for (const { to: nb, e } of this.adj[cur]!) {
        if (done[nb] || !this.usable(e, o)) continue;
        const nd = dist[cur]! + e.s;
        if (nd < dist[nb]!) {
          dist[nb] = nd;
          prev[nb] = cur;
          prevEdge[nb] = e;
          heap.push(nb, nd);
        }
      }
    }

    if (!Number.isFinite(dist[to]!)) return null;

    const nodes: number[] = [];
    const steps: RouteStep[] = [];
    for (let cur = to; cur !== -1; cur = prev[cur]!) {
      nodes.push(cur);
      const e = prevEdge[cur];
      if (e && prev[cur] !== -1) {
        steps.push({ edge: e, from: prev[cur]!, to: cur, seconds: e.s, distance: e.d });
      }
      if (cur === from) break;
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

    return {
      steps,
      nodes,
      seconds: Math.round(dist[to]!),
      distance: Math.round(steps.reduce((a, s) => a + s.distance, 0)),
      levels,
      climb: Math.round(climb),
      descend: Math.round(descend),
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

/** 최소 힙. n 이 수천 규모라 배열 기반으로 충분하다. */
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
