/**
 * 두 손가락 제스처의 수학.
 *
 * three.js 를 모르는 순수 함수로 둔다. 틀리기 쉬운 곳 — 각도가 180도를 넘을 때,
 * 손가락이 겹칠 만큼 가까울 때 — 을 카메라 코드와 떼어놓고 검증하기 위해서다.
 */

/** 화면 좌표 한 점 */
export interface Pt {
  x: number;
  y: number;
}

/** 두 포인터가 만드는 상태. 프레임마다 하나 만들어 이전 것과 비교한다. */
export interface Pinch {
  /** 두 점 사이 거리(px) */
  dist: number;
  /** 두 점이 이루는 각(rad) */
  angle: number;
  cx: number;
  cy: number;
}

export interface PinchDelta {
  /** 벌어진 배율. 1 이면 그대로 */
  scale: number;
  /** 회전(rad). 항상 (-PI, PI] */
  rotation: number;
  /** 중점 이동 */
  dx: number;
  dy: number;
}

export function pinchOf(a: Pt, b: Pt): Pinch {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return {
    dist: Math.hypot(dx, dy),
    angle: Math.atan2(dy, dx),
    cx: (a.x + b.x) / 2,
    cy: (a.y + b.y) / 2,
  };
}

/**
 * 각을 (-PI, PI] 로 접는다.
 * 179도에서 -179도로 넘어갈 때 -358도가 아니라 +2도로 세기 위해서다.
 */
export function wrapAngle(a: number): number {
  let r = a;
  while (r <= -Math.PI) r += 2 * Math.PI;
  while (r > Math.PI) r -= 2 * Math.PI;
  return r;
}

/**
 * 이보다 가까우면 배율·회전을 믿지 않는다. 손가락이 겹치면 작은 흔들림이
 * 큰 줌으로 증폭된다.
 */
const MIN_DIST = 12;

export function pinchDelta(prev: Pinch, next: Pinch): PinchDelta {
  const usable = prev.dist >= MIN_DIST && next.dist >= MIN_DIST;
  return {
    scale: usable ? next.dist / prev.dist : 1,
    rotation: usable ? wrapAngle(next.angle - prev.angle) : 0,
    dx: next.cx - prev.cx,
    dy: next.cy - prev.cy,
  };
}
