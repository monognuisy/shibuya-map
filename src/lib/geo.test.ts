import { describe, expect, it } from 'vitest';
import { ORIGIN, haversine, toLatLon, toMeters } from './geo';

describe('ENU 투영', () => {
  it('원점은 (0,0)', () => {
    const p = toMeters(ORIGIN);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('왕복 변환이 1mm 이내로 일치', () => {
    for (const ll of [
      { lat: 35.6535, lon: 139.696 },
      { lat: 35.6625, lon: 139.706 },
      { lat: 35.671678, lon: 139.689179 },
    ]) {
      const back = toLatLon(toMeters(ll));
      expect(haversine(ll, back)).toBeLessThan(0.001);
    }
  });

  it('반경 2km 내에서 하버사인 거리와 0.1% 미만 차이', () => {
    const a = { lat: 35.658034, lon: 139.701636 };
    for (const b of [
      { lat: 35.6625, lon: 139.706 },
      { lat: 35.6535, lon: 139.696 },
      { lat: 35.6716, lon: 139.6892 },
    ]) {
      const pa = toMeters(a);
      const pb = toMeters(b);
      const planar = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      const geodesic = haversine(a, b);
      expect(Math.abs(planar - geodesic) / geodesic).toBeLessThan(0.001);
    }
  });
});
