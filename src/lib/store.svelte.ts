/** 앱 전역 상태. Svelte 5 runes 로 반응성을 갖는다. */
import { WalkGraph, type RouteResult } from './graph';
import { buildItinerary, type Itinerary } from './itinerary';
import type { MapDoc, PlaceDoc } from './mapdoc';
import type { ViewState } from './scene';

export const ALL_OPERATORS = ['jr', 'metro', 'tokyu', 'keio', 'facility', 'passage'];

export class AppState {
  doc = $state<MapDoc | null>(null);
  error = $state<string | null>(null);

  exaggeration = $state(5);
  activeLevel = $state<number | null>(null);
  layers = $state({
    curated: true,
    landmarks: true,
    entrances: true,
    verticals: false,
    mlit: true,
    osm: true,
    buildings: true,
    plates: true,
  });
  realHeights = $state(false);
  operators = $state(new Set(ALL_OPERATORS));
  showPlanned = $state(false);

  selectedId = $state<string | null>(null);
  hoveredId = $state<string | null>(null);

  fromId = $state<string | null>('plat-jr-yamanote');
  toId = $state<string | null>('plat-toyoko-fukutoshin-34');
  barrierFree = $state(false);
  /** 개찰 안쪽을 지름길로 쓰지 않기 */
  avoidPaidShortcut = $state(false);

  query = $state('');

  /** 경로 따라가기 — 경로 위 진행 거리(씬 단위). null 이면 꺼짐 */
  navT = $state<number | null>(null);
  navPlaying = $state(false);
  /** 초당 진행 거리 배속 */
  navSpeed = $state(1);
  /** 각 구간이 끝나는 경로상 진행 거리 (씬이 계산해 넣어 준다) */
  legOffsets = $state<number[]>([]);
  routeTotal = $state(0);

  get navOn(): boolean {
    return this.navT !== null;
  }

  /** 현재 진행 위치가 몇 번째 구간인지 */
  get navLegIndex(): number {
    if (this.navT === null) return -1;
    const offsets = this.legOffsets;
    let i = 0;
    while (i < offsets.length - 1 && offsets[i]! < this.navT) i++;
    return i;
  }

  /** 구간 i 의 시작 지점으로 이동 */
  gotoLeg(i: number) {
    const c = Math.max(0, Math.min(i, this.legOffsets.length - 1));
    this.navT = c === 0 ? 0 : this.legOffsets[c - 1]!;
    this.navPlaying = false;
  }

  #graph: WalkGraph | null = null;

  get graph(): WalkGraph | null {
    if (!this.doc) return null;
    this.#graph ??= new WalkGraph(this.doc);
    return this.#graph;
  }

  get places(): PlaceDoc[] {
    return this.doc?.places ?? [];
  }

  get selected(): PlaceDoc | null {
    return this.places.find((p) => p.id === this.selectedId) ?? null;
  }

  get route(): RouteResult | null {
    const g = this.graph;
    if (!g || !this.fromId || !this.toId || this.fromId === this.toId) return null;
    const a = this.places.find((p) => p.id === this.fromId);
    const b = this.places.find((p) => p.id === this.toId);
    if (!a || !b) return null;
    return g.route(WalkGraph.nodesOf(a), WalkGraph.nodesOf(b), {
      barrierFree: this.barrierFree,
      includePlanned: this.showPlanned,
      avoidPaidShortcut: this.avoidPaidShortcut,
    });
  }

  get itinerary(): Itinerary | null {
    const r = this.route;
    return r && this.doc ? buildItinerary(this.doc, r) : null;
  }

  get matches(): PlaceDoc[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return [];
    return this.places
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nameJa ?? '').toLowerCase().includes(q) ||
          (p.desc ?? '').toLowerCase().includes(q),
      )
      .slice(0, 12);
  }

  /** 데이터에 실제로 존재하는 층, 위에서 아래로 */
  get levels(): number[] {
    return [...new Set(this.places.map((p) => p.level))].sort((a, b) => b - a);
  }

  get view(): ViewState {
    return {
      exaggeration: this.exaggeration,
      activeLevel: this.activeLevel,
      layers: { ...this.layers },
      realHeights: this.realHeights,
      operators: new Set(this.operators),
      showPlanned: this.showPlanned,
      selectedId: this.selectedId,
      routeNodes: this.route?.nodes ?? null,
    };
  }

  toggleOperator(op: string) {
    const next = new Set(this.operators);
    if (next.has(op)) next.delete(op);
    else next.add(op);
    this.operators = next;
  }
}
