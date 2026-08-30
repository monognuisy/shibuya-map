import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { WalkGraph } from './graph';
import type { MapDoc } from './mapdoc';

const doc = JSON.parse(readFileSync('data/build/map.json', 'utf8')) as MapDoc;
const graph = new WalkGraph(doc);
const placeOf = (id: string) => {
  const p = doc.places.find((q) => q.id === id);
  if (!p) throw new Error(`no place ${id}`);
  return p.node;
};

const opts = { barrierFree: false, includePlanned: false };

describe('경로 탐색', () => {
  it('야마노테선 승강장 → 도요코선 승강장 경로가 존재하고 층을 넘나든다', () => {
    const r = graph.route(placeOf('plat-jr-yamanote'), placeOf('plat-toyoko-fukutoshin-34'), opts);
    expect(r).not.toBeNull();
    expect(r!.seconds).toBeGreaterThan(60);
    expect(r!.seconds).toBeLessThan(60 * 25);
    expect(new Set(r!.levels).size).toBeGreaterThan(2);
  });

  it('모든 curated 지점이 하치공 광장에서 도달 가능', () => {
    const start = placeOf('plaza-hachiko');
    const unreachable = doc.places
      .filter((p) => !p.planned)
      .filter((p) => graph.route(start, p.node, opts) === null)
      .map((p) => p.id);
    expect(unreachable).toEqual([]);
  });

  it('배리어프리 경로는 계단·에스컬레이터를 쓰지 않는다', () => {
    const r = graph.route(placeOf('plaza-hachiko'), placeOf('gate-jr-chuo'), {
      barrierFree: true,
      includePlanned: false,
    });
    if (r) {
      expect(r.steps.every((s) => s.edge.bf === 1)).toBe(true);
    }
  });

  it('주요 승강장 사이는 배리어프리 경로가 존재한다', () => {
    const bf = { barrierFree: true, includePlanned: false };
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

  it('공사중 링크는 기본 옵션에서 제외된다', () => {
    const withPlanned = graph.route(placeOf('plaza-hachiko'), placeOf('plan-skyway'), {
      barrierFree: false,
      includePlanned: true,
    });
    const without = graph.route(placeOf('plaza-hachiko'), placeOf('plan-skyway'), opts);
    expect(withPlanned).not.toBeNull();
    expect(without).toBeNull();
  });
});
