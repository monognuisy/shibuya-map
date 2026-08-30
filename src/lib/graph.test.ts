import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { WalkGraph } from './graph';
import type { MapDoc } from './mapdoc';

const doc = JSON.parse(readFileSync('data/build/map.json', 'utf8')) as MapDoc;
const graph = new WalkGraph(doc);
const placeOf = (id: string) => {
  const p = doc.places.find((q) => q.id === id);
  if (!p) throw new Error(`no place ${id}`);
  return WalkGraph.nodesOf(p);
};

const opts = { barrierFree: false, includePlanned: false, avoidPaidShortcut: false };

describe('경로 탐색', () => {
  it('야마노테선 승강장 → 도요코선 승강장 경로가 존재하고 층을 넘나든다', () => {
    const r = graph.route(placeOf('plat-jr-yamanote'), placeOf('plat-toyoko-fukutoshin-34'), opts);
    expect(r).not.toBeNull();
    expect(r!.seconds).toBeGreaterThan(60);
    expect(r!.seconds).toBeLessThan(60 * 25);
    expect(new Set(r!.levels).size).toBeGreaterThan(2);
  });

  it('모든 curated 지점이 하치코 광장에서 도달 가능', () => {
    const start = placeOf('plaza-hachiko');
    const unreachable = doc.places
      .filter((p) => !p.planned)
      .filter((p) => graph.route(start, WalkGraph.nodesOf(p), opts) === null)
      .map((p) => p.id);
    expect(unreachable).toEqual([]);
  });

  it('배리어프리 경로는 계단·에스컬레이터를 쓰지 않는다', () => {
    const r = graph.route(placeOf('plaza-hachiko'), placeOf('gate-jr-chuo'), {
      barrierFree: true,
      includePlanned: false,
      avoidPaidShortcut: false,
    });
    if (r) {
      expect(r.steps.every((s) => s.edge.bf === 1)).toBe(true);
    }
  });

  it('주요 승강장 사이는 배리어프리 경로가 존재한다', () => {
    const bf = { barrierFree: true, includePlanned: false, avoidPaidShortcut: false };
    const pairs: [string, string][] = [
      ['plat-jr-yamanote', 'plat-toyoko-fukutoshin-34'],
      ['plat-inokashira', 'plat-dt-hanzomon'],
      ['plat-ginza', 'plaza-hachiko'],
    ];
    for (const [a, b] of pairs) {
      const r = graph.route(placeOf(a), placeOf(b), bf);
      expect(r, `${a} → ${b}`).not.toBeNull();
      expect(r!.steps.every((s) => s.edge.bf === 1)).toBe(true);
    }
  });

  it('개찰 밖 두 지점은 개찰 안을 지나지 않고 이어진다', () => {
    const r = graph.route(placeOf('plaza-hachiko'), placeOf('bldg-hikarie'), {
      ...opts,
      avoidPaidShortcut: true,
    });
    expect(r).not.toBeNull();
    expect(r!.steps.some((s) => s.edge.paid)).toBe(false);
    expect(r!.gateCrossings).toBe(0);
  });

  it('승강장 사이 경로는 개찰을 두 번만 지난다', () => {
    const r = graph.route(placeOf('plat-jr-yamanote'), placeOf('plat-toyoko-fukutoshin-34'), {
      ...opts,
      avoidPaidShortcut: true,
    });
    expect(r).not.toBeNull();
    expect(r!.gateCrossings).toBeLessThanOrEqual(2);
  });

  it('승강장은 개찰을 거치지 않고 거리에서 바로 닿지 않는다', () => {
    const plat = placeOf('plat-jr-yamanote');
    const paidEdges = doc.graph.edges.filter((e) => e.paid);
    // 승강장 노드에 붙은 링크는 전부 개찰 안쪽이어야 한다
    for (const n of plat) {
      const touching = doc.graph.edges.filter((e) => e.a === n || e.b === n);
      expect(touching.length).toBeGreaterThan(0);
      expect(touching.every((e) => e.paid === 1)).toBe(true);
    }
    expect(paidEdges.length).toBeGreaterThan(0);
  });

  it('건물은 접속 층마다 노드를 갖는다', () => {
    const b = doc.places.find((p) => p.id === 'bldg-scramble-square')!;
    expect(b.connectLevels).toEqual([3, 2, 1, -2]);
    expect(WalkGraph.nodesOf(b)).toHaveLength(4);
    const levels = WalkGraph.nodesOf(b).map((n) => doc.graph.nodes[n]![2]);
    expect(new Set(levels)).toEqual(new Set([3, 2, 1, -2]));
  });

  it('승강장은 중심선을 따라 노드 체인을 갖는다', () => {
    const plat = doc.places.find((p) => p.id === 'plat-jr-yamanote')!;
    expect(plat.nodes!.length).toBeGreaterThan(5);
    // 남쪽 끝과 북쪽 끝은 승강장 길이만큼 떨어져 있어야 한다
    const ys = plat.nodes!.map((n) => doc.graph.nodes[n]![1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(150);
    // 출발·도착으로는 대표점 하나만 쓴다
    expect(WalkGraph.nodesOf(plat)).toHaveLength(1);
  });

  it('승강장 남쪽 개찰과 북쪽 개찰은 서로 다른 지점에 붙는다', () => {
    const plat = doc.places.find((p) => p.id === 'plat-jr-yamanote')!;
    const chain = new Set(plat.nodes!);
    const attach = (gateId: string) => {
      const g = doc.places.find((p) => p.id === gateId)!;
      const e = doc.graph.edges.find(
        (x) =>
          (chain.has(x.a) && g.nodes!.includes(x.b)) || (chain.has(x.b) && g.nodes!.includes(x.a)),
      );
      expect(e, gateId).toBeDefined();
      const n = chain.has(e!.a) ? e!.a : e!.b;
      return doc.graph.nodes[n]![1];
    };
    // 신남개찰(남쪽)과 하치코개찰(북쪽)의 접속 지점이 100m 이상 떨어져 있어야
    // '어느 쪽 에스컬레이터를 타느냐'가 거리로 드러난다
    expect(attach('gate-jr-hachiko') - attach('gate-jr-shinminami')).toBeGreaterThan(100);
  });

  it('OSM 수직 동선이 개별 시설로 올라온다', () => {
    const vs = doc.places.filter((p) => p.kind === 'vertical');
    expect(vs.length).toBeGreaterThan(10);
    expect(vs.some((v) => v.linkKind === 'escalator')).toBe(true);
    for (const v of vs) {
      expect(v.connectLevels).toHaveLength(2);
      expect(v.connectLevels![0]).toBeLessThan(v.connectLevels![1]);
    }
    // 링크에서 어느 설비인지 되짚을 수 있어야 한다
    expect(doc.graph.edges.some((e) => e.v)).toBe(true);
  });

  it('공사중 링크는 기본 옵션에서 제외된다', () => {
    const withPlanned = graph.route(placeOf('plaza-hachiko'), placeOf('plan-skyway'), {
      barrierFree: false,
      includePlanned: true,
      avoidPaidShortcut: false,
    });
    const without = graph.route(placeOf('plaza-hachiko'), placeOf('plan-skyway'), opts);
    expect(withPlanned).not.toBeNull();
    expect(without).toBeNull();
  });
});
