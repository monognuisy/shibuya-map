/** 앱 전역 상태. Svelte 5 runes 로 반응성을 갖는다. */
import { WalkGraph, type RouteResult } from './graph';
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
