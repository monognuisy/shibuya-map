import { describe, expect, it } from 'vitest';
import { pinchDelta, pinchOf, wrapAngle } from './gesture';

const at = (ax: number, ay: number, bx: number, by: number) =>
  pinchOf({ x: ax, y: ay }, { x: bx, y: by });

describe('pinchOf', () => {
  it('거리·각·중점을 낸다', () => {
    const p = pinchOf({ x: 0, y: 0 }, { x: 30, y: 40 });
    expect(p.dist).toBe(50);
    expect(p.cx).toBe(15);
    expect(p.cy).toBe(20);
    expect(p.angle).toBeCloseTo(Math.atan2(40, 30));
  });
});

describe('wrapAngle', () => {
  it('반 바퀴를 넘으면 반대쪽으로 접는다', () => {
    expect(wrapAngle(1.9 * Math.PI)).toBeCloseTo(-0.1 * Math.PI);
    expect(wrapAngle(-1.9 * Math.PI)).toBeCloseTo(0.1 * Math.PI);
  });
  it('범위 안이면 그대로 둔다', () => {
    expect(wrapAngle(0.5)).toBe(0.5);
  });
});

describe('pinchDelta', () => {
  it('두 배로 벌리면 배율이 2 다', () => {
    expect(pinchDelta(at(0, 0, 100, 0), at(0, 0, 200, 0)).scale).toBeCloseTo(2);
  });

  it('90도 비틀면 회전이 PI/2 다', () => {
    expect(pinchDelta(at(0, 0, 100, 0), at(0, 0, 0, 100)).rotation).toBeCloseTo(Math.PI / 2);
  });

  it('180도 경계를 넘어도 작은 각으로 센다', () => {
    // 거의 +180° 에서 거의 -180° 로. 실제로 손가락이 움직인 각은 아주 작다.
    const d = pinchDelta(at(0, 0, -100, 2), at(0, 0, -100, -2));
    expect(Math.abs(d.rotation)).toBeLessThan(0.2);
  });

  it('중점이 움직인 만큼 dx·dy 가 나온다', () => {
    const d = pinchDelta(at(0, 0, 100, 0), at(10, 20, 110, 20));
    expect(d.dx).toBeCloseTo(10);
    expect(d.dy).toBeCloseTo(20);
  });

  it('손가락이 겹칠 만큼 가까우면 배율·회전을 버린다', () => {
    // 4px 떨어진 두 점에서 배율을 재면 작은 흔들림이 큰 줌으로 증폭된다.
    const d = pinchDelta(at(0, 0, 4, 0), at(0, 0, 40, 0));
    expect(d.scale).toBe(1);
    expect(d.rotation).toBe(0);
  });
});
